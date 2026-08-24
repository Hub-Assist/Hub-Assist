"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { api } from "@/lib/apiClient";
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
    mutationFn: (newEmail: string) => api.subscribeNewsletter(newEmail),
    onSuccess: () => {
      setIsSubmitted(true);
      showToast("success", "Successfully subscribed to the newsletter!");
      setEmail("");
    },
    onError: (error: AxiosError) => {
      if (error.response?.status === 409) {
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
