export const PlantEditSkeleton = () => {
  return (
    <div className="space-y-6 rounded-xl border border-dashed border-border/60 p-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="h-32 w-full rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="h-10 w-1/2 rounded bg-muted" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="h-10 w-32 rounded bg-muted" />
        <div className="h-10 w-32 rounded bg-muted" />
      </div>
    </div>
  )
}

PlantEditSkeleton.displayName = 'PlantEditSkeleton'
