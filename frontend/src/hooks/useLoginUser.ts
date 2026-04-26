"use client";

import { useMutation } from "@tanstack/react-query";
import { post } from "@/lib/apiClient";

export function useLoginUser() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      post<{ access_token: string }>("/auth/login", { email, password }),
  });
}
