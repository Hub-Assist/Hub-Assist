"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { mutationKeys } from "@/lib/react-query/keys/mutationKeys";
import { queryKeys } from "@/lib/react-query/keys/queryKeys";

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.bookings.create,
    mutationFn: (data: { workspaceId: string; startTime: string; endTime: string }) =>
      api.createBooking(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}
