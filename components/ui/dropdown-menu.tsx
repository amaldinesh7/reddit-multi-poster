import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/lib/utils"

const DropdownMenuRoot = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItemPrimitive = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors focus:bg-secondary focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
))
DropdownMenuItemPrimitive.displayName = DropdownMenuPrimitive.Item.displayName

// Simple wrapper components
interface DropdownMenuProps {
  trigger: React.ReactNode
  children: React.ReactNode
}

function DropdownMenu({ trigger, children }: DropdownMenuProps) {
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {children}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  )
}

interface DropdownMenuItemProps {
  onClick?: () => void
  children: React.ReactNode
  className?: string
}

function DropdownMenuItem({ onClick, children, className }: DropdownMenuItemProps) {
  return (
    <DropdownMenuItemPrimitive onClick={onClick} className={className}>
      {children}
    </DropdownMenuItemPrimitive>
  )
}

export { 
  DropdownMenu, 
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItemPrimitive
}
