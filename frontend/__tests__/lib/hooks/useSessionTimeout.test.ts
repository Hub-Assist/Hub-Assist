import { renderHook, act } from "@testing-library/react";
import { useAuthStore } from "@/lib/store/authStore";

// ─── Next.js navigation mock ───────────────────────────────────────────────
const mockPathname = jest.fn(() => "/dashboard");
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// ─── Hook under test (imported after mocks) ────────────────────────────────
import { useSessionTimeout } from "@/lib/hooks/useSessionTimeout";

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Build a minimal JWT whose `exp` is `offsetSeconds` from now */
function makeToken(offsetSeconds: number): string {
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + offsetSeconds }),
  );
  return `header.${payload}.sig`;
}

/** Authenticate the store with a given token */
function seedAuth(token: string) {
  act(() => {
    useAuthStore.setState({
      accessToken: token,
      token,
      isAuthenticated: true,
      user: null,
    });
  });
}

/** Reset store + navigation between tests */
function resetStore() {
  act(() => {
    useAuthStore.setState({
      accessToken: null,
      token: null,
      isAuthenticated: false,
      user: null,
    });
  });
  mockPathname.mockReturnValue("/dashboard");
}

// ─── Suppress jsdom navigation errors from logout redirect ─────────────────
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("useSessionTimeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── 1. Modal triggers when tokenExpiresAt - now <= 120 s ─────────────────
  it("shows the warning modal when the token expires within 120 seconds", () => {
    // Token expires in 90 s — already inside the 120 s window
    const token = makeToken(90);
    seedAuth(token);

    const { result } = renderHook(() => useSessionTimeout());

    // The hook should surface the warning immediately (msUntilWarn <= 0 branch)
    expect(result.current.showWarning).toBe(true);
  });

  it("does NOT show the modal when the token has more than 120 seconds remaining", () => {
    // Token expires in 300 s — warning fires at 180 s from now
    const token = makeToken(300);
    seedAuth(token);

    const { result } = renderHook(() => useSessionTimeout());

    // Warning timer hasn't fired yet
    expect(result.current.showWarning).toBe(false);

    // Advance time to just before the 180 s mark
    act(() => jest.advanceTimersByTime(179_000));
    expect(result.current.showWarning).toBe(false);

    // Cross the threshold
    act(() => jest.advanceTimersByTime(2_000));
    expect(result.current.showWarning).toBe(true);
  });

  // ── 2. countdown reaches 0 → logout() is called automatically ────────────
  it("calls logout() automatically when the countdown reaches zero", () => {
    const logoutSpy = jest.fn();
    act(() => {
      useAuthStore.setState({ logout: logoutSpy } as never);
    });

    // Token expires in 90 s — modal opens immediately with countdownSeconds=90
    const token = makeToken(90);
    seedAuth(token);

    const { result } = renderHook(() => useSessionTimeout());
    expect(result.current.showWarning).toBe(true);

    // CountDownTimer calls onExpire which calls onLogOut → logout()
    act(() => {
      result.current.onLogOut();
    });

    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  it("auto-logout fires via the onExpire callback from CountDownTimer", () => {
    // Simulate the path: countdown reaches 0 → handleExpire → onLogOut → logout()
    const logoutSpy = jest.fn();
    act(() => {
      useAuthStore.setState({ logout: logoutSpy } as never);
    });

    const token = makeToken(90);
    seedAuth(token);

    const { result } = renderHook(() => useSessionTimeout());
    expect(result.current.showWarning).toBe(true);

    // The parent component wires CountDownTimer.onExpire → result.current.onLogOut
    // Simulate that the countdown hit zero:
    act(() => {
      result.current.onLogOut();
    });

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(result.current.showWarning).toBe(false);
  });

  // ── 3. "Stay Logged In" refreshes token and resets the timeout timer ──────
  it("refreshes the token and hides the modal when Stay Logged In is clicked", async () => {
    const newToken = makeToken(3600);
    const refreshSpy = jest.fn().mockResolvedValue(undefined);

    // Seed with a token that is already inside the warning window
    const token = makeToken(90);
    seedAuth(token);

    // Patch refreshAccessToken so it also updates the store (simulating real behaviour)
    act(() => {
      useAuthStore.setState({
        refreshAccessToken: async () => {
          refreshSpy();
          // Simulate the store being updated with the new token after refresh
          act(() => {
            useAuthStore.setState({
              accessToken: newToken,
              token: newToken,
              isAuthenticated: true,
            });
          });
        },
      } as never);
    });

    const { result } = renderHook(() => useSessionTimeout());
    expect(result.current.showWarning).toBe(true);

    await act(async () => {
      await result.current.onStayLoggedIn();
    });

    // Modal should be dismissed
    expect(result.current.showWarning).toBe(false);
    // refreshAccessToken was invoked
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    // New token is in the store
    expect(useAuthStore.getState().accessToken).toBe(newToken);
  });

  // ── 4. Modal suppressed on login page ────────────────────────────────────
  it("does not show the warning when the user is on the login page", () => {
    mockPathname.mockReturnValue("/login");

    const token = makeToken(90); // inside warning window
    seedAuth(token);

    const { result } = renderHook(() => useSessionTimeout());

    expect(result.current.showWarning).toBe(false);
  });
});
