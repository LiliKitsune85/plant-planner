import { z } from "zod";

import type { SignInCommand } from "../../../types";
import { HttpError } from "../../http/errors";

const signInSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "E-mail jest wymagany.")
      .max(320, "E-mail jest za długi.")
      .email("Podaj poprawny adres e-mail."),
    password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków.").max(160, "Hasło jest za długie."),
  })
  .strict();

export const parseSignInRequest = (body: unknown): SignInCommand => {
  const parsed = signInSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(422, "Invalid sign-in payload", "VALIDATION_ERROR", {
      issues: parsed.error.issues,
    });
  }

  return parsed.data;
};
