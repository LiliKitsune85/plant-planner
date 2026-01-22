import { z } from "zod";

import type { SignUpCommand } from "../../../types";
import { HttpError } from "../../http/errors";

const signUpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "E-mail jest wymagany.")
      .max(320, "E-mail jest za długi.")
      .email("Podaj poprawny adres e-mail."),
    password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków.").max(160, "Hasło jest za długie."),
    nickname: z.string().max(60, "Pseudonim może mieć maks. 60 znaków.").optional().nullable(),
    timezone: z.string().trim().min(1, "Strefa czasowa jest wymagana.").max(64),
    returnTo: z.string().optional().nullable(),
  })
  .strict();

export interface SignUpRequestPayload extends SignUpCommand {
  returnTo?: string | null;
}

const normalizeReturnTo = (value?: string | null): string | null => {
  if (!value) return null;
  return value.startsWith("/") ? value : null;
};

export const parseSignUpRequest = (body: unknown): SignUpRequestPayload => {
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(422, "Invalid sign-up payload", "VALIDATION_ERROR", {
      issues: parsed.error.issues,
    });
  }

  return {
    email: parsed.data.email,
    password: parsed.data.password,
    nickname: parsed.data.nickname?.trim() ? parsed.data.nickname.trim() : null,
    timezone: parsed.data.timezone,
    returnTo: normalizeReturnTo(parsed.data.returnTo),
  };
};
