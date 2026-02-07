import { useCallback, useEffect, useState } from "react"
import {
  Toast,
  ToastDescription,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast, Toast as ToastType } from "@/hooks/useToast"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"

const TOAST_REMOVE_DELAY = 4000

interface ToastWithExit extends ToastType {
  isExiting?: boolean
}

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const [localToasts, setLocalToasts] = useState<ToastWithExit[]>([])

  // Sync toasts with exit animation support
  useEffect(() => {
    const currentIds = new Set(toasts.map(t => t.id))
    const localIds = new Set(localToasts.map(t => t.id))
    
    // Add new toasts
    const newToasts = toasts.filter(t => !localIds.has(t.id))
    
    // Mark removed toasts as exiting
    const updatedLocal = localToasts.map(t => {
      if (!currentIds.has(t.id) && !t.isExiting) {
        return { ...t, isExiting: true }
      }
      return t
    })
    
    // Remove toasts that have finished exiting (after animation)
    const withoutExited = updatedLocal.filter(t => {
      if (t.isExiting) {
        // Keep it for animation, remove after delay
        return true
      }
      return currentIds.has(t.id)
    })
    
    setLocalToasts([...newToasts.map(t => ({ ...t, isExiting: false })), ...withoutExited])
  }, [toasts])

  // Clean up exiting toasts after animation
  useEffect(() => {
    const exitingToasts = localToasts.filter(t => t.isExiting)
    if (exitingToasts.length > 0) {
      const timer = setTimeout(() => {
        setLocalToasts(prev => prev.filter(t => !t.isExiting))
      }, 300) // Match exit animation duration
      return () => clearTimeout(timer)
    }
  }, [localToasts])

  const handleDismiss = useCallback((id: string) => {
    // First mark as exiting for animation
    setLocalToasts(prev => prev.map(t => 
      t.id === id ? { ...t, isExiting: true } : t
    ))
    // Then actually dismiss after animation
    setTimeout(() => {
      dismiss(id)
    }, 250)
  }, [dismiss])

  const getIcon = (variant?: string) => {
    const iconClasses = "h-5 w-5 flex-shrink-0"
    switch (variant) {
      case "destructive":
        return <AlertCircle className={cn(iconClasses, "text-red-400")} aria-hidden="true" />
      case "success":
        return <CheckCircle2 className={cn(iconClasses, "text-emerald-400")} aria-hidden="true" />
      default:
        return <Info className={cn(iconClasses, "text-blue-400")} aria-hidden="true" />
    }
  }

  return (
    <ToastViewport>
      {localToasts.map((toast, index) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          onClose={() => handleDismiss(toast.id)}
          duration={toast.duration ?? TOAST_REMOVE_DELAY}
          isExiting={toast.isExiting}
          style={{
            // Subtle stacking effect
            transform: `scale(${1 - index * 0.02})`,
            opacity: 1 - index * 0.1,
            zIndex: localToasts.length - index,
          }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {getIcon(toast.variant)}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              {toast.title && (
                <ToastTitle>{toast.title}</ToastTitle>
              )}
              {toast.description && (
                <ToastDescription className="line-clamp-2">
                  {toast.description}
                </ToastDescription>
              )}
            </div>
          </div>
        </Toast>
      ))}
    </ToastViewport>
  )
}
