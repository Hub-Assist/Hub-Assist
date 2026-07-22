"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export interface KeyboardShortcut {
  /** The key to match (e.g. "1", "2", "ArrowUp") */
  key: string;
  /** Require Alt modifier key */
  alt?: boolean;
  /** Require Ctrl modifier key */
  ctrl?: boolean;
  /** Require Shift modifier key */
  shift?: boolean;
  /** Navigation href – if provided, calls router.push on match */
  href?: string;
  /** Custom callback – called instead of (or in addition to) href navigation */
  onTrigger?: () => void;
  /** Human-readable label for the shortcut (e.g. "Alt+1") */
  label?: string;
}

/**
 * Registers a list of keyboard shortcuts on the document.
 *
 * All shortcuts are removed when the component that called this hook unmounts,
 * so there is no risk of stale handlers accumulating.
 *
 * Design notes
 * ─────────────
 * • Alt+[1-9] shortcuts are used because they do not conflict with common
 *   browser defaults (Ctrl+T, Ctrl+W, F5, etc.) on Windows, macOS, or Linux.
 * • The handler uses `event.preventDefault()` only when a shortcut matches,
 *   so unmatched key combinations pass through untouched.
 * • Input / textarea / contentEditable elements are excluded to avoid
 *   hijacking text entry.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  const router = useRouter();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Skip when the user is typing in an input-like element
      const target = event.target as HTMLElement;
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const keyMatch = event.key === shortcut.key;

        if (keyMatch && altMatch && ctrlMatch && shiftMatch) {
          event.preventDefault();

          if (shortcut.onTrigger) {
            shortcut.onTrigger();
          }

          if (shortcut.href) {
            router.push(shortcut.href);
          }

          // Stop checking further shortcuts once one matched
          break;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [shortcuts, router]);
}

/**
 * Builds the human-readable label for a shortcut (e.g. "Alt+1").
 * Exported so components can render it in tooltips.
 */
export function formatShortcutLabel(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  parts.push(shortcut.key.toUpperCase());
  return parts.join("+");
}
