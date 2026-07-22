/**
 * Tests for useKeyboardShortcuts hook:
 *   - Registers keydown listener on mount
 *   - Calls router.push for href shortcuts
 *   - Calls onTrigger callback shortcuts
 *   - Ignores shortcuts while focus is in an input / textarea / select
 *   - Ignores shortcuts for non-matching keys
 *   - formatShortcutLabel builds readable labels
 */

import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import {
  useKeyboardShortcuts,
  formatShortcutLabel,
  type KeyboardShortcut,
} from "@/hooks/useKeyboardShortcuts";

// ─── Mock next/navigation ─────────────────────────────────────────────────────
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fireKey(
  key: string,
  modifiers: { altKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {},
  target: EventTarget = document
) {
  fireEvent.keyDown(target, { key, ...modifiers });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useKeyboardShortcuts", () => {
  beforeEach(() => mockPush.mockClear());

  it("calls router.push with the matching href on Alt+1", () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: "1", alt: true, href: "/dashboard" },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey("1", { altKey: true });

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("calls the onTrigger callback when provided", () => {
    const onTrigger = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "Escape", onTrigger },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey("Escape");

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("does NOT call router.push when no shortcut matches", () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: "1", alt: true, href: "/dashboard" },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Wrong modifier
    fireKey("1", { ctrlKey: true });
    // Wrong key
    fireKey("9", { altKey: true });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ignores shortcuts when focus is inside an <input>", () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: "1", alt: true, href: "/dashboard" },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireKey("1", { altKey: true }, input);

    document.body.removeChild(input);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ignores shortcuts when focus is inside a <textarea>", () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: "1", alt: true, href: "/dashboard" },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    fireKey("1", { altKey: true }, textarea);

    document.body.removeChild(textarea);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ignores shortcuts when focus is inside a <select>", () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: "1", alt: true, href: "/dashboard" },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));

    const select = document.createElement("select");
    document.body.appendChild(select);

    fireKey("1", { altKey: true }, select);

    document.body.removeChild(select);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("removes the event listener on unmount", () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: "1", alt: true, href: "/dashboard" },
    ];
    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

    unmount();
    fireKey("1", { altKey: true });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("only triggers the first matching shortcut in the list", () => {
    const first = jest.fn();
    const second = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "x", onTrigger: first },
      { key: "x", onTrigger: second },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey("x");

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});

describe("formatShortcutLabel", () => {
  it("builds Alt+1 label", () => {
    expect(formatShortcutLabel({ key: "1", alt: true })).toBe("Alt+1");
  });

  it("builds Ctrl+Shift+S label", () => {
    expect(
      formatShortcutLabel({ key: "s", ctrl: true, shift: true })
    ).toBe("Ctrl+Shift+S");
  });

  it("builds a plain key label with no modifiers", () => {
    expect(formatShortcutLabel({ key: "Escape" })).toBe("ESCAPE");
  });
});
