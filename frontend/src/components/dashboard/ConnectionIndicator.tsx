"use client";

import { Wifi, WifiOff, Loader2, AlertCircle } from "lucide-react";

export type ConnectionStatus = "connected" | "polling" | "backoff" | "disconnected";

export interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  errorCount?: number;
  className?: string;
}

/**
 * Subtle connection status indicator for the dashboard
 * Shows current connection state with appropriate icons and colors
 */
export function ConnectionIndicator({ 
  status, 
  errorCount = 0, 
  className = "" 
}: Readonly<ConnectionIndicatorProps>) {
  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Wifi,
          color: "text-green-600",
          bgColor: "bg-green-50",
          label: "Connected",
          description: "Real-time updates active",
        };
      case "polling":
        return {
          icon: Loader2,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          label: "Syncing",
          description: "Fetching latest data",
          animate: true,
        };
      case "backoff":
        return {
          icon: AlertCircle,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          label: "Retrying",
          description: `Retry ${errorCount}/3 - reconnecting...`,
        };
      case "disconnected":
        return {
          icon: WifiOff,
          color: "text-red-600",
          bgColor: "bg-red-50",
          label: "Offline",
          description: "Connection lost - click to retry",
        };
      default:
        return {
          icon: Wifi,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          label: "Unknown",
          description: "Status unknown",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div 
      className={`inline-flex items-center gap-2 rounded-lg ${config.bgColor} px-3 py-1.5 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${config.label}. ${config.description}`}
    >
      <Icon 
        className={`h-4 w-4 ${config.color} ${config.animate ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <div className="flex flex-col">
        <span className={`text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
        <span className="text-xs text-gray-500">
          {config.description}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact version of the connection indicator for smaller spaces
 */
export function CompactConnectionIndicator({ 
  status, 
  errorCount = 0, 
  className = "" 
}: Readonly<ConnectionIndicatorProps>) {
  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Wifi,
          color: "text-green-600",
          title: "Connected - Real-time updates active",
        };
      case "polling":
        return {
          icon: Loader2,
          color: "text-blue-600",
          title: "Syncing - Fetching latest data",
          animate: true,
        };
      case "backoff":
        return {
          icon: AlertCircle,
          color: "text-yellow-600",
          title: `Retrying ${errorCount}/3 - reconnecting...`,
        };
      case "disconnected":
        return {
          icon: WifiOff,
          color: "text-red-600",
          title: "Offline - Connection lost, click to retry",
        };
      default:
        return {
          icon: Wifi,
          color: "text-gray-600",
          title: "Status unknown",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Icon 
      className={`h-4 w-4 ${config.color} ${config.animate ? "animate-spin" : ""} ${className}`}
      role="status"
      aria-label={config.title}
    />
  );
}