import { useCallback } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { z } from "zod";

import { AuthErrorAlert } from "@/components/auth/AuthErrorAlert";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { asAuthFormResult, authDemoClient } from "@/components/auth/demo-auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthForm } from "@/components/hooks/use-auth-form";

const schema = z
  .object({
    password: z.string().min(8, "Hasło musi mieć min. 8 znaków.").max(160, "Hasło jest za długie."),
    confirmPassword: z.string().min(8, "Powtórz hasło.").max(160, "Hasło jest za długie."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Hasła muszą być identyczne.",
    path: ["confirmPassword"],
  });

export const ResetPasswordForm = () => {
  const { values, errors, handleSubmit, isSubmitting, successMessage, setValue } = useAuthForm({
    initialValues: { password: "", confirmPassword: "" },
    schema,
    mapValuesToPayload: (form) => ({ password: form.password }),
    submit: async (payload) => asAuthFormResult(await authDemoClient.resetPassword(payload)),
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
    (field: "password" | "confirmPassword") => (event: ChangeEvent<HTMLInputElement>) =>
      setValue(field, event.target.value),
    [setValue]
  );

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      {errors.form ? <AuthErrorAlert title="Nie udało się ustawić hasła" description={errors.form} /> : null}

      {successMessage ? (
        <AuthNotice tone="success" title="Hasło zostało zaktualizowane" description={successMessage}>
          <p className="text-sm text-emerald-900/80">
            Po wdrożeniu backendu sesja odzyskiwania zostanie zamknięta, a my poprosimy Cię o ponowne zalogowanie.
          </p>
        </AuthNotice>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="reset-password">Nowe hasło</Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          placeholder="Wpisz nowe hasło"
          value={values.password}
          onChange={handleInputChange("password")}
          aria-invalid={Boolean(fieldErrors.password?.length)}
          aria-describedby={fieldErrors.password?.length ? "reset-password-errors" : undefined}
          disabled={isSubmitting}
        />
        {fieldErrors.password?.length ? (
          <p id="reset-password-errors" className="text-sm text-destructive">
            {fieldErrors.password.join(" ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Minimum 8 znaków, dla bezpieczeństwa zalecamy litery, cyfry i znaki specjalne.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-password-confirm">Powtórz hasło</Label>
        <Input
          id="reset-password-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Powtórz nowe hasło"
          value={values.confirmPassword}
          onChange={handleInputChange("confirmPassword")}
          aria-invalid={Boolean(fieldErrors.confirmPassword?.length)}
          aria-describedby={fieldErrors.confirmPassword?.length ? "reset-password-confirm-errors" : undefined}
          disabled={isSubmitting}
        />
        {fieldErrors.confirmPassword?.length ? (
          <p id="reset-password-confirm-errors" className="text-sm text-destructive">
            {fieldErrors.confirmPassword.join(" ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Powtórz dokładnie to samo hasło co powyżej.</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Zapisywanie…" : "Ustaw nowe hasło"}
      </Button>
    </form>
  );
};

ResetPasswordForm.displayName = "ResetPasswordForm";
