"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Booking } from "@/lib/apiClient";
import { mutationKeys } from "@/lib/react-query/keys/mutationKeys";
import { queryKeys } from "@/lib/react-query/keys/queryKeys";

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.bookings.cancel,
    mutationFn: (id: string) => api.cancelBooking(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookings.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.bookings.detail(id) });

      const previousBookingsList = queryClient.getQueriesData<Booking[]>({ queryKey: queryKeys.bookings.all });
      const previousBooking = queryClient.getQueryData<Booking>(queryKeys.bookings.detail(id));

      queryClient.setQueriesData<Booking[]>({ queryKey: queryKeys.bookings.all }, (old) =>
        old?.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)) ?? old
      );
      queryClient.setQueryData<Booking>(queryKeys.bookings.detail(id), (old) =>
        old ? { ...old, status: "cancelled" } : old
      );

      return { previousBookingsList, previousBooking };
    },
    onError: (_, id, context) => {
      context?.previousBookingsList.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      if (context?.previousBooking) {
        queryClient.setQueryData(queryKeys.bookings.detail(id), context.previousBooking);
      }
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
    },
  });
}
