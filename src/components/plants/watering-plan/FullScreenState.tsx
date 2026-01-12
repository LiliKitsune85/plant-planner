import type { FC, ReactNode } from "react";

interface FullScreenStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const FullScreenState: FC<FullScreenStateProps> = ({ title, description, action }) => {
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/60 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary/60 border-t-transparent" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
    </section>
  );
};

FullScreenState.displayName = "FullScreenState";
