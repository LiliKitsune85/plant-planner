import type { ReactNode } from "react";

import { CheckCircle2, Info } from "lucide-react";

interface AuthNoticeProps {
  tone?: "success" | "info";
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}

const toneClasses: Record<NonNullable<AuthNoticeProps["tone"]>, { container: string; text: string }> = {
  success: {
    container: "border-emerald-200 bg-emerald-50",
    text: "text-emerald-900",
  },
  info: {
    container: "border-primary/30 bg-primary/5",
    text: "text-primary/90",
  },
};

const icons = {
  success: CheckCircle2,
  info: Info,
};

export const AuthNotice = ({ tone = "info", title, description, children }: AuthNoticeProps) => {
  const classes = toneClasses[tone];
  const Icon = icons[tone];
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${classes.container} ${classes.text}`}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold tracking-tight">{title}</p>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
    </div>
  );
};

AuthNotice.displayName = "AuthNotice";
