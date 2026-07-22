"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";

/** Pages where the warning modal must never appear */
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-otp"];

/** How many seconds before expiry to show the warning */
const WARN_BEFORE_EXPIRY_S = 120;

/** Duration of the visible countdown (must equal WARN_BEFORE_EXPIRY_S) */
const COUNTDOWN_SECONDS = WARN_BEFORE_EXPIRY_S;

/** Activity debounce window — suppress modal while user has typed/moved within this period */
const ACTIVITY_DEBOUNCE_MS = 10_000;

/** Parse the `exp` claim from a JWT without a library */
function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (typeof payload.exp !== "number") return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export interface UseSessionTimeoutReturn {
  showWarning: boolean;
  countdownSeconds: number;
  onStayLoggedIn: () => Promise<void>;
  onLogOut: () => void;
}

export function useSessionTimeout(): UseSessionTimeoutReturn {
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshAccessToken = useAuthStore((s) => s.refreshAccessToken);
  const logout = useAuthStore((s) => s.logout);

  const [showWarning, setShowWarning] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(COUNTDOWN_SECONDS);

  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const isAuthPage = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  /** Clear any pending warn timer */
  const clearWarnTimer = useCallback(() => {
    if (warnTimerRef.current !== null) {
      clearTimeout(warnTimerRef.current);
      warnTimerRef.current = null;
    }
  }, []);

  /** Schedule (or reschedule) the warning based on the current token */
  const scheduleWarning = useCallback(
    (token: string) => {
      clearWarnTimer();
      setShowWarning(false);

      const expiryMs = getTokenExpiryMs(token);
      if (!expiryMs) return;

      const msUntilWarn = expiryMs - Date.now() - WARN_BEFORE_EXPIRY_S * 1000;
      if (msUntilWarn <= 0) {
        // Token expires within the warning window — show immediately
        setCountdownSeconds(Math.max(0, Math.floor((expiryMs - Date.now()) / 1000)));
        setShowWarning(true);
        return;
      }

      warnTimerRef.current = setTimeout(() => {
        // Check activity debounce: suppress if user was active very recently
        const idleMs = Date.now() - lastActivityRef.current;
        if (idleMs < ACTIVITY_DEBOUNCE_MS) {
          // User is active — reschedule check in (ACTIVITY_DEBOUNCE_MS - idleMs) ms
          warnTimerRef.current = setTimeout(() => {
            setCountdownSeconds(COUNTDOWN_SECONDS);
            setShowWarning(true);
          }, ACTIVITY_DEBOUNCE_MS - idleMs);
          return;
        }
        setCountdownSeconds(COUNTDOWN_SECONDS);
        setShowWarning(true);
      }, msUntilWarn);
    },
    [clearWarnTimer],
  );

  // Re-schedule whenever token changes
  useEffect(() => {
    if (!isAuthenticated || !accessToken || isAuthPage) {
      clearWarnTimer();
      setShowWarning(false);
      return;
    }
    scheduleWarning(accessToken);
    return clearWarnTimer;
  }, [accessToken, isAuthenticated, isAuthPage, scheduleWarning, clearWarnTimer]);

  // Track user activity
  useEffect(() => {
    if (!isAuthenticated || isAuthPage) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("click", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });

    return () => {
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [isAuthenticated, isAuthPage]);

  const onStayLoggedIn = useCallback(async () => {
    setShowWarning(false);
    clearWarnTimer();
    await refreshAccessToken();
    // refreshAccessToken updates accessToken in the store → the token-change
    // effect above will re-schedule the warning for the new token automatically.
  }, [clearWarnTimer, refreshAccessToken]);

  const onLogOut = useCallback(() => {
    setShowWarning(false);
    clearWarnTimer();
    logout();
  }, [clearWarnTimer, logout]);

  return { showWarning, countdownSeconds, onStayLoggedIn, onLogOut };
}
