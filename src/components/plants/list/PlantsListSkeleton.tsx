const PLACEHOLDER_ITEMS = Array.from({ length: 5 }, (_, index) => index)

export const PlantsListSkeleton = () => {
  return (
    <div className="space-y-3">
      {PLACEHOLDER_ITEMS.map((item) => (
        <div
          key={item}
          className="flex items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4"
        >
          <div className="size-12 rounded-xl bg-muted animate-pulse" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-1/2 rounded-full bg-muted animate-pulse" />
            <div className="h-3 w-1/3 rounded-full bg-muted/70 animate-pulse" />
          </div>
          <div className="h-4 w-6 rounded-full bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  )
}

PlantsListSkeleton.displayName = 'PlantsListSkeleton'
