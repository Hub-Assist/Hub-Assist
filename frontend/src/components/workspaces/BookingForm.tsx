"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Workspace } from "@/types/workspace";
import { api } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/store/authStore";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { bookingSchema, type BookingFormValues } from "@/lib/schemas/bookingSchema";

interface BookingFormProps {
  workspace?: Workspace;
  onBookingSuccess?: () => void;
}

export function BookingForm({ workspace, onBookingSuccess }: BookingFormProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();
  const [isBooking, setIsBooking] = useState(false);

  const { data: workspacesResponse, isLoading: isLoadingWorkspaces, isError: isErrorWorkspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.getWorkspaces(),
    enabled: !workspace, // only fetch if a specific workspace isn't provided
  });
  
  const workspaces = workspacesResponse?.workspaces || [];

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      workspaceId: workspace?.id || "",
      startTime: "",
      endTime: "",
    },
  });

  const watchedWorkspaceId = form.watch("workspaceId");
  const watchedStartTime = form.watch("startTime");
  const watchedEndTime = form.watch("endTime");

  // Determine the selected workspace
  const selectedWorkspace = workspace || workspaces.find((w) => w.id === watchedWorkspaceId);

  const calculateTotal = () => {
    if (!watchedStartTime || !watchedEndTime || !selectedWorkspace) return 0;
    const start = new Date(watchedStartTime);
    const end = new Date(watchedEndTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.max(0, hours * selectedWorkspace.pricePerHour);
  };

  const handleSubmit = async (data: BookingFormValues) => {
    if (!token) {
      showToast("error", "Please log in to book a workspace");
      return;
    }

    setIsBooking(true);
    try {
      await api.createBooking({
        workspaceId: data.workspaceId,
        startTime: data.startTime,
        endTime: data.endTime,
      });
      showToast("success", "Booking created successfully");
      form.reset();
      onBookingSuccess?.();
    } catch {
      showToast("error", "Failed to create booking");
    } finally {
      setIsBooking(false);
    }
  };

  const total = calculateTotal();
  const isWorkspaceUnavailable = selectedWorkspace ? !selectedWorkspace.availability : false;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Book a Workspace</h3>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {!workspace && (
          <div>
            <label className="block text-sm font-medium mb-2">Workspace</label>
            <select
              {...form.register("workspaceId")}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a workspace</option>
              {isLoadingWorkspaces ? (
                <option value="" disabled>Loading workspaces...</option>
              ) : isErrorWorkspaces ? (
                <option value="" disabled>Failed to load workspaces.</option>
              ) : (
                workspaces.map((w) => (
                  <option key={w.id} value={w.id} disabled={!w.availability}>
                    {w.name} - ${w.pricePerHour}/hr {!w.availability ? "(Unavailable)" : ""}
                  </option>
                ))
              )}
            </select>
            {form.formState.errors.workspaceId && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.workspaceId.message}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">Start Time</label>
          <Input
            type="datetime-local"
            {...form.register("startTime")}
          />
          {form.formState.errors.startTime && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.startTime.message}
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">End Time</label>
          <Input
            type="datetime-local"
            {...form.register("endTime")}
          />
          {form.formState.errors.endTime && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.endTime.message}
            </p>
          )}
        </div>

        {total > 0 && (
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm text-gray-600">Total Price</p>
            <p className="text-lg font-semibold">${total.toFixed(2)}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isBooking || isWorkspaceUnavailable || !watchedWorkspaceId}
        >
          {isBooking 
            ? "Booking..." 
            : isWorkspaceUnavailable 
              ? "Unavailable" 
              : "Confirm Booking"}
        </Button>
      </form>
    </div>
  );
}