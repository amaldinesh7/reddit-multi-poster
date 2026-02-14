import React, { useState, useMemo } from 'react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Crown, Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/posthog';
import { usePricing } from '@/hooks/usePricing';
import ConfirmDialog, { useConfirmDialog } from './ui/confirm-dialog';

interface Community {
  id: string;
  name: string;
  categoryName: string;
}

interface CommunitySelectionModalProps {
  open: boolean;
  communities: Community[];
  onConfirm: (selectedIds: string[]) => Promise<void>;
  onUpgrade: () => void;
  maxToKeep: number;
  isLoading?: boolean;
}

// Hook to detect mobile viewport
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

const CommunitySelectionModal: React.FC<CommunitySelectionModalProps> = ({
  open,
  communities,
  onConfirm,
  onUpgrade,
  maxToKeep,
  isLoading = false,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { pricing } = usePricing();
  const confirmDialog = useConfirmDialog();
  const isMobile = useIsMobile();

  const selectedCount = selectedIds.size;
  const canConfirm = selectedCount === maxToKeep;

  // Sort communities alphabetically
  const sortedCommunities = useMemo(() => {
    return [...communities].sort((a, b) => a.name.localeCompare(b.name));
  }, [communities]);

  // Track modal open
  React.useEffect(() => {
    if (open) {
      trackEvent('community_selection_modal_opened', {
        total_communities: communities.length,
        max_to_keep: maxToKeep,
      });
    }
  }, [open, communities.length, maxToKeep]);

  // Reset selection when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
    }
  }, [open]);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxToKeep) {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;

    const unselectedCount = communities.length - selectedCount;

    const confirmed = await confirmDialog.openDialog({
      title: 'Confirm selection',
      message: `${unselectedCount} ${unselectedCount === 1 ? 'community' : 'communities'} will be permanently removed. This cannot be undone.`,
      variant: 'destructive',
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await onConfirm(Array.from(selectedIds));
      trackEvent('community_selection_confirmed', {
        kept: selectedCount,
        removed: unselectedCount,
      });
    } catch (error) {
      console.error('Failed to save community selection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpgrade = () => {
    trackEvent('community_selection_upgrade_clicked', {
      total_communities: communities.length,
    });
    onUpgrade();
  };

  if (!open) return null;

  const priceLabel = pricing?.formatted ?? '₹299';
  const isBusy = isSubmitting || isLoading;
  const remaining = maxToKeep - selectedCount;

  // Shared content for both mobile drawer and desktop modal
  const modalContent = (
    <>
      {/* Header */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Choose {maxToKeep} to keep
            </h2>
            <p className="text-sm text-muted-foreground">
              Free plan limit reached
            </p>
          </div>
          <span className={`text-sm tabular-nums ${canConfirm ? 'text-emerald-400' : 'text-muted-foreground'}`}>
            {selectedCount} of {maxToKeep}
          </span>
        </div>
      </div>

      {/* Community list */}
      <div className="flex-1 min-h-0 overflow-y-auto border-y border-border/40">
        <div className="divide-y divide-border/30">
          {sortedCommunities.map((community) => {
            const isSelected = selectedIds.has(community.id);
            const isDisabled = !isSelected && selectedCount >= maxToKeep;

            return (
              <label
                key={community.id}
                className={`flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-secondary/50'
                    : isDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-secondary/30'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => !isDisabled && handleToggle(community.id)}
                  disabled={isDisabled}
                />
                <span className="text-sm font-medium truncate">
                  r/{community.name}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 space-y-3">
        {/* Helper text */}
        {!canConfirm && (
          <p className="text-xs text-muted-foreground text-center">
            Select {remaining} more
          </p>
        )}

        {/* Keep selected button */}
        <Button
          onClick={handleConfirm}
          disabled={!canConfirm || isBusy}
          className="w-full h-11 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Keep selected'
          )}
        </Button>

        {/* Upgrade link */}
        <button
          onClick={handleUpgrade}
          disabled={isBusy}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground hover:text-violet-400 transition-colors cursor-pointer disabled:opacity-50"
        >
          <Crown className="h-3.5 w-3.5" />
          <span>Upgrade to keep all {communities.length}</span>
          <span className="text-violet-400">({priceLabel})</span>
        </button>
      </div>

      {/* Confirmation dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel="Remove communities"
        onConfirm={confirmDialog.handleConfirm}
        onCancel={confirmDialog.handleCancel}
      />
    </>
  );

  // Mobile: Bottom drawer
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={() => {}}>
        <DrawerContent className="h-[85dvh] max-h-[85dvh]">
          <div className="flex h-full min-h-0 flex-col">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <DrawerTitle className="sr-only">Choose communities to keep</DrawerTitle>
            {modalContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop/Tablet: Centered modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - no click to close (blocking modal) */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 flex flex-col max-h-[80vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-selection-modal-title"
      >
        {modalContent}
      </div>
    </div>
  );
};

export default CommunitySelectionModal;
