import { renderHook, act } from "@testing-library/react";
import { useDashboardPolling } from "../useDashboardPolling";

// Mock document.visibilityState
Object.defineProperty(document, "visibilityState", {
  writable: true,
  value: "visible",
});

// Mock document.addEventListener and removeEventListener
jest.spyOn(document, "addEventListener").mockImplementation(() => {});
jest.spyOn(document, "removeEventListener").mockImplementation(() => {});

describe("useDashboardPolling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.visibilityState = "visible";
  });

  describe("Basic functionality", () => {
    it("should initialize with correct default values", () => {
      const { result } = renderHook(() => useDashboardPolling());

      expect(result.current.refetchInterval).toBe(30000); // 30 seconds
      expect(result.current.errorCount).toBe(0);
      expect(result.current.isDisconnected).toBe(false);
      expect(result.current.isVisibilityPaused).toBe(false);
      expect(result.current.connectionStatus).toBe("connected");
    });

    it("should provide all adaptive polling functionality", () => {
      const { result } = renderHook(() => useDashboardPolling());

      expect(typeof result.current.onError).toBe("function");
      expect(typeof result.current.onSuccess).toBe("function");
      expect(typeof result.current.reconnect).toBe("function");
    });
  });

  describe("Connection status mapping", () => {
    it("should return 'connected' status initially", () => {
      const { result } = renderHook(() => useDashboardPolling());
      
      expect(result.current.connectionStatus).toBe("connected");
    });

    it("should return 'backoff' status when there are errors", () => {
      const { result } = renderHook(() => useDashboardPolling());

      act(() => {
        result.current.onError();
      });

      expect(result.current.connectionStatus).toBe("backoff");
      expect(result.current.errorCount).toBe(1);
    });

    it("should return 'disconnected' status when max errors reached", () => {
      const { result } = renderHook(() => useDashboardPolling());

      // Cause 3 errors to trigger disconnection
      act(() => {
        result.current.onError();
        result.current.onError();
        result.current.onError();
      });

      expect(result.current.connectionStatus).toBe("disconnected");
      expect(result.current.isDisconnected).toBe(true);
    });

    it("should return 'connected' status when visibility paused", () => {
      const { result } = renderHook(() => useDashboardPolling());

      // Simulate document becoming hidden
      act(() => {
        document.visibilityState = "hidden";
        // Simulate the visibility change event
        const addEventListenerCalls = (document.addEventListener as jest.Mock).mock.calls;
        const visibilityHandler = addEventListenerCalls.find(call => call[0] === "visibilitychange")?.[1];
        if (visibilityHandler) {
          visibilityHandler();
        }
      });

      expect(result.current.isVisibilityPaused).toBe(true);
      expect(result.current.connectionStatus).toBe("connected"); // Still connected, just paused
    });

    it("should prioritize disconnected over other states", () => {
      const { result } = renderHook(() => useDashboardPolling());

      // First cause disconnection
      act(() => {
        result.current.onError();
        result.current.onError();
        result.current.onError();
      });

      expect(result.current.connectionStatus).toBe("disconnected");

      // Hide document - should still be disconnected
      act(() => {
        document.visibilityState = "hidden";
        const addEventListenerCalls = (document.addEventListener as jest.Mock).mock.calls;
        const visibilityHandler = addEventListenerCalls.find(call => call[0] === "visibilitychange")?.[1];
        if (visibilityHandler) {
          visibilityHandler();
        }
      });

      expect(result.current.connectionStatus).toBe("disconnected");
    });
  });

  describe("State transitions", () => {
    it("should transition from connected -> backoff -> disconnected", () => {
      const { result } = renderHook(() => useDashboardPolling());

      // Initial state
      expect(result.current.connectionStatus).toBe("connected");

      // First error -> backoff
      act(() => {
        result.current.onError();
      });
      expect(result.current.connectionStatus).toBe("backoff");

      // More errors -> still backoff
      act(() => {
        result.current.onError();
      });
      expect(result.current.connectionStatus).toBe("backoff");

      // Max errors -> disconnected
      act(() => {
        result.current.onError();
      });
      expect(result.current.connectionStatus).toBe("disconnected");
    });

    it("should reset to connected after successful reconnect", () => {
      const { result } = renderHook(() => useDashboardPolling());

      // Cause disconnection
      act(() => {
        result.current.onError();
        result.current.onError();
        result.current.onError();
      });
      expect(result.current.connectionStatus).toBe("disconnected");

      // Reconnect
      act(() => {
        result.current.reconnect();
      });
      expect(result.current.connectionStatus).toBe("connected");
      expect(result.current.errorCount).toBe(0);
      expect(result.current.isDisconnected).toBe(false);
    });

    it("should reset to connected after successful request", () => {
      const { result } = renderHook(() => useDashboardPolling());

      // Cause some errors
      act(() => {
        result.current.onError();
        result.current.onError();
      });
      expect(result.current.connectionStatus).toBe("backoff");

      // Success should reset to connected
      act(() => {
        result.current.onSuccess();
      });
      expect(result.current.connectionStatus).toBe("connected");
      expect(result.current.errorCount).toBe(0);
    });
  });

  describe("Adaptive polling behavior", () => {
    it("should use exponential backoff intervals", () => {
      const { result } = renderHook(() => useDashboardPolling());

      // Initial interval: 30s
      expect(result.current.refetchInterval).toBe(30000);

      // After 1 error: 30s * 2^1 = 60s
      act(() => {
        result.current.onError();
      });
      expect(result.current.refetchInterval).toBe(60000);

      // After 2 errors: 30s * 2^2 = 120s
      act(() => {
        result.current.onError();
      });
      expect(result.current.refetchInterval).toBe(120000);

      // After 3 errors: stop polling
      act(() => {
        result.current.onError();
      });
      expect(result.current.refetchInterval).toBe(false);
    });

    it("should pause polling when visibility is false", () => {
      const { result } = renderHook(() => useDashboardPolling());

      expect(result.current.refetchInterval).toBe(30000);

      // Hide document
      act(() => {
        document.visibilityState = "hidden";
        const addEventListenerCalls = (document.addEventListener as jest.Mock).mock.calls;
        const visibilityHandler = addEventListenerCalls.find(call => call[0] === "visibilitychange")?.[1];
        if (visibilityHandler) {
          visibilityHandler();
        }
      });

      expect(result.current.refetchInterval).toBe(false);
      expect(result.current.isVisibilityPaused).toBe(true);

      // Show document
      act(() => {
        document.visibilityState = "visible";
        const addEventListenerCalls = (document.addEventListener as jest.Mock).mock.calls;
        const visibilityHandler = addEventListenerCalls.find(call => call[0] === "visibilitychange")?.[1];
        if (visibilityHandler) {
          visibilityHandler();
        }
      });

      expect(result.current.refetchInterval).toBe(30000);
      expect(result.current.isVisibilityPaused).toBe(false);
    });
  });
});