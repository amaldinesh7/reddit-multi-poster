import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface NativeSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface NativeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  /** Options to display in the select */
  options: NativeSelectOption[]
  /** Current selected value */
  value?: string
  /** Callback when value changes */
  onValueChange?: (value: string) => void
  /** Placeholder text when no value is selected */
  placeholder?: string
  /** Additional class name for the trigger container */
  triggerClassName?: string
}

/**
 * NativeSelect - A hybrid select component that combines custom trigger styling
 * with native browser `<select>` behavior for the dropdown menu.
 * 
 * This provides:
 * - Native scroll behavior on mobile (wheel-picker on iOS)
 * - Native keyboard navigation
 * - Custom appearance matching the design system
 * 
 * The native select is overlaid with opacity: 0 on top of the styled trigger,
 * so clicks go to the native select while the visual appearance is our custom UI.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    {
      className,
      triggerClassName,
      options,
      value,
      onValueChange,
      placeholder,
      disabled,
      ...props
    },
    ref
  ) => {
    const selectedOption = options.find((opt) => opt.value === value)
    const displayText = selectedOption?.label ?? placeholder ?? "Select..."

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onValueChange?.(e.target.value)
    }

    return (
      <div className={cn("relative inline-flex", className)}>
        {/* Custom styled trigger (visual only) */}
        <div
          className={cn(
            "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background",
            !selectedOption && "text-muted-foreground",
            disabled && "cursor-not-allowed opacity-50",
            triggerClassName
          )}
          aria-hidden="true"
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
        </div>

        {/* Native select (invisible but interactive) */}
        <select
          ref={ref}
          value={value ?? ""}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            "absolute inset-0 w-full h-full opacity-0 cursor-pointer",
            disabled && "cursor-not-allowed"
          )}
          aria-label={placeholder}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>
    )
  }
)
NativeSelect.displayName = "NativeSelect"

export { NativeSelect }
