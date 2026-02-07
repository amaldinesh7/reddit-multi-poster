import React from 'react';
import { Button } from './ui/button';
import { X, Crown, Zap, Infinity as InfinityIcon, Check, Loader2 } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => void;
  upgradeLoading?: boolean;
  /** Custom context message to show instead of default limit message */
  context?: {
    title?: string;
    message: string;
  };
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  onOpenChange,
  onUpgrade,
  upgradeLoading = false,
  context,
}) => {
  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const benefits = [
    'Unlimited communities',
    'Post to as many communities as you want at once',
    'Custom title & description for each community',
    'No limits',
    'Pay once',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
      >
        {/* Premium gradient header - Purple theme */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 py-8 text-white">
          {/* Sparkle decorations */}
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-white/10 blur-xl" />
          
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header content */}
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h2 id="upgrade-modal-title" className="text-2xl font-bold">
                Get Pro
              </h2>
              <p className="text-white/80 text-sm">
                Post to unlimited communities
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Context message - only shown when context is provided (e.g., when posting with >5 subreddits) */}
          {context && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-200">
                    {context.title}
                  </p>
                  <p className="text-xs text-amber-200/70 mt-0.5">
                    {context.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Benefits list */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              What you get
            </p>
            <ul className="space-y-2.5">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
                    {benefit.includes('Unlimited') ? (
                      <InfinityIcon className="h-3 w-3 text-white" />
                    ) : (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Price */}
          <div className="text-center py-2">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-4xl font-bold bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
                ₹199
              </span>
              <span className="text-muted-foreground text-sm">one-time</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              No subscriptions. Pay once, use forever.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
          <Button
            onClick={onUpgrade}
            disabled={upgradeLoading}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-lg shadow-purple-500/25 cursor-pointer transition-all hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            {upgradeLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Opening checkout…
              </>
            ) : (
              <>
                <Crown className="mr-2 h-5 w-5" />
                Get Pro
              </>
            )}
          </Button>
          <button
            onClick={() => onOpenChange(false)}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
