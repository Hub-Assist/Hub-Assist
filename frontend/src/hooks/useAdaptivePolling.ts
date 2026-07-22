"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface AdaptivePollingConfig {
  /** Base polling interval in milliseconds */
  baseInterval: number;
  /** Maximum consecutive errors before stopping polling */
  maxErrors?: number;
  /** Enable/disable polling based on document visibility */
  respectVisibility?: boolean;
}

export interface AdaptivePollingState {
  /** Current polling interval in milliseconds, or false if stopped */
  refetchInterval: number | false;
  /** Current error count */
  errorCount: number;
  /** Whether polling is currently paused due to visibility */
  isVisibilityPaused: boolean;
  /** Whether polling has been stopped due to max errors */
  isDisconnected: boolean;
  /** Function to reset error state and restart polling */
  reconnect: () => void;
  /** Function to increment error count */
  onError: () => void;
  /** Function to reset error count on successful request */
  onSuccess: () => void;
}

/**
 * Adaptive polling hook with exponential backoff and Visibility API integration
 * 
 * Features:
 * - Configurable base polling interval
 * - Exponential backoff: baseInterval * 2^errorCount
 * - Stops polling after maxErrors consecutive failures
 * - Pauses polling when document is hidden
 * - Provides reconnect function to reset state
 */
export function useAdaptivePolling(config: AdaptivePollingConfig): AdaptivePollingState {
  const {
    baseInterval,
    maxErrors = 3,
    respectVisibility = true,
  } = config;

  const [errorCount, setErrorCount] = useState(0);
  const [isVisibilityPaused, setIsVisibilityPaused] = useState(false);
  const visibilityHandlerRef = useRef<(() => void) | undefined>(undefined);

  // Calculate current polling interval based on error count
  const calculateInterval = useCallback((errors: number): number | false => {
    if (errors >= maxErrors) {
      return false; // Stop polling after max errors
    }
    return baseInterval * Math.pow(2, errors);
  }, [baseInterval, maxErrors]);

  const [refetchInterval, setRefetchInterval] = useState<number | false>(
    () => calculateInterval(0)
  );

  // Update interval when error count changes
  useEffect(() => {
    const newInterval = calculateInterval(errorCount);
    setRefetchInterval(newInterval);
  }, [errorCount, calculateInterval]);

  // Visibility API integration
  useEffect(() => {
    if (!respectVisibility) return;

    const handleVisibilityChange = () => {
      const isHidden = document.visibilityState === "hidden";
      setIsVisibilityPaused(isHidden);
    };

    // Store reference for cleanup
    visibilityHandlerRef.current = handleVisibilityChange;

    // Set initial state
    handleVisibilityChange();

    // Add event listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [respectVisibility]);

  // Callbacks for React Query
  const onError = useCallback(() => {
    setErrorCount((prev) => prev + 1);
  }, []);

  const onSuccess = useCallback(() => {
    setErrorCount(0);
  }, []);

  const reconnect = useCallback(() => {
    setErrorCount(0);
    setIsVisibilityPaused(document.visibilityState === "hidden");
  }, []);

  // Determine if polling should be active
  const isDisconnected = errorCount >= maxErrors;
  const effectiveInterval = isVisibilityPaused ? false : refetchInterval;

  return {
    refetchInterval: effectiveInterval,
    errorCount,
    isVisibilityPaused,
    isDisconnected,
    reconnect,
    onError,
    onSuccess,
  };
}