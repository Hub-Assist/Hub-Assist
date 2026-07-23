import { act, renderHook } from "@testing-library/react";
import { useDebounce } from "@/hooks/useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("returns the initial value immediately before the delay has elapsed", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("does not update the debounced value before the delay has elapsed", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 300 } }
    );

    rerender({ value: "updated", delay: 300 });

    // Timer has not fired yet — value should still be the initial one
    expect(result.current).toBe("initial");
  });

  it("updates the debounced value after the full delay has elapsed", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 300 } }
    );

    rerender({ value: "updated", delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe("updated");
  });

  it("resets the timer when the value changes before the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } }
    );

    // Change value at 100 ms
    act(() => {
      jest.advanceTimersByTime(100);
    });
    rerender({ value: "b" });

    // At 200 ms from start (100 ms after second change) — should still be "a"
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("a");

    // At 400 ms from start (300 ms after second change) — should be "b"
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe("b");
  });

  it("uses 300 ms as the default delay when no delay argument is provided", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: "first" } }
    );

    rerender({ value: "second" });

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe("first");

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe("second");
  });

  it("works with non-string values (numbers)", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 200),
      { initialProps: { value: 0 } }
    );

    rerender({ value: 42 });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toBe(42);
  });

  it("works with non-string values (objects)", () => {
    const initialObj = { a: 1 };
    const updatedObj = { a: 2 };

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: initialObj } }
    );

    rerender({ value: updatedObj });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current).toBe(updatedObj);
  });

  it("a single-character input does not propagate before the delay (simulates 1-char search guard)", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "" } }
    );

    // User types one character
    rerender({ value: "a" });

    // Not yet debounced
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("");

    // After full delay the debounced value is "a" — but the 2-char guard in
    // useWorkspaces prevents an API call for single characters
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");
  });
});
