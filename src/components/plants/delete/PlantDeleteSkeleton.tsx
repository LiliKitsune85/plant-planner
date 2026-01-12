import type { FC } from "react";

export const PlantDeleteSkeleton: FC = () => (
  <div className="space-y-6">
    <div className="space-y-3">
      <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
      <div className="h-8 w-64 animate-pulse rounded-full bg-muted" />
      <div className="h-4 w-80 animate-pulse rounded-full bg-muted" />
    </div>
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
      <div className="mt-4 space-y-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="h-5 w-2/5 animate-pulse rounded bg-muted" />
      <div className="mt-4 space-y-2">
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  </div>
);

PlantDeleteSkeleton.displayName = "PlantDeleteSkeleton";
