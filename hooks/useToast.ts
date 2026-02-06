import * as React from "react"

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 4000

type ToastVariant = "default" | "destructive" | "success"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type ToastActionType =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "UPDATE_TOAST"; toast: Partial<Toast> & { id: string } }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string }

interface ToastState {
  toasts: Toast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string, dispatch: React.Dispatch<ToastActionType>) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: "REMOVE_TOAST", toastId })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

const reducer = (state: ToastState, action: ToastActionType): ToastState => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== toastId),
      }
    }

    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }

    default:
      return state
  }
}

let count = 0

const genId = () => {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

// Global state for toasts
let memoryState: ToastState = { toasts: [] }
const listeners: Array<(state: ToastState) => void> = []

const dispatch = (action: ToastActionType) => {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

const toast = (options: ToastOptions) => {
  const id = genId()
  const duration = options.duration ?? TOAST_REMOVE_DELAY

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...options,
      id,
      duration,
    },
  })

  // Auto dismiss
  setTimeout(() => {
    dispatch({ type: "DISMISS_TOAST", toastId: id })
  }, duration)

  return {
    id,
    dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: id }),
    update: (props: Partial<ToastOptions>) =>
      dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } }),
  }
}

// Convenience methods
toast.success = (options: Omit<ToastOptions, "variant">) =>
  toast({ ...options, variant: "success" })

toast.error = (options: Omit<ToastOptions, "variant">) =>
  toast({ ...options, variant: "destructive" })

toast.dismiss = (toastId?: string) =>
  dispatch({ type: "DISMISS_TOAST", toastId })

const useToast = () => {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
