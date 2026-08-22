"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { queryKeys } from "@/lib/react-query/keys/queryKeys";
import type { NewsletterPreferencesResponse } from "@/types/newsletter";

export function useGetNewsletterPreferences(token: string | null) {
  return useQuery<NewsletterPreferencesResponse>({
    queryKey: queryKeys.newsletter.preferences(token),
    queryFn: () => api.getNewsletterPreferences(token!),
    enabled: !!token,
    retry: false,
  });
}
