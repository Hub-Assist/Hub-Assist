"use client";

import { AlertCircle } from "lucide-react";

interface SectionErrorFallbackProps {
  message?: string;
  section?: string;
  onRetry: () => void;
  reportEmail?: string;
}

export function SectionErrorFallback({
  message,
  section,
  onRetry,
  reportEmail = "support@hubassist.com",
}: SectionErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center bg-red-50 rounded-lg border border-red-100">
      <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
      <h3 className="text-lg font-semibold text-red-800 mb-1">Something went wrong</h3>
      <p className="text-sm text-red-600">
        {message || "An error occurred while loading this section. Please try again."}
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 rounded transition-colors"
        >
          Try Again
        </button>
        {reportEmail && (
          <a
            href={`mailto:${reportEmail}?subject=${encodeURIComponent(
              `Error report${section ? `: ${section}` : ""}`
            )}`}
            className="text-sm text-red-700 underline hover:text-red-900"
          >
            Report Issue
          </a>
        )}
      </div>
    </div>
  );
}
