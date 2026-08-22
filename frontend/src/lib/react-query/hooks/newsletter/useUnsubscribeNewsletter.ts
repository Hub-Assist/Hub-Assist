"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { queryKeys } from "@/lib/react-query/keys/queryKeys";

export function useUnsubscribeNewsletter(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["newsletter", "unsubscribe", token],
    mutationFn: () => api.unsubscribeNewsletter(token),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.newsletter.preferences(token) });
    },
  });
}
