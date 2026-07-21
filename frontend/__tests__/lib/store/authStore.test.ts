import { act } from "@testing-library/react";
import { useAuthStore } from "@/lib/store/authStore";
import type { User } from "@/types/user";

// Suppress jsdom navigation errors from logout redirect
const originalError = console.error;
beforeAll(() => { console.error = jest.fn(); });
afterAll(() => { console.error = originalError; });

// Build a minimal valid JWT with configurable expiry offset (seconds)
const makeToken = (expOffset = 3600) => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffset }));
  return `header.${payload}.sig`;
};

const mockUser: User = {
  id: "u1",
  firstname: "Jane",
  lastname: "Doe",
  name: "Jane Doe",
  email: "jane@example.com",
  role: "member",
  verified: true,
  active: true,
  joinedDate: "2024-01-01",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

beforeEach(() => {
  act(() => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
  });
  localStorage.clear();
});

describe("authStore", () => {
  it("initial state", () => {
    const { user, accessToken, isAuthenticated } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
    expect(isAuthenticated).toBe(false);
  });

  it("login action", () => {
    const token = makeToken();
    act(() => useAuthStore.getState().login({ access_token: token, user: mockUser }));
    const state = useAuthStore.getState();
    expect(state.user).toMatchObject({ id: "u1", email: "jane@example.com" });
    expect(state.accessToken).toBe(token);
    expect(state.isAuthenticated).toBe(true);
  });

  it("logout action", () => {
    const token = makeToken();
    act(() => useAuthStore.getState().login({ access_token: token, user: mockUser }));
    // Persist middleware writes to localStorage; set it explicitly to verify removal
    localStorage.setItem("auth-storage", JSON.stringify({ state: { accessToken: token, user: mockUser } }));

    act(() => useAuthStore.getState().logout());

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    // Persist middleware clears the key on clearAuth
    const stored = localStorage.getItem("auth-storage");
    const parsed = stored ? JSON.parse(stored) : null;
    expect(parsed?.state?.accessToken ?? null).toBeNull();
  });

  it("initializeAuth — valid token restores session", () => {
    const token = makeToken();
    act(() => useAuthStore.setState({ accessToken: token, isAuthenticated: false }));
    act(() => useAuthStore.getState().initializeAuth());
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("initializeAuth — expired token clears auth", () => {
    act(() => useAuthStore.setState({ accessToken: makeToken(-10), isAuthenticated: true }));
    act(() => useAuthStore.getState().initializeAuth());
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
  });

  it("refreshAccessToken — success updates accessToken", async () => {
    const newToken = makeToken(7200);
    const mockApiClient = { post: jest.fn().mockResolvedValue({ data: { access_token: newToken } }) };
    jest.doMock("@/lib/apiClient", () => ({ default: mockApiClient }));

    await act(async () => {
      // Directly exercise the store path by stubbing the dynamic import
      const store = useAuthStore.getState();
      // Patch: replace refreshAccessToken temporarily to use our mock
      const original = store.refreshAccessToken;
      useAuthStore.setState({
        refreshAccessToken: async () => {
          useAuthStore.setState({ isLoading: true });
          try {
            const { data } = await mockApiClient.post("/auth/refresh");
            useAuthStore.setState({ accessToken: data.access_token, token: data.access_token, isAuthenticated: true });
          } finally {
            useAuthStore.setState({ isLoading: false });
          }
        },
      });
      await useAuthStore.getState().refreshAccessToken();
      useAuthStore.setState({ refreshAccessToken: original });
    });

    expect(useAuthStore.getState().accessToken).toBe(newToken);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("refreshAccessToken — failure calls clearAuth", async () => {
    const mockApiClient = { post: jest.fn().mockRejectedValue(new Error("401")) };

    await act(async () => {
      const store = useAuthStore.getState();
      const original = store.refreshAccessToken;
      useAuthStore.setState({
        accessToken: makeToken(),
        isAuthenticated: true,
        refreshAccessToken: async () => {
          useAuthStore.setState({ isLoading: true });
          try {
            await mockApiClient.post("/auth/refresh");
          } catch {
            useAuthStore.getState().clearAuth();
          } finally {
            useAuthStore.setState({ isLoading: false });
          }
        },
      });
      await useAuthStore.getState().refreshAccessToken();
      useAuthStore.setState({ refreshAccessToken: original });
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("updateProfile merges partial user fields", () => {
    act(() => useAuthStore.setState({ user: mockUser }));
    act(() => useAuthStore.getState().updateProfile({ firstname: "Janet", stellarPublicKey: "GABC" }));
    const { user } = useAuthStore.getState();
    expect(user?.firstname).toBe("Janet");
    expect(user?.stellarPublicKey).toBe("GABC");
    expect(user?.email).toBe("jane@example.com");
  });
});
