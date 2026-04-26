"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@zod/zod";
import { z } from "zod";
import { Workspace, BookingFormData } from "@/types/workspace";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const bookingSchema = z.object({
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: "End time must be after start time",
  path: ["endTime"],
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  workspace: Workspace;
  onBookingSuccess?: () => void;
}

export function BookingForm({ workspace, onBookingSuccess }: BookingFormProps) {
  const { token } = useAuthStore();
  const { showToast } = useToast();
  const [isBooking, setIsBooking] = useState(false);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
  });

  const watchedStartTime = form.watch("startTime");
  const watchedEndTime = form.watch("endTime");

  const calculateTotal = () => {
    if (!watchedStartTime || !watchedEndTime) return 0;
    const start = new Date(watchedStartTime);
    const end = new Date(watchedEndTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.max(0, hours * workspace.pricePerHour);
  };

  const handleSubmit = async (data: BookingFormValues) => {
    if (!token) {
      showToast("error", "Please log in to book a workspace");
      return;
    }

    setIsBooking(true);
    try {
      await api.createBooking(token, {
        workspaceId: workspace.id,
        startTime: data.startTime,
        endTime: data.endTime,
      });
      showToast("success", "Booking created successfully");
      form.reset();
      onBookingSuccess?.();
    } catch (error) {
      showToast("error", "Failed to create booking");
    } finally {
      setIsBooking(false);
    }
  };

  const total = calculateTotal();

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Book This Workspace</h3>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
          disabled={isBooking || !workspace.availability}
        >
          {isBooking ? "Booking..." : workspace.availability ? "Confirm Booking" : "Unavailable"}
        </Button>
      </form>
    </div>
  );
}