import { useCallback } from "react";
import { logger } from "@/lib/logger";
import type { ChangeEvent, FormEvent } from "react";
import { z } from "zod";

import { AuthErrorAlert } from "@/components/auth/AuthErrorAlert";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthForm } from "@/components/hooks/use-auth-form";
import { AuthApiError, signIn as signInRequest } from "@/lib/services/auth/auth-client";
import type { SignInCommand } from "@/types";

const schema = z.object({
  email: z.string().trim().min(1, "E-mail jest wymagany.").email("Podaj poprawny adres e-mail."),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków.").max(160, "Hasło jest za długie."),
});

interface SignInFormProps {
  returnTo?: string;
}

type SignInFormValues = z.infer<typeof schema>;
type SignInPayload = SignInCommand & { returnTo: string };

export const SignInForm = ({ returnTo = "/calendar" }: SignInFormProps) => {
  const { values, errors, handleSubmit, isSubmitting, successMessage, setValue } = useAuthForm<
    SignInFormValues,
    SignInPayload
  >({
    initialValues: {
      email: "",
      password: "",
    },
    schema,
    mapValuesToPayload: (form) => ({
      email: form.email,
      password: form.password,
      returnTo,
    }),
    submit: async (payload) => {
      try {
        await signInRequest({
          email: payload.email,
          password: payload.password,
        });
        return {
          status: "success",
          message: "Logowanie zakończone. Przekierowujemy Cię do panelu.",
        };
      } catch (error) {
        if (error instanceof AuthApiError) {
          return {
            status: "error",
            code: error.code,
            message: error.message,
            fieldErrors: error.fieldErrors,
          };
        }

        logger.error("SignInForm submit failed", error);

        return {
          status: "error",
          message: "Nie udało się zalogować. Spróbuj ponownie później.",
        };
      }
    },
    onSuccess: (_, payload) => {
      window.location.assign(payload.returnTo);
    },
  });

  const fieldErrors = errors.fields;

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleSubmit();
    },
    [handleSubmit]
  );

  const handleInputChange = useCallback(
    (field: "email" | "password") => (event: ChangeEvent<HTMLInputElement>) => setValue(field, event.target.value),
    [setValue]
  );

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      {errors.form ? <AuthErrorAlert title="Nie udało się zalogować" description={errors.form} /> : null}

      {successMessage ? <AuthNotice tone="success" title="Logowanie zakończone" description={successMessage} /> : null}

      <div className="space-y-2">
        <Label htmlFor="auth-email">Adres e-mail</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          placeholder="np. ola@plantplanner.app"
          value={values.email}
          onChange={handleInputChange("email")}
          aria-invalid={Boolean(fieldErrors.email?.length)}
          aria-describedby={fieldErrors.email?.length ? "auth-email-errors" : undefined}
          disabled={isSubmitting}
          data-testid="auth-email-input"
        />
        {fieldErrors.email?.length ? (
          <p id="auth-email-errors" className="text-sm text-destructive">
            {fieldErrors.email.join(" ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Użyj adresu powiązanego z Twoim kontem Plant Planner.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="auth-password">Hasło</Label>
        <Input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          placeholder="Wpisz hasło"
          value={values.password}
          onChange={handleInputChange("password")}
          aria-invalid={Boolean(fieldErrors.password?.length)}
          aria-describedby={fieldErrors.password?.length ? "auth-password-errors" : undefined}
          disabled={isSubmitting}
          data-testid="auth-password-input"
        />
        {fieldErrors.password?.length ? (
          <p id="auth-password-errors" className="text-sm text-destructive">
            {fieldErrors.password.join(" ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Minimum 8 znaków. Po trzykrotnym błędzie zastosujemy blokadę czasową.
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="auth-submit-button">
        {isSubmitting ? "Logowanie…" : "Zaloguj się"}
      </Button>
    </form>
  );
};

SignInForm.displayName = "SignInForm";
