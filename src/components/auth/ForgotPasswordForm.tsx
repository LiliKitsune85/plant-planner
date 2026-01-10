import { useCallback } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { z } from 'zod'

import { AuthErrorAlert } from '@/components/auth/AuthErrorAlert'
import { AuthNotice } from '@/components/auth/AuthNotice'
import { asAuthFormResult, authDemoClient } from '@/components/auth/demo-auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthForm } from '@/components/hooks/use-auth-form'

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'E-mail jest wymagany.')
    .email('Podaj poprawny adres e-mail.'),
})

export const ForgotPasswordForm = () => {
  const { values, errors, handleSubmit, isSubmitting, successMessage, setValue } = useAuthForm({
    initialValues: { email: '' },
    schema,
    submit: async (payload) => asAuthFormResult(await authDemoClient.forgotPassword(payload)),
    resetOnSuccess: false,
  })

  const fieldErrors = errors.fields

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      void handleSubmit()
    },
    [handleSubmit],
  )

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setValue('email', event.target.value),
    [setValue],
  )

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      {errors.form ? (
        <AuthErrorAlert title="Nie udało się wysłać wiadomości" description={errors.form} />
      ) : null}

      {successMessage ? (
        <AuthNotice
          tone="success"
          title="Jeśli konto istnieje, wyślemy e-mail"
          description={successMessage}
        >
          <p className="text-sm text-emerald-900/80">
            Ze względów bezpieczeństwa komunikat jest zawsze taki sam, niezależnie od tego, czy adres
            jest zarejestrowany.
          </p>
        </AuthNotice>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="forgot-email">Adres e-mail</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder="np. ola@plantplanner.app"
          value={values.email}
          onChange={handleInputChange}
          aria-invalid={Boolean(fieldErrors.email?.length)}
          aria-describedby={fieldErrors.email?.length ? 'forgot-email-errors' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrors.email?.length ? (
          <p id="forgot-email-errors" className="text-sm text-destructive">
            {fieldErrors.email.join(' ')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Podaj adres, który wykorzystujesz do logowania w Plant Planner.
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Wysyłanie instrukcji…' : 'Wyślij instrukcję'}
      </Button>

      <p className="text-xs text-muted-foreground">
        Po wdrożeniu backendu wiadomość będzie zawierała link prowadzący do ustawienia nowego hasła.
      </p>
    </form>
  )
}

ForgotPasswordForm.displayName = 'ForgotPasswordForm'
