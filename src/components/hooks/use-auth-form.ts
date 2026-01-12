import { useCallback, useState } from "react";
import { logger } from "@/lib/logger";
import type { ChangeEvent } from "react";
import type { ZodIssue, ZodSchema } from "zod";

type AuthFieldErrors = Record<string, string[]>;

export interface AuthFormSubmitSuccess<TData = void> {
  status: "success";
  message?: string;
  data?: TData;
}

export interface AuthFormSubmitError {
  status: "error";
  message: string;
  code?: string;
  fieldErrors?: AuthFieldErrors;
}

export type AuthFormSubmitResult<TData = void> = AuthFormSubmitSuccess<TData> | AuthFormSubmitError;

export interface UseAuthFormOptions<TValues extends Record<string, unknown>, TPayload, TData> {
  initialValues: TValues;
  schema: ZodSchema<TValues>;
  submit: (payload: TPayload) => Promise<AuthFormSubmitResult<TData>>;
  mapValuesToPayload?: (values: TValues) => TPayload;
  onSuccess?: (result: AuthFormSubmitSuccess<TData>, payload: TPayload) => void;
  onError?: (result: AuthFormSubmitError) => void;
  resetOnSuccess?: boolean;
}

export interface AuthFormErrors {
  form?: string;
  fields: AuthFieldErrors;
}

export const useAuthForm = <TValues extends Record<string, unknown>, TPayload = TValues, TData = void>({
  initialValues,
  schema,
  submit,
  mapValuesToPayload,
  onSuccess,
  onError,
  resetOnSuccess = false,
}: UseAuthFormOptions<TValues, TPayload, TData>) => {
  const [values, setValues] = useState<TValues>(initialValues);
  const [errors, setErrors] = useState<AuthFormErrors>({ fields: {} });
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSubmitting = status === "submitting";
  const isSuccess = status === "success";

  const resetValues = useCallback(
    (nextValues?: TValues) => {
      setValues(() => (nextValues ? { ...nextValues } : { ...initialValues }));
    },
    [initialValues]
  );

  const setValue = useCallback(<K extends keyof TValues>(field: K, nextValue: TValues[K]) => {
    setValues((prev) => {
      if (prev[field] === nextValue) return prev;
      return { ...prev, [field]: nextValue };
    });
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({ fields: {} });
  }, []);

  const clearFieldError = useCallback((field: keyof TValues | string) => {
    const fieldKey = field as string;
    setErrors((prev) => {
      if (!prev.fields[fieldKey]) return prev;
      const nextFields = Object.fromEntries(
        Object.entries(prev.fields).filter(([key]) => key !== fieldKey)
      ) as typeof prev.fields;
      return { ...prev, fields: nextFields };
    });
  }, []);

  const handleSubmit = useCallback(async (): Promise<boolean> => {
    setErrors({ fields: {} });
    setSuccessMessage(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors({
        form: "Popraw błędy i spróbuj ponownie.",
        fields: mapIssuesToFieldErrors(parsed.error.issues),
      });
      setStatus("idle");
      return false;
    }

    setStatus("submitting");

    try {
      const payload = mapValuesToPayload ? mapValuesToPayload(parsed.data) : (parsed.data as unknown as TPayload);
      const result = await submit(payload);
      if (result.status === "success") {
        setStatus("success");
        setSuccessMessage(result.message ?? null);
        if (resetOnSuccess) {
          setValues(initialValues);
        }
        onSuccess?.(result, payload);
        return true;
      }

      const fieldErrors = result.fieldErrors ?? {};
      setErrors({
        form: result.message,
        fields: fieldErrors,
      });
      setStatus("idle");
      onError?.(result);
      return false;
    } catch (error) {
      logger.error("Unhandled auth form submission error", error);
      setErrors({
        form: "Coś poszło nie tak. Spróbuj ponownie później.",
        fields: {},
      });
      setStatus("idle");
      return false;
    }
  }, [schema, values, mapValuesToPayload, submit, resetOnSuccess, initialValues, onSuccess, onError]);

  const registerInput = useCallback(
    <K extends keyof TValues & string>(field: K) => ({
      name: field,
      value: values[field] as unknown as string,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setValue(field, event.target.value as TValues[K]),
      onBlur: () => clearFieldError(field),
    }),
    [values, setValue, clearFieldError]
  );

  return {
    values,
    errors,
    status,
    isSubmitting,
    isSuccess,
    successMessage,
    setValue,
    setValues,
    handleSubmit,
    clearErrors,
    clearFieldError,
    registerInput,
    resetValues,
  };
};

const mapIssuesToFieldErrors = (issues: ZodIssue[]): AuthFieldErrors => {
  return issues.reduce<AuthFieldErrors>((acc, issue) => {
    const key = (issue.path.join(".") || "form").toString();
    const next = issue.message;
    if (acc[key]) {
      acc[key] = [...acc[key], next];
    } else {
      acc[key] = [next];
    }
    return acc;
  }, {});
};
