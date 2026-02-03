import {
  Toast,
  ToastDescription,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/useToast"
import { AlertTriangle, CheckCircle, Info } from "lucide-react"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  const getIcon = (variant?: string) => {
    switch (variant) {
      case "destructive":
        return <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      case "success":
        return <CheckCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      default:
        return <Info className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
    }
  }

  return (
    <ToastViewport>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          onClose={() => dismiss(toast.id)}
          className="mb-2"
        >
          <div className="flex gap-3">
            {getIcon(toast.variant)}
            <div className="grid gap-1">
              {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
              {toast.description && (
                <ToastDescription>{toast.description}</ToastDescription>
              )}
            </div>
          </div>
        </Toast>
      ))}
    </ToastViewport>
  )
}
