"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { queryKeys } from "@/lib/react-query/keys/queryKeys";
import type { NewsletterPreferences } from "@/types/newsletter";

export function useUpdateNewsletterPreferences(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["newsletter", "preferences", "update", token],
    mutationFn: (preferences: Partial<NewsletterPreferences>) =>
      api.updateNewsletterPreferences(token, preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.newsletter.preferences(token) });
    },
  });
}
