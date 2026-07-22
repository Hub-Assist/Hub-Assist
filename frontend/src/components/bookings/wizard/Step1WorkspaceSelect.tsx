"use client";

import { useQuery } from "@tanstack/react-query";
import type { Workspace } from "@/types/workspace";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/Button";
import { useBookingWizardStore } from "@/lib/store/bookingWizardStore";

interface Props {
  onNext: () => void;
}

export function Step1WorkspaceSelect({ onNext }: Props) {
  const workspaceId = useBookingWizardStore((s) => s.workspaceId);
  const setWorkspaceId = useBookingWizardStore((s) => s.setWorkspaceId);
  const canAdvance = useBookingWizardStore((s) => s.canAdvance);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.getWorkspaces(),
  });

  const workspaces: Workspace[] = data?.workspaces ?? [];

  if (isLoading) return <p className="text-sm text-[#6B6B6B]">Loading workspaces…</p>;
  if (isError) return <p className="text-sm text-red-600">Failed to load workspaces.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {workspaces.map((workspace) => (
          <button
            key={workspace.id}
            type="button"
            disabled={!workspace.availability}
            onClick={() => setWorkspaceId(workspace.id)}
            className={`text-left rounded-2xl border p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              workspaceId === workspace.id
                ? "border-[#1A1A1A] bg-[#F3EBE2]"
                : "border-[#D7CFC6] bg-transparent hover:border-[#1A1A1A]"
            }`}
          >
            <p className="font-semibold text-[#1A1A1A] text-sm">{workspace.name}</p>
            <p className="text-xs text-[#6B6B6B]">
              ${workspace.pricePerHour}/hr {!workspace.availability && "(Unavailable)"}
            </p>
          </button>
        ))}
      </div>

      <Button onClick={onNext} disabled={!canAdvance(1)} className="w-fit">
        Next
      </Button>
    </div>
  );
}
