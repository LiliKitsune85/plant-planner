import type { AuthFormSubmitResult } from "@/components/hooks/use-auth-form";

type AuthDemoFieldErrors = Record<string, string[]>;

export type AuthDemoResult<TData = void> =
  | {
      status: "success";
      message: string;
      data?: TData;
    }
  | {
      status: "error";
      code: AuthDemoErrorCode;
      message: string;
      fieldErrors?: AuthDemoFieldErrors;
    };

type AuthDemoErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_ALREADY_REGISTERED"
  | "PASSWORD_TOO_WEAK"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface SignInDemoPayload {
  email: string;
  password: string;
  returnTo?: string;
}

export interface SignUpDemoPayload {
  email: string;
  password: string;
  nickname?: string | null;
  timezone: string;
  returnTo?: string;
}

export interface ForgotPasswordDemoPayload {
  email: string;
}

export interface ResetPasswordDemoPayload {
  password: string;
}

const delay = (ms = 900) => new Promise((resolve) => setTimeout(resolve, ms));

const buildSuccess = (message: string): AuthDemoResult => ({
  status: "success",
  message,
});

const buildError = (code: AuthDemoErrorCode, message: string, fieldErrors?: AuthDemoFieldErrors): AuthDemoResult => ({
  status: "error",
  code,
  message,
  fieldErrors,
});

export const authDemoClient = {
  async signIn(payload: SignInDemoPayload): Promise<AuthDemoResult> {
    await delay();
    if (matches(payload.email, "limit")) {
      return buildError("RATE_LIMITED", "Zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie.");
    }
    if (matches(payload.email, "wrong") || matches(payload.password, "wrong")) {
      return buildError("INVALID_CREDENTIALS", "Nieprawidłowy e-mail lub hasło.", {
        password: ["Hasło nie pasuje do wskazanego konta."],
      });
    }
    return buildSuccess(
      "Symulowane logowanie zakończone powodzeniem. Po podpięciu backendu nastąpi przekierowanie i ustawienie sesji."
    );
  },

  async signUp(payload: SignUpDemoPayload): Promise<AuthDemoResult> {
    await delay();
    if (matches(payload.email, "exists")) {
      return buildError("EMAIL_ALREADY_REGISTERED", "Konto z tym adresem e-mail już istnieje.", {
        email: ["Użyj innego adresu lub przejdź do logowania."],
      });
    }
    if (matches(payload.password, "weak")) {
      return buildError("PASSWORD_TOO_WEAK", "Hasło jest zbyt słabe.", {
        password: ["Dodaj cyfry, znaki specjalne i wydłuż hasło."],
      });
    }
    return buildSuccess(
      "Symulowana rejestracja przebiegła pomyślnie. Sprawdź skrzynkę e-mail, aby aktywować konto po wdrożeniu backendu."
    );
  },

  async forgotPassword(payload: ForgotPasswordDemoPayload): Promise<AuthDemoResult> {
    await delay();
    const email = payload.email.trim();
    return buildSuccess(
      `Jeśli konto (${email || "podany adres"}) istnieje, wyślemy instrukcję resetu hasła. Wiadomość ma neutralną treść, aby chronić prywatność.`
    );
  },

  async resetPassword(payload: ResetPasswordDemoPayload): Promise<AuthDemoResult> {
    await delay();
    if (matches(payload.password, "weak")) {
      return buildError("PASSWORD_TOO_WEAK", "Hasło jest zbyt słabe.", {
        password: ["Hasło musi mieć min. 8 znaków i mieszane znaki."],
      });
    }
    return buildSuccess("Nowe hasło zostało zapisane (symulacja). Możesz wrócić do logowania.");
  },
};

const matches = (value: string | undefined, needle: string) =>
  Boolean(value?.toLowerCase().includes(needle.toLowerCase()));

export const asAuthFormResult = <TData = void>(result: AuthDemoResult<TData>): AuthFormSubmitResult<TData> => {
  if (result.status === "success") {
    return {
      status: "success",
      message: result.message,
      data: result.data,
    };
  }

  return {
    status: "error",
    code: result.code,
    message: result.message,
    fieldErrors: result.fieldErrors,
  };
};
