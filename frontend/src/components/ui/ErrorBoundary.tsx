"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { SectionErrorFallback } from "./SectionErrorFallback";
import { reportError, type ErrorReportContext } from "@/lib/errorTracking";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  message?: string;
  section?: string;
  onError?: (context: ErrorReportContext) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context: ErrorReportContext = {
      error,
      componentStack: errorInfo.componentStack ?? "",
      section: this.props.section,
    };

    if (this.props.onError) {
      this.props.onError(context);
    } else {
      reportError(context);
    }
  }

  private resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SectionErrorFallback
          message={this.props.message}
          section={this.props.section}
          onRetry={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}
