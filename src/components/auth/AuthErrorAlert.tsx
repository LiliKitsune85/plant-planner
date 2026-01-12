import type { ReactNode } from "react";

import { AlertCircle } from "lucide-react";

interface AuthErrorAlertProps {
  title?: string;
  description?: ReactNode;
  children?: ReactNode;
}

export const AuthErrorAlert = ({ title, description, children }: AuthErrorAlertProps) => {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold tracking-tight">{title ?? "Nie udało się zrealizować żądania"}</p>
        {description ? <p className="text-destructive/90">{description}</p> : null}
        {children}
      </div>
    </div>
  );
};

AuthErrorAlert.displayName = "AuthErrorAlert";
