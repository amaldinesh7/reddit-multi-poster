import React from 'react';
import { Crown, X } from 'lucide-react';
import { Button } from './ui/button';

interface TrialEndedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => void;
}

const TrialEndedModal: React.FC<TrialEndedModalProps> = ({
  open,
  onOpenChange,
  onUpgrade,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-ended-modal-title"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 py-7 text-white">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h2 id="trial-ended-modal-title" className="text-xl font-bold">
                Your Pro trial has ended
              </h2>
              <p className="text-white/80 text-sm">
                You&apos;re back on Free.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Upgrade to Lifetime Pro to keep posting to unlimited communities.
          </p>
          <Button
            onClick={onUpgrade}
            className="w-full h-11 font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 cursor-pointer"
          >
            Get Lifetime Pro
          </Button>
          <button
            onClick={() => onOpenChange(false)}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Continue on Free
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialEndedModal;
