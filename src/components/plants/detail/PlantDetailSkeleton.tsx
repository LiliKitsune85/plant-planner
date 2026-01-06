export const PlantDetailSkeleton = () => (
  <div className="space-y-6">
    <div className="animate-pulse space-y-4 rounded-2xl border border-border/60 p-6">
      <div className="h-6 w-40 rounded bg-muted" />
      <div className="h-4 w-64 rounded bg-muted" />
      <div className="h-32 rounded-xl bg-muted" />
    </div>
    <div className="animate-pulse space-y-3 rounded-2xl border border-border/60 p-6">
      <div className="h-5 w-48 rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-4 rounded bg-muted" />
        <div className="h-4 rounded bg-muted" />
      </div>
      <div className="h-24 rounded bg-muted" />
    </div>
    <div className="animate-pulse space-y-4 rounded-2xl border border-border/60 p-6">
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="h-10 rounded bg-muted" />
    </div>
  </div>
)

PlantDetailSkeleton.displayName = 'PlantDetailSkeleton'

