"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useToast } from "@/components/ui/ToastProvider";

export interface UseNewsletterFormResult {
  readonly email: string;
  readonly isSubmitted: boolean;
  readonly onChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function useNewsletterForm(): UseNewsletterFormResult {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: async (newEmail: string) => {
      const response = await axios.post("/api/newsletter/subscribe", { email: newEmail });
      return response.data;
    },
    onSuccess: () => {
      setIsSubmitted(true);
      showToast("success", "Successfully subscribed to the newsletter!");
      setEmail("");
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { status?: number } } | undefined;
      if (axiosError?.response?.status === 409) {
        showToast("error", "This email is already subscribed.");
      } else {
        showToast("error", "An error occurred while subscribing.");
      }
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    mutation.mutate(email);
  };

  return {
    email,
    isSubmitted,
    onChange: setEmail,
    onSubmit,
  };
}
