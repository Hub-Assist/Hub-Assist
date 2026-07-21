"use client";

import { useAdaptivePolling, type AdaptivePollingState } from "./useAdaptivePolling";
import type { ConnectionStatus } from "@/components/dashboard/ConnectionIndicator";

export interface DashboardPollingState extends AdaptivePollingState {
  /** Connection status for UI indicators */
  connectionStatus: ConnectionStatus;
}

/**
 * Centralized polling hook for dashboard components
 * Provides consistent polling behavior and connection status across the dashboard
 */
export function useDashboardPolling(): DashboardPollingState {
  const pollingState = useAdaptivePolling({
    baseInterval: 30000, // 30 seconds
    maxErrors: 3,
    respectVisibility: true,
  });

  // Determine connection status based on polling state
  const getConnectionStatus = (): ConnectionStatus => {
    if (pollingState.isDisconnected) {
      return "disconnected";
    }
    
    if (pollingState.errorCount > 0) {
      return "backoff";
    }
    
    if (pollingState.isVisibilityPaused) {
      return "connected"; // Still connected, just paused
    }
    
    // Check if currently polling (this is a simplification - in real usage, 
    // you might track pending requests)
    return "connected";
  };

  return {
    ...pollingState,
    connectionStatus: getConnectionStatus(),
  };
}