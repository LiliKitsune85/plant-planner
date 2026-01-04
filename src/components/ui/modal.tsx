import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

type ModalProps = {
  open: boolean
  onClose?: () => void
  className?: string
  children: ReactNode
  labelledBy?: string
}

export const Modal = ({ open, onClose, className, children, labelledBy }: ModalProps) => {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, open])

  if (!open || !isMounted) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={() => onClose?.()}
      />
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

type ModalSectionProps = {
  className?: string
  children: ReactNode
}

export const ModalHeader = ({ className, children }: ModalSectionProps) => (
  <div className={cn('space-y-1', className)}>{children}</div>
)

export const ModalBody = ({ className, children }: ModalSectionProps) => (
  <div className={cn('space-y-4', className)}>{children}</div>
)

export const ModalFooter = ({ className, children }: ModalSectionProps) => (
  <div className={cn('flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end', className)}>
    {children}
  </div>
)

Modal.displayName = 'Modal'
ModalHeader.displayName = 'ModalHeader'
ModalBody.displayName = 'ModalBody'
ModalFooter.displayName = 'ModalFooter'
