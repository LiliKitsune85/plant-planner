import { useCallback, useEffect } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { z } from 'zod'

import { AuthErrorAlert } from '@/components/auth/AuthErrorAlert'
import { AuthNotice } from '@/components/auth/AuthNotice'
import { asAuthFormResult, authDemoClient } from '@/components/auth/demo-auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthForm } from '@/components/hooks/use-auth-form'

const schema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'E-mail jest wymagany.')
      .email('Podaj poprawny adres e-mail.'),
    password: z
      .string()
      .min(8, 'Hasło musi mieć min. 8 znaków.')
      .max(160, 'Hasło jest za długie.'),
    confirmPassword: z
      .string()
      .min(8, 'Pole wymagane.')
      .max(160, 'Hasło jest za długie.'),
    nickname: z
      .string()
      .max(60, 'Pseudonim może mieć maks. 60 znaków.')
      .optional()
      .nullable(),
    timezone: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Hasła muszą być identyczne.',
    path: ['confirmPassword'],
  })

type SignUpFormProps = {
  returnTo?: string
}

export const SignUpForm = ({ returnTo = '/calendar' }: SignUpFormProps) => {
  const { values, errors, handleSubmit, isSubmitting, successMessage, setValue } = useAuthForm({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      nickname: '',
      timezone: 'UTC',
    },
    schema,
    mapValuesToPayload: (form) => ({
      email: form.email.trim(),
      password: form.password,
      nickname: form.nickname?.trim() ? form.nickname.trim() : null,
      timezone: form.timezone,
      returnTo,
    }),
    submit: async (payload) => asAuthFormResult(await authDemoClient.signUp(payload)),
  })

  useEffect(() => {
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detectedTz && detectedTz !== values.timezone) {
      setValue('timezone', detectedTz)
    }
  }, [setValue, values.timezone])

  const fieldErrors = errors.fields

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      void handleSubmit()
    },
    [handleSubmit],
  )

  const handleInputChange = useCallback(
    (field: 'email' | 'password' | 'confirmPassword' | 'nickname') =>
      (event: ChangeEvent<HTMLInputElement>) => setValue(field, event.target.value),
    [setValue],
  )

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      {errors.form ? (
        <AuthErrorAlert title="Nie udało się utworzyć konta" description={errors.form} />
      ) : null}

      {successMessage ? (
        <AuthNotice
          tone="success"
          title="Sprawdź skrzynkę"
          description={successMessage}
        >
          <p className="text-sm text-emerald-900/80">
            Po uruchomieniu backendu automatycznie zalogujemy Cię po kliknięciu w link aktywacyjny.
          </p>
        </AuthNotice>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="sign-up-email">Adres e-mail</Label>
        <Input
          id="sign-up-email"
          type="email"
          autoComplete="email"
          placeholder="np. ola@plantplanner.app"
          value={values.email}
          onChange={handleInputChange('email')}
          aria-invalid={Boolean(fieldErrors.email?.length)}
          aria-describedby={fieldErrors.email?.length ? 'sign-up-email-errors' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrors.email?.length ? (
          <p id="sign-up-email-errors" className="text-sm text-destructive">
            {fieldErrors.email.join(' ')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Użyj adresu, który będziesz kontrolować na co dzień.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sign-up-password">Hasło</Label>
        <Input
          id="sign-up-password"
          type="password"
          autoComplete="new-password"
          placeholder="Wymyśl bezpieczne hasło"
          value={values.password}
          onChange={handleInputChange('password')}
          aria-invalid={Boolean(fieldErrors.password?.length)}
          aria-describedby={fieldErrors.password?.length ? 'sign-up-password-errors' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrors.password?.length ? (
          <p id="sign-up-password-errors" className="text-sm text-destructive">
            {fieldErrors.password.join(' ')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Minimum 8 znaków, zalecamy litery, cyfry oraz znaki specjalne.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sign-up-password-confirm">Powtórz hasło</Label>
        <Input
          id="sign-up-password-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Powtórz hasło"
          value={values.confirmPassword}
          onChange={handleInputChange('confirmPassword')}
          aria-invalid={Boolean(fieldErrors.confirmPassword?.length)}
          aria-describedby={
            fieldErrors.confirmPassword?.length ? 'sign-up-password-confirm-errors' : undefined
          }
          disabled={isSubmitting}
        />
        {fieldErrors.confirmPassword?.length ? (
          <p id="sign-up-password-confirm-errors" className="text-sm text-destructive">
            {fieldErrors.confirmPassword.join(' ')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Zadbaj o to, aby oba hasła były takie same.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sign-up-nickname">Pseudonim (opcjonalnie)</Label>
        <Input
          id="sign-up-nickname"
          placeholder="np. Domowy ogrodnik"
          value={values.nickname ?? ''}
          onChange={handleInputChange('nickname')}
          aria-invalid={Boolean(fieldErrors.nickname?.length)}
          aria-describedby={fieldErrors.nickname?.length ? 'sign-up-nickname-errors' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrors.nickname?.length ? (
          <p id="sign-up-nickname-errors" className="text-sm text-destructive">
            {fieldErrors.nickname.join(' ')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pseudonim pojawi się w menu użytkownika. Możesz go zmienić później w ustawieniach.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-border/80 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <p>
          Wykryta strefa czasowa:{' '}
          <span className="font-medium text-foreground">{values.timezone ?? 'UTC'}</span>. Użyjemy jej,
          aby prawidłowo wyliczać przypomnienia o podlewaniu.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Rejestracja…' : 'Załóż konto'}
      </Button>

      <p className="text-xs text-muted-foreground">
        Kontynuując, akceptujesz regulamin i politykę prywatności Plant Planner.
      </p>
    </form>
  )
}

SignUpForm.displayName = 'SignUpForm'
