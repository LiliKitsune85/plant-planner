import { Button } from '@/components/ui/button'

type PlantsLoadMoreProps = {
  canLoadMore: boolean
  pending: boolean
  errorMessage?: string
  onLoadMore: () => void
}

export const PlantsLoadMore = ({
  canLoadMore,
  pending,
  errorMessage,
  onLoadMore,
}: PlantsLoadMoreProps) => {
  if (!canLoadMore) return null

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" disabled={pending} onClick={onLoadMore}>
        {pending ? 'Ładowanie…' : 'Załaduj więcej'}
      </Button>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  )
}

PlantsLoadMore.displayName = 'PlantsLoadMore'
