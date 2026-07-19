"use client";

import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import { patch } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/store/authStore";
import { useToast } from "@/components/ui/ToastProvider";
import type { User } from "@/types/user";

export interface UpdateProfilePayload {
  firstname?: string;
  lastname?: string;
  stellarPublicKey?: string;
}

function mapToBackend(payload: UpdateProfilePayload): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  if (payload.firstname !== undefined) mapped.firstName = payload.firstname;
  if (payload.lastname !== undefined) mapped.lastName = payload.lastname;
  if (payload.stellarPublicKey !== undefined) mapped.stellarPublicKey = payload.stellarPublicKey;
  return mapped;
}

export function useUpdateProfile(
  options?: Omit<UseMutationOptions<User, Error, UpdateProfilePayload>, "mutationFn">,
) {
  const { showToast } = useToast();
  const { user, updateUser } = useAuthStore();

  return useMutation<User, Error, UpdateProfilePayload>({
    mutationFn: (payload: UpdateProfilePayload) => {
      if (!user?.id) {
        return Promise.reject(new Error("User not authenticated"));
      }
      return patch<User>(`/users/${user.id}`, mapToBackend(payload));
    },
    onSuccess: (_data, variables) => {
      updateUser(variables);
      showToast("success", "Profile updated successfully");
    },
    onError: () => {
      showToast("error", "Failed to update profile");
    },
    ...options,
  });
}
