"use client";

import { FormEvent, useState } from "react";

export interface UseNewsletterFormResult {
  readonly email: string;
  readonly isSubmitted: boolean;
  readonly onChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function useNewsletterForm(): UseNewsletterFormResult {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setIsSubmitted(true);
  };

  return {
    email,
    isSubmitted,
    onChange: setEmail,
    onSubmit,
  };
}
