"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { NewsletterPreferences } from "@/components/newsletter/NewsletterPreferences";
import {
  useGetNewsletterPreferences,
  useUpdateNewsletterPreferences,
  useUnsubscribeNewsletter,
} from "@/lib/react-query/hooks";
import type { PreferenceFormData } from "@/components/newsletter/NewsletterPreferences";

export default function NewsletterPreferencesPage() {
  const token = useSearchParams().get("token");
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
  } = useGetNewsletterPreferences(token);

  const updateMutation = useUpdateNewsletterPreferences(token ?? "");
  const unsubscribeMutation = useUnsubscribeNewsletter(token ?? "");

  // No token in URL
  if (!token) {
    return <InvalidTokenView reason="missing" />;
  }

  // Token validation error (404 = expired/invalid)
  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const reason = status === 404 ? "expired" : "invalid";
    return <InvalidTokenView reason={reason} />;
  }

  // Unsubscribed confirmation screen
  if (isUnsubscribed) {
    return <UnsubscribedView />;
  }

  const initialPreferences = data
    ? {
        workspaceUpdates: data.preferences.workspaceUpdates ?? true,
        community: data.preferences.community ?? true,
        promotions: data.preferences.promotions ?? true,
        productUpdates: data.preferences.productUpdates ?? true,
      }
    : undefined;

  const handleSave = async (changedPrefs: Partial<PreferenceFormData>) => {
    await updateMutation.mutateAsync(changedPrefs);
  };

  const handleUnsubscribe = async () => {
    await unsubscribeMutation.mutateAsync();
    setIsUnsubscribed(true);
  };

  return (
    <NewsletterPreferences
      initialPreferences={initialPreferences}
      onSave={handleSave}
      onUnsubscribe={handleUnsubscribe}
      isLoading={isLoading}
      isSaving={updateMutation.isPending}
      isUnsubscribing={unsubscribeMutation.isPending}
    />
  );
}

// ─── Sub-views ──────────────────────────────────────────────────────────────

interface InvalidTokenViewProps {
  reason: "missing" | "expired" | "invalid";
}

function InvalidTokenView({ reason }: InvalidTokenViewProps) {
  const messages: Record<InvalidTokenViewProps["reason"], { title: string; body: string }> = {
    missing: {
      title: "No preferences link provided",
      body: "Please use the link sent to your email to manage your preferences.",
    },
    expired: {
      title: "Link expired",
      body: "This preferences link is no longer valid. Subscribe again to get a fresh link.",
    },
    invalid: {
      title: "Invalid link",
      body: "We couldn't recognize this link. Please use the most recent link from your email.",
    },
  };

  const { title, body } = messages[reason];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#C5BEB6] p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#F3EBE2] p-8 shadow-sm text-center">
        <h1 className="mb-6 text-2xl font-semibold text-[#1A1A1A]">
          HubAssist Newsletter
        </h1>
        <div className="flex flex-col items-center gap-4">
          <XCircle className="h-10 w-10 text-[#D4916E]" />
          <p className="text-base font-medium text-[#1A1A1A]">{title}</p>
          <p className="text-sm text-[#6B6B6B]">{body}</p>
          <Link
            href="/"
            className="mt-2 inline-block rounded-full bg-[#1A1A1A] px-6 py-2.5 text-sm font-medium text-[#F3EBE2] hover:bg-[#3D3D3D] transition-colors"
          >
            Re-subscribe
          </Link>
        </div>
      </div>
    </div>
  );
}

function UnsubscribedView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#C5BEB6] p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#F3EBE2] p-8 shadow-sm text-center">
        <h1 className="mb-6 text-2xl font-semibold text-[#1A1A1A]">
          HubAssist Newsletter
        </h1>
        <div className="flex flex-col items-center gap-3">
          <p className="text-base font-medium text-[#1A1A1A]">
            You have been unsubscribed
          </p>
          <p className="text-sm text-[#6B6B6B]">
            You won&apos;t receive any further emails from us. You can always re-subscribe on our home page.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-[#6B6B6B] underline hover:text-[#1A1A1A]"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
