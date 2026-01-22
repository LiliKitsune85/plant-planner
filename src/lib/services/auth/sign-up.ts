import type { SupabaseClient } from "../../../db/supabase.client";
import { logger } from "@/lib/logger";
import type { ProfileDto, SignUpCommand, SignUpResultDto } from "../../../types";
import { HttpError } from "../../http/errors";

type ProfileRow = ProfileDto;

const toProfileDto = (userId: string, profile: ProfileRow | null): ProfileDto => ({
  user_id: userId,
  nickname: profile?.nickname ?? null,
  timezone: profile?.timezone ?? "UTC",
});

const mapSignUpError = (error: unknown): never => {
  const status =
    typeof (error as { status?: number } | null)?.status === "number"
      ? (error as { status: number }).status
      : undefined;
  const message = typeof (error as { message?: string } | null)?.message === "string" ? error.message : "";
  const normalized = message.toLowerCase();

  if (status === 429) {
    throw new HttpError(429, "Zbyt wiele prób rejestracji. Spróbuj ponownie później.", "RATE_LIMITED");
  }

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    throw new HttpError(409, "Konto z tym adresem e-mail już istnieje.", "EMAIL_ALREADY_REGISTERED", {
      fieldErrors: { email: ["Konto z tym adresem e-mail już istnieje."] },
    });
  }

  throw new HttpError(400, "Nie udało się utworzyć konta.", "SIGN_UP_FAILED");
};

const upsertProfile = async (
  supabaseAdmin: SupabaseClient,
  userId: string,
  command: SignUpCommand
): Promise<ProfileDto | null> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        nickname: command.nickname ?? null,
        timezone: command.timezone,
      },
      { onConflict: "user_id" }
    )
    .select("user_id,nickname,timezone")
    .maybeSingle();

  if (error) {
    logger.error("signUp profile upsert failed", { error, userId });
    return null;
  }

  return data ?? null;
};

export const signUp = async (
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseClient,
  credentials: SignUpCommand,
  redirectTo?: string
): Promise<SignUpResultDto> => {
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        nickname: credentials.nickname ?? null,
        timezone: credentials.timezone,
      },
    },
  });

  if (error || !data.user) {
    mapSignUpError(error);
  }

  const user = data.user;
  const profileRow = await upsertProfile(supabaseAdmin, user.id, credentials);
  const profile = toProfileDto(user.id, profileRow);

  return {
    user: {
      id: user.id,
      email: user.email ?? credentials.email,
    },
    profile,
  };
};
