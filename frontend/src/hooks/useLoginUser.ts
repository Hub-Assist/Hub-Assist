"use client";

import { useMutation } from "@tanstack/react-query";
import { post } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/store/authStore";

export function useLoginUser() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      post<{ access_token: string; user?: import("@/types/user").User }>("/auth/login", { email, password }),
    onSuccess: (data) => {
      useAuthStore.getState().login({ access_token: data.access_token, user: data.user });
      window.location.href = "/dashboard";
    },
  });
}
