"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

export interface NewsletterTopic {
  id: string;
  label: string;
  description: string;
}

export interface PreferenceFormData {
  workspaceUpdates: boolean;
  community: boolean;
  promotions: boolean;
  productUpdates: boolean;
}

interface NewsletterPreferencesProps {
  initialPreferences?: PreferenceFormData;
  onSave: (data: Partial<PreferenceFormData>) => Promise<void>;
  onUnsubscribe: () => Promise<void>;
  isLoading?: boolean;
  isSaving?: boolean;
  isUnsubscribing?: boolean;
}

const topics: Array<NewsletterTopic & { key: keyof PreferenceFormData }> = [
  {
    id: "workspace-updates",
    key: "workspaceUpdates",
    label: "Workspace Updates",
    description: "News about workspace availability, new spaces, and facility updates.",
  },
  {
    id: "community",
    key: "community",
    label: "Community Events",
    description: "Invitations to networking events, workshops, and community gatherings.",
  },
  {
    id: "promotions",
    key: "promotions",
    label: "Promotions & Offers",
    description: "Special discounts, seasonal offers, and exclusive deals.",
  },
  {
    id: "product-updates",
    key: "productUpdates",
    label: "Product Updates",
    description: "Platform improvements, new features, and service enhancements.",
  },
];

export function NewsletterPreferences({
  initialPreferences,
  onSave,
  onUnsubscribe,
  isLoading = false,
  isSaving = false,
  isUnsubscribing = false,
}: NewsletterPreferencesProps) {
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isDirty, dirtyFields },
  } = useForm<PreferenceFormData>({
    defaultValues: initialPreferences || {
      workspaceUpdates: true,
      community: true,
      promotions: true,
      productUpdates: true,
    },
  });

  // Reset form when initialPreferences change
  useEffect(() => {
    if (initialPreferences) {
      reset(initialPreferences);
    }
  }, [initialPreferences, reset]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const onSubmit = async (data: PreferenceFormData) => {
    // Only send changed fields
    const changedData: Partial<PreferenceFormData> = {};
    Object.keys(dirtyFields).forEach((key) => {
      changedData[key as keyof PreferenceFormData] = data[key as keyof PreferenceFormData];
    });

    if (Object.keys(changedData).length === 0) {
      return; // No changes to save
    }

    await onSave(changedData);
    reset(data); // Reset dirty state after successful save
    setSaveSuccess(true);
  };

  const allValues = watch();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#C5BEB6] p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-[#F3EBE2] p-8 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-[#6B6B6B]">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading your preferences…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#C5BEB6] p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#F3EBE2] p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">Newsletter Preferences</h1>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            Choose the topics you&apos;d like to receive updates about.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Topic Toggles */}
          <div className="space-y-4">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className={cn(
                  "flex items-start gap-4 rounded-lg border p-4 transition-colors",
                  allValues[topic.key]
                    ? "border-[#1A1A1A] bg-white"
                    : "border-[#D7CFC6] bg-[#EDE2D6]"
                )}
              >
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    id={topic.id}
                    {...register(topic.key)}
                    className="mt-1 h-5 w-5 rounded border-[#D7CFC6] text-[#1A1A1A] focus:ring-2 focus:ring-[#1A1A1A] focus:ring-offset-2"
                  />
                  <label htmlFor={topic.id} className="flex-1 cursor-pointer">
                    <div className="font-medium text-[#1A1A1A]">{topic.label}</div>
                    <div className="mt-1 text-sm text-[#6B6B6B]">{topic.description}</div>
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-[#6B6B6B] underline hover:text-[#1A1A1A]"
                    >
                      Privacy Policy
                    </a>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Unsaved Changes Indicator */}
          {isDirty && (
            <div className="flex items-center gap-2 rounded-lg bg-[#FFF8E1] px-4 py-3 text-sm text-[#1A1A1A]">
              <AlertCircle className="h-4 w-4" />
              <span>You have unsaved changes</span>
            </div>
          )}

          {/* Success Message */}
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-[#E8F5E9] px-4 py-3 text-sm text-[#1A1A1A]">
              <CheckCircle2 className="h-4 w-4 text-[#A8C5A0]" />
              <span>Preferences saved successfully</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="submit"
              variant="primary"
              disabled={!isDirty || isSaving}
              loading={isSaving}
              className="w-full sm:w-auto"
            >
              Save Preferences
            </Button>

            <button
              type="button"
              onClick={onUnsubscribe}
              disabled={isUnsubscribing || isSaving}
              className={cn(
                "text-sm text-[#D4916E] underline hover:text-[#c07a58] disabled:opacity-50 disabled:pointer-events-none",
                isUnsubscribing && "flex items-center gap-2"
              )}
            >
              {isUnsubscribing && <Loader2 className="h-3 w-3 animate-spin" />}
              Unsubscribe from all emails
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
