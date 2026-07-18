import { act, renderHook } from "@testing-library/react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the initial value when localStorage is empty", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", false));
    expect(result.current[0]).toBe(false);
  });

  it("hydrates the stored value after mount", () => {
    localStorage.setItem("test-key", JSON.stringify(true));
    const { result } = renderHook(() => useLocalStorage("test-key", false));
    // After the initial render + useEffect the value should be hydrated
    expect(result.current[0]).toBe(true);
  });

  it("persists the new value to localStorage on setValue", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", false));
    act(() => {
      result.current[1](true);
    });
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem("test-key")).toBe("true");
  });

  it("supports functional updater form", () => {
    localStorage.setItem("test-key", JSON.stringify(false));
    const { result } = renderHook(() => useLocalStorage("test-key", false));

    act(() => {
      result.current[1]((prev) => !prev);
    });

    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem("test-key")).toBe("true");
  });

  it("stores and retrieves string values", () => {
    const { result } = renderHook(() => useLocalStorage<string>("name-key", ""));
    act(() => {
      result.current[1]("Jane");
    });
    expect(result.current[0]).toBe("Jane");
    expect(localStorage.getItem("name-key")).toBe('"Jane"');
  });

  it("stores and retrieves object values", () => {
    const { result } = renderHook(() =>
      useLocalStorage<{ count: number }>("obj-key", { count: 0 }),
    );
    act(() => {
      result.current[1]({ count: 42 });
    });
    expect(result.current[0]).toEqual({ count: 42 });
    expect(JSON.parse(localStorage.getItem("obj-key")!)).toEqual({ count: 42 });
  });

  it("sidebar-collapsed: false → true → persisted", () => {
    const { result } = renderHook(() =>
      useLocalStorage<boolean>("sidebar-collapsed", false),
    );
    expect(result.current[0]).toBe(false);

    act(() => result.current[1](true));

    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem("sidebar-collapsed")).toBe("true");
  });

  it("sidebar-collapsed: restored true after browser refresh (new hook instance)", () => {
    // Simulate a previous session having written the value
    localStorage.setItem("sidebar-collapsed", "true");

    const { result } = renderHook(() =>
      useLocalStorage<boolean>("sidebar-collapsed", false),
    );

    // The initial value is false (SSR-safe) but should be updated after mount
    expect(result.current[0]).toBe(true);
  });
});
