import React from 'react';
import { Crown } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 py-7 text-white">
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Crown className="h-6 w-6" />
            </div>
            <DialogHeader className="space-y-0.5">
              <DialogTitle className="text-xl font-bold text-white">
                Your Pro trial has ended
              </DialogTitle>
              <DialogDescription className="text-white/80 text-sm">
                You&apos;re back on Free.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 space-y-4">
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
            tabIndex={0}
            aria-label="Continue on Free"
          >
            Continue on Free
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialEndedModal;
