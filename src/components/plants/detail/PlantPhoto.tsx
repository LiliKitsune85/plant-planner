import type { FC } from 'react'

import { cn } from '@/lib/utils'

export type PlantPhotoProps = {
  photoPath: string | null
  alt: string
  size?: 'sm' | 'md'
}

const sizeClasses: Record<NonNullable<PlantPhotoProps['size']>, string> = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
}

const isProbablyUrl = (value: string | null): boolean =>
  Boolean(value && /^https?:\/\//i.test(value))

export const PlantPhoto: FC<PlantPhotoProps> = ({ photoPath, alt, size = 'md' }) => {
  const sizeClass = sizeClasses[size]

  if (photoPath && isProbablyUrl(photoPath)) {
    return (
      <img
        src={photoPath}
        alt={alt}
        className={cn(
          sizeClass,
          'rounded-2xl border border-border object-cover shadow-sm ring-1 ring-border/50',
        )}
      />
    )
  }

  const initial = alt.trim().charAt(0).toUpperCase() || '🌱'

  return (
    <div
      className={cn(
        sizeClass,
        'flex items-center justify-center rounded-2xl border border-dashed border-border bg-muted text-3xl text-muted-foreground',
      )}
      aria-hidden="true"
    >
      {initial}
    </div>
  )
}

PlantPhoto.displayName = 'PlantPhoto'

