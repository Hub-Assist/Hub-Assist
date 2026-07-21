import { renderHook, act } from "@testing-library/react";
import { useAdaptivePolling, type AdaptivePollingConfig } from "../useAdaptivePolling";

// Mock document.visibilityState
Object.defineProperty(document, "visibilityState", {
  writable: true,
  value: "visible",
});

// Mock document.addEventListener and removeEventListener
const mockAddEventListener = jest.spyOn(document, "addEventListener");
const mockRemoveEventListener = jest.spyOn(document, "removeEventListener");

describe("useAdaptivePolling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.visibilityState = "visible";
  });

  afterEach(() => {
    mockAddEventListener.mockClear();
    mockRemoveEventListener.mockClear();
  });

  describe("Basic functionality", () => {
    it("should initialize with base interval", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
      };

      const { result } = renderHook(() => useAdaptivePolling(config));

      expect(result.current.refetchInterval).toBe(30000);
      expect(result.current.errorCount).toBe(0);
      expect(result.current.isDisconnected).toBe(false);
    });

    it("should provide callback functions", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
      };

      const { result } = renderHook(() => useAdaptivePolling(config));

      expect(typeof result.current.onError).toBe("function");
      expect(typeof result.current.onSuccess).toBe("function");
      expect(typeof result.current.reconnect).toBe("function");
    });
  });

  describe("Exponential backoff", () => {
    it("should double interval on each error", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
        maxErrors: 3,
      };

      const { result } = renderHook(() => useAdaptivePolling(config));

      // Initial state
      expect(result.current.refetchInterval).toBe(30000);
      expect(result.current.errorCount).toBe(0);

      // First error: 30s * 2^1 = 60s
      act(() => {
        result.current.onError();
      });
      expect(result.current.refetchInterval).toBe(60000);
      expect(result.current.errorCount).toBe(1);

      // Second error: 30s * 2^2 = 120s
      act(() => {
        result.current.onError();
      });
      expect(result.current.refetchInterval).toBe(120000);
      expect(result.current.errorCount).toBe(2);

      // Third error: stop polling
      act(() => {
        result.current.onError();
      });
      expect(result.current.refetchInterval).toBe(false);
      expect(result.current.errorCount).toBe(3);
      expect(result.current.isDisconnected).toBe(true);
    });

    it("should reset error count on success", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
      };

      const { result } = renderHook(() => useAdaptivePolling(config));

      // Cause an error
      act(() => {
        result.current.onError();
      });
      expect(result.current.refetchInterval).toBe(60000);
      expect(result.current.errorCount).toBe(1);

      // Success should reset
      act(() => {
        result.current.onSuccess();
      });
      expect(result.current.refetchInterval).toBe(30000);
      expect(result.current.errorCount).toBe(0);
    });

    it("should respect custom maxErrors", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
        maxErrors: 2, // Custom max errors
      };

      const { result } = renderHook(() => useAdaptivePolling(config));

      // First error
      act(() => {
        result.current.onError();
      });
      expect(result.current.refetchInterval).toBe(60000);
      expect(result.current.isDisconnected).toBe(false);

      // Second error - should stop polling
      act(() => {
        result.current.onError();
      });
      expect(result.current.refetchInterval).toBe(false);
      expect(result.current.isDisconnected).toBe(true);
    });
  });

  describe("Reconnect functionality", () => {
    it("should reset error state and restart polling", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
      };

      const { result } = renderHook(() => useAdaptivePolling(config));

      // Cause multiple errors to stop polling
      act(() => {
        result.current.onError();
        result.current.onError();
        result.current.onError();
      });
      expect(result.current.refetchInterval).toBe(false);
      expect(result.current.errorCount).toBe(3);
      expect(result.current.isDisconnected).toBe(true);

      // Reconnect should reset everything
      act(() => {
        result.current.reconnect();
      });
      expect(result.current.refetchInterval).toBe(30000);
      expect(result.current.errorCount).toBe(0);
      expect(result.current.isDisconnected).toBe(false);
    });
  });

  describe("Visibility API integration", () => {
    it("should add visibility event listener by default", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
      };

      renderHook(() => useAdaptivePolling(config));

      expect(mockAddEventListener).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function)
      );
    });

    it("should not add event listener when respectVisibility is false", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
        respectVisibility: false,
      };

      renderHook(() => useAdaptivePolling(config));

      expect(mockAddEventListener).not.toHaveBeenCalled();
    });

    it("should pause polling when document is hidden", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
        respectVisibility: true,
      };

      const { result } = renderHook(() => useAdaptivePolling(config));

      // Initially visible
      expect(result.current.refetchInterval).toBe(30000);
      expect(result.current.isVisibilityPaused).toBe(false);

      // Simulate document becoming hidden
      act(() => {
        document.visibilityState = "hidden";
        // Trigger the visibility change event
        const visibilityHandler = mockAddEventListener.mock.calls[0][1] as () => void;
        visibilityHandler();
      });

      expect(result.current.refetchInterval).toBe(false);
      expect(result.current.isVisibilityPaused).toBe(true);
    });

    it("should resume polling when document becomes visible", () => {
      // Start with document hidden
      document.visibilityState = "hidden";

      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
        respectVisibility: true,
      };

      const { result } = renderHook(() => useAdaptivePolling(config));

      // Should be paused initially
      expect(result.current.refetchInterval).toBe(false);
      expect(result.current.isVisibilityPaused).toBe(true);

      // Simulate document becoming visible
      act(() => {
        document.visibilityState = "visible";
        const visibilityHandler = mockAddEventListener.mock.calls[0][1] as () => void;
        visibilityHandler();
      });

      expect(result.current.refetchInterval).toBe(30000);
      expect(result.current.isVisibilityPaused).toBe(false);
    });

    it("should clean up event listener on unmount", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
      };

      const { unmount } = renderHook(() => useAdaptivePolling(config));

      expect(mockAddEventListener).toHaveBeenCalled();

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function)
      );
    });
  });

  describe("Combined scenarios", () => {
    it("should handle errors while visibility paused", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
      };

      const { result } = renderHook(() => useAdaptivePolling(config));

      // Hide document
      act(() => {
        document.visibilityState = "hidden";
        const visibilityHandler = mockAddEventListener.mock.calls[0][1] as () => void;
        visibilityHandler();
      });

      expect(result.current.refetchInterval).toBe(false);
      expect(result.current.isVisibilityPaused).toBe(true);

      // Cause error while hidden
      act(() => {
        result.current.onError();
      });

      expect(result.current.errorCount).toBe(1);
      expect(result.current.refetchInterval).toBe(false); // Still false due to visibility

      // Make visible again
      act(() => {
        document.visibilityState = "visible";
        const visibilityHandler = mockAddEventListener.mock.calls[0][1] as () => void;
        visibilityHandler();
      });

      // Should now reflect the error state
      expect(result.current.refetchInterval).toBe(60000); // 30s * 2^1
      expect(result.current.isVisibilityPaused).toBe(false);
    });

    it("should maintain disconnected state regardless of visibility", () => {
      const config: AdaptivePollingConfig = {
        baseInterval: 30000,
        maxErrors: 1,
      };

      const { result } = renderHook(() => useAdaptivePolling(config));

      // Cause disconnection
      act(() => {
        result.current.onError();
      });

      expect(result.current.refetchInterval).toBe(false);
      expect(result.current.isDisconnected).toBe(true);

      // Hide and show document - should remain disconnected
      act(() => {
        document.visibilityState = "hidden";
        const visibilityHandler = mockAddEventListener.mock.calls[0][1] as () => void;
        visibilityHandler();
      });

      expect(result.current.refetchInterval).toBe(false);
      expect(result.current.isDisconnected).toBe(true);

      act(() => {
        document.visibilityState = "visible";
        const visibilityHandler = mockAddEventListener.mock.calls[0][1] as () => void;
        visibilityHandler();
      });

      expect(result.current.refetchInterval).toBe(false);
      expect(result.current.isDisconnected).toBe(true);
    });
  });
});