import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Crown } from 'lucide-react';

interface ProUpgradeHintProps {
  feature: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  onUpgrade?: () => void;
}

/**
 * Detects if the device is primarily touch-based (no hover capability).
 */
const useIsTouchDevice = (): boolean => {
  const [isTouchDevice, setIsTouchDevice] = React.useState(false);

  React.useEffect(() => {
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

const contentClassName =
  'z-[9999] w-56 rounded-xl border border-violet-500/20 bg-popover p-3 shadow-xl shadow-purple-500/5 animate-in fade-in-0 zoom-in-95';

const HintContent: React.FC<{ feature: string; onUpgrade?: () => void }> = ({
  feature,
  onUpgrade,
}) => (
  <div className="space-y-2.5">
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/20">
        <Crown className="h-3.5 w-3.5 text-violet-400" />
      </div>
      <span className="text-xs font-semibold text-foreground">Pro Feature</span>
    </div>
    <p className="text-xs text-muted-foreground leading-relaxed">
      {feature} is available with Pro. Upgrade to unlock AI-powered tools.
    </p>
    {onUpgrade && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onUpgrade();
        }}
        className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-violet-700 hover:to-purple-700 transition-all cursor-pointer shadow-sm shadow-purple-500/20"
        aria-label="Upgrade to Pro"
      >
        Upgrade to Pro
      </button>
    )}
  </div>
);

/**
 * Desktop version: opens on hover via mouseenter/mouseleave on both trigger and content.
 */
const DesktopHint: React.FC<ProUpgradeHintProps> = ({
  feature,
  children,
  side,
  onUpgrade,
}) => {
  const [open, setOpen] = React.useState(false);
  const closeTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = () => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
    setOpen(true);
  };

  const handleClose = () => {
    closeTimeout.current = setTimeout(() => setOpen(false), 150);
  };

  React.useEffect(() => {
    return () => {
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
    };
  }, []);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <span
          className="inline"
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          {children}
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          sideOffset={8}
          className={contentClassName}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
          onPointerDownOutside={() => setOpen(false)}
        >
          <HintContent feature={feature} onUpgrade={onUpgrade} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};

/**
 * Mobile version: opens on tap/click via Popover toggle.
 */
const MobileHint: React.FC<ProUpgradeHintProps> = ({
  feature,
  children,
  side,
  onUpgrade,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <div className="contents">
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
          <HintContent feature={feature} onUpgrade={onUpgrade} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};

/**
 * A rich upgrade prompt shown on hover (desktop) or tap (mobile).
 * Displays a styled card with the feature name, description, and "Upgrade to Pro" button.
 */
export const ProUpgradeHint: React.FC<ProUpgradeHintProps> = ({
  feature,
  children,
  side = 'left',
  onUpgrade,
}) => {
  const isTouchDevice = useIsTouchDevice();

  if (isTouchDevice) {
    return (
      <MobileHint feature={feature} side={side} onUpgrade={onUpgrade}>
        {children}
      </MobileHint>
    );
  }

  return (
    <DesktopHint feature={feature} side={side} onUpgrade={onUpgrade}>
      {children}
    </DesktopHint>
  );
};
