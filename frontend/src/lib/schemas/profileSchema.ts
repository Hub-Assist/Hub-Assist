import { z } from "zod";

export const profileSchema = z.object({
  firstname: z.string().min(2, "First name must be at least 2 characters"),
  lastname: z.string().min(2, "Last name must be at least 2 characters"),
  stellarPublicKey: z
    .string()
    .optional()
    .refine((v) => !v || /^G[A-Z2-7]{55}$/.test(v), {
      message: "Enter a valid Stellar public key (starts with G, 56 chars)",
    }),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
