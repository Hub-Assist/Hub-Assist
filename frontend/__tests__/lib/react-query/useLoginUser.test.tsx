import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLoginUser } from "@/lib/react-query/hooks/auth/useLoginUser";
import { useAuthStore } from "@/lib/store/authStore";
import * as apiClient from "@/lib/apiClient";
import type { User } from "@/types/user";

// Mock the apiClient module
jest.mock("@/lib/apiClient");

// Mock the authStore
jest.mock("@/lib/store/authStore");

// Helper to create valid JWT token
const makeToken = (expOffset = 3600) => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffset }));
  return `header.${payload}.sig`;
};

// Helper to create a QueryClient for tests
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Wrapper component for React Query
const createWrapper = () => {
  const testQueryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
  );
};

describe("useLoginUser", () => {
  let mockPost: jest.Mock;
  let mockLogin: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the post function
    mockPost = jest.fn();
    (apiClient.post as jest.Mock) = mockPost;

    // Mock the authStore login method
    mockLogin = jest.fn();
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      const store = { login: mockLogin };
      return selector(store);
    });
  });

  describe("on success", () => {
    it("should call authStore.login with response data", async () => {
      const token = makeToken();
      const user: User = {
        id: "1",
        firstname: "John",
        lastname: "Doe",
        email: "john@example.com",
        role: "member",
        verified: true,
        active: true,
        joinedDate: "2024-01-01",
        name: "John Doe",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };

      const loginResponse = { access_token: token, user };
      mockPost.mockResolvedValueOnce(loginResponse);

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      const payload = { email: "john@example.com", password: "password123" };

      await act(async () => {
        result.current.mutate(payload);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPost).toHaveBeenCalledWith("/auth/login", payload);
      expect(mockLogin).toHaveBeenCalledWith(loginResponse);
    });

    it("should set data on successful login", async () => {
      const token = makeToken();
      const loginResponse = { access_token: token };
      mockPost.mockResolvedValueOnce(loginResponse);

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ email: "test@example.com", password: "pass" });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(loginResponse);
    });

    it("should handle login without user data", async () => {
      const token = makeToken();
      const loginResponse = { access_token: token };
      mockPost.mockResolvedValueOnce(loginResponse);

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ email: "test@example.com", password: "pass" });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockLogin).toHaveBeenCalledWith(loginResponse);
    });
  });

  describe("on error", () => {
    it("should set error state on failed login", async () => {
      const error = new Error("Invalid credentials");
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ email: "test@example.com", password: "wrong" });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("should not call authStore.login on error", async () => {
      const error = new Error("Network error");
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ email: "test@example.com", password: "pass" });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("should handle 401 unauthorized error", async () => {
      const error = new Error("Unauthorized");
      (error as any).response = { status: 401 };
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ email: "test@example.com", password: "wrong" });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should handle server error (500)", async () => {
      const error = new Error("Internal Server Error");
      (error as any).response = { status: 500 };
      mockPost.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ email: "test@example.com", password: "pass" });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe("mutation state", () => {
    it("should set isPending to true while mutation is in progress", async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      mockPost.mockReturnValueOnce(loginPromise);

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({ email: "test@example.com", password: "pass" });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      act(() => {
        resolveLogin!({ access_token: makeToken() });
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });

    it("should register the mutation under the correct mutation key", () => {
      const testQueryClient = createTestQueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
      );

      mockPost.mockReturnValueOnce(new Promise(() => {}));

      const { result } = renderHook(() => useLoginUser(), { wrapper });

      act(() => {
        result.current.mutate({ email: "test@example.com", password: "pass" });
      });

      const [mutation] = testQueryClient.getMutationCache().getAll();
      expect(mutation?.options.mutationKey).toEqual(["auth", "login"]);
    });
  });

  describe("edge cases", () => {
    it("should handle rapid successive mutations", async () => {
      const token = makeToken();
      mockPost.mockResolvedValue({ access_token: token });

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ email: "test1@example.com", password: "pass1" });
        result.current.mutate({ email: "test2@example.com", password: "pass2" });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should have been called twice
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it("should handle empty response gracefully", async () => {
      mockPost.mockResolvedValueOnce({});

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ email: "test@example.com", password: "pass" });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockLogin).toHaveBeenCalledWith({});
    });
  });
});
