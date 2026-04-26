"use client";

import { useMutation } from "@tanstack/react-query";
import { post } from "@/lib/apiClient";

export function useRegisterUser() {
  return useMutation({
    mutationFn: (data: { firstname: string; lastname: string; email: string; password: string }) =>
      post<{ message: string }>("/auth/register", data),
  });
}
