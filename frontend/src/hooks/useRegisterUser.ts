"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useRegisterUser() {
  return useMutation({
    mutationFn: (data: { firstname: string; lastname: string; email: string; password: string }) =>
      api.register(data),
  });
}
