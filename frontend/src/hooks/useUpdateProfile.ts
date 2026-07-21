"use client";

import { useMutation } from "@tanstack/react-query";
import { patch } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/store/authStore";
import { useToast } from "@/components/ui/ToastProvider";
import type { User } from "@/types/user";

export interface UpdateProfilePayload {
  firstname?: string;
  lastname?: string;
  stellarPublicKey?: string;
}

/**
 * useMutation hook that PATCHes /api/users/:id, then syncs the Zustand
 * authStore and shows a toast on success or failure.
 */
export function useUpdateProfile() {
  const { showToast } = useToast();
  const { user, updateUser } = useAuthStore();

  return useMutation<User, Error, UpdateProfilePayload>({
    mutationFn: (payload: UpdateProfilePayload) => {
      if (!user?.id) {
        return Promise.reject(new Error("User not authenticated"));
      }
      return patch<User>(`/users/${user.id}`, payload);
    },
    onSuccess: (_data, variables) => {
      // Sync the Zustand store so the UI reflects the new values immediately
      updateUser(variables);
      showToast("success", "Profile updated successfully");
    },
    onError: () => {
      showToast("error", "Failed to update profile");
    },
  });
}
