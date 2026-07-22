"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * SSR-safe hook that syncs state with localStorage.
 * - Returns `initialValue` on the server and on first render to avoid hydration mismatch.
 * - Persists state under the given key as JSON.
 * - Fires a storage event so multiple tabs stay in sync (optional consumer).
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Always start with the initial value to keep SSR consistent
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // After mount, hydrate from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item) as T);
      }
    } catch (err) {
      console.warn(`[useLocalStorage] Failed to read key "${key}":`, err);
    }
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        setStoredValue((prev) => {
          const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(next));
          }
          return next;
        });
      } catch (err) {
        console.warn(`[useLocalStorage] Failed to write key "${key}":`, err);
      }
    },
    [key],
  );

  return [storedValue, setValue];
}
