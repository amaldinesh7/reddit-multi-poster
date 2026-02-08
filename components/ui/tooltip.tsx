import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as PopoverPrimitive from '@radix-ui/react-popover';

// ============================================================================
// Types
// ============================================================================

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

// ============================================================================
// Hook: Detect Touch Device
// ============================================================================

/**
 * Detects if the device is primarily touch-based (no hover capability).
 * Uses CSS media query matching for accurate detection.
 */
const useIsTouchDevice = (): boolean => {
  const [isTouchDevice, setIsTouchDevice] = React.useState(false);

  React.useEffect(() => {
    // Check if the device has no hover capability (touch-only)
    const mediaQuery = window.matchMedia('(hover: none)');
    setIsTouchDevice(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsTouchDevice(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isTouchDevice;
};

// ============================================================================
// Shared Styles
// ============================================================================

const contentClassName =
  'z-[9999] px-2 py-1.5 text-xs bg-popover text-popover-foreground rounded border border-border shadow-lg max-w-[250px] whitespace-normal animate-in fade-in-0 zoom-in-95';

// ============================================================================
// Desktop Tooltip (Hover-based)
// ============================================================================

const DesktopTooltip = ({ content, children, side }: TooltipProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.currentTarget.click();
    }
  };

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <div
            className="inline-flex cursor-pointer"
            tabIndex={0}
            role="button"
            onKeyDown={handleKeyDown}
          >
            {children}
          </div>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            className={contentClassName}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
};

// ============================================================================
// Mobile Tooltip (Click/Tap-based using Popover)
// ============================================================================

const MobileTooltip = ({ content, children, side }: TooltipProps) => {
  const [open, setOpen] = React.useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <div
          className="inline-flex cursor-pointer"
          tabIndex={0}
          role="button"
          aria-expanded={open}
          onKeyDown={handleKeyDown}
        >
          {children}
        </div>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          sideOffset={8}
          className={contentClassName}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {content}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};

// ============================================================================
// Main Component: Hybrid Tooltip
// ============================================================================

/**
 * A mobile-friendly tooltip component that:
 * - Uses hover on desktop devices (traditional tooltip behavior)
 * - Uses tap/click on mobile devices (toggletip pattern)
 * - Supports keyboard navigation on both
 * - Dismisses on Escape key or tap outside (mobile)
 */
export function Tooltip({ content, children, side = 'left' }: TooltipProps) {
  const isTouchDevice = useIsTouchDevice();

  // Render Popover for touch devices, Tooltip for pointer devices
  if (isTouchDevice) {
    return <MobileTooltip content={content} side={side}>{children}</MobileTooltip>;
  }

  return <DesktopTooltip content={content} side={side}>{children}</DesktopTooltip>;
}
