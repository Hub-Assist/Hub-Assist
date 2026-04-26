"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useLoginUser() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
  });
}
