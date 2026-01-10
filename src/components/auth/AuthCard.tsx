import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AuthLinks } from './AuthLinks'
import type { AuthLinkItem } from './AuthLinks'

type AuthCardProps = {
  eyebrow?: string
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  footerLinks?: AuthLinkItem[]
  className?: string
}

export const AuthCard = ({
  eyebrow,
  title,
  description,
  children,
  footer,
  footerLinks,
  className,
}: AuthCardProps) => {
  const hasFooterLinks = !footer && Boolean(footerLinks?.length)

  return (
    <Card className={cn('shadow-lg shadow-primary/5', className)}>
      <CardHeader className="space-y-3">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <CardTitle className="text-2xl font-semibold text-foreground">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-base leading-relaxed text-muted-foreground">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pb-8">{children}</CardContent>
      {footer ? (
        <CardFooter className="flex-col items-stretch gap-4 border-t border-border/60 bg-muted/40 py-5">
          {footer}
        </CardFooter>
      ) : hasFooterLinks ? (
        <CardFooter className="flex-col items-stretch gap-4 border-t border-border/60 bg-muted/40 py-5">
          <AuthLinks links={footerLinks!} />
        </CardFooter>
      ) : null}
    </Card>
  )
}

AuthCard.displayName = 'AuthCard'
