import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = React.createContext<{
  toasts: ToastProps[]
  addToast: (toast: Omit<ToastProps, "id">) => void
  removeToast: (id: string) => void
} | null>(null)

export interface ToastProps {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  duration?: number
}

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between overflow-hidden rounded-xl border p-4 pr-10 shadow-lg backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-zinc-900/95 text-zinc-100",
        destructive:
          "border-red-500/20 bg-red-950/90 text-red-50",
        success:
          "border-emerald-500/20 bg-emerald-950/90 text-emerald-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface ToastComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  onClose?: () => void
  duration?: number
  isExiting?: boolean
}

const Toast = React.forwardRef<HTMLDivElement, ToastComponentProps>(
  ({ className, variant, onClose, duration = 4000, isExiting, children, ...props }, ref) => {
    // Use role="alert" for destructive toasts (implies assertive), role="status" for others
    const isDestructive = variant === "destructive"
    const role = isDestructive ? "alert" : "status"
    // Only set aria-live for non-destructive toasts (role="alert" already implies assertive)
    const ariaLive = isDestructive ? undefined : "polite"

    return (
      <div
        ref={ref}
        className={cn(
          toastVariants({ variant }),
          isExiting ? "animate-toast-exit" : "animate-toast-enter",
          className
        )}
        role={role}
        aria-live={ariaLive}
        {...props}
      >
        {children}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-current/50 transition-all hover:bg-white/10 hover:text-current focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-xl">
          <div 
            className={cn(
              "h-full rounded-full",
              variant === "destructive" && "bg-red-400/50",
              variant === "success" && "bg-emerald-400/50",
              (variant ?? "default") === "default" && "bg-white/20"
            )}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      </div>
    )
  }
)
Toast.displayName = "Toast"

const ToastTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-sm font-medium leading-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = "ToastTitle"

const ToastDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm opacity-80 leading-snug", className)}
    {...props}
  />
))
ToastDescription.displayName = "ToastDescription"

// Toast Container/Viewport
const ToastViewport = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "pointer-events-none fixed bottom-0 left-1/2 -translate-x-1/2 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[380px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = "ToastViewport"

export { Toast, ToastTitle, ToastDescription, ToastViewport, ToastProvider, toastVariants }
