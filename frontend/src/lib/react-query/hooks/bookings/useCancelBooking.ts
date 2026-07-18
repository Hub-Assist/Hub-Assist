"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Booking } from "@/lib/apiClient";
import { mutationKeys } from "@/lib/react-query/keys/mutationKeys";

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.bookings.cancel,
    mutationFn: (id: string) => api.cancelBooking(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["bookings"] });
      await queryClient.cancelQueries({ queryKey: ["booking", id] });

      const previousBookingsList = queryClient.getQueriesData<Booking[]>({ queryKey: ["bookings"] });
      const previousBooking = queryClient.getQueryData<Booking>(["booking", id]);

      queryClient.setQueriesData<Booking[]>({ queryKey: ["bookings"] }, (old) =>
        old?.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)) ?? old
      );
      queryClient.setQueryData<Booking>(["booking", id], (old) =>
        old ? { ...old, status: "cancelled" } : old
      );

      return { previousBookingsList, previousBooking };
    },
    onError: (_, id, context) => {
      context?.previousBookingsList.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      if (context?.previousBooking) {
        queryClient.setQueryData(["booking", id], context.previousBooking);
      }
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
    },
  });
}
