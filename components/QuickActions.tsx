/**
 * QuickActions Component
 * 
 * Provides quick action buttons for common operations like loading last post settings.
 * Positioned above the PostComposer for easy access.
 */

import { Clock, RotateCcw, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip } from './ui/tooltip';
import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface SavedPostSettings {
  subreddits: string[];
  flairs: Record<string, string | undefined>;
  titleSuffixes: Record<string, string | undefined>;
  prefixes: { f: boolean; c: boolean };
  savedAt: string; // ISO timestamp
}

interface QuickActionsProps {
  /** Callback when load last post is clicked */
  onLoadLastPost: () => void;
  /** Whether there are saved settings available */
  hasLastPost: boolean;
  /** Date when the last post settings were saved */
  lastPostDate?: string;
  /** Whether settings were just applied (for feedback) */
  justApplied?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a date string into a relative time string
 */
const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    
    // Format as date for older
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return 'recently';
  }
};

// ============================================================================
// Main Component
// ============================================================================

export const QuickActions = ({
  onLoadLastPost,
  hasLastPost,
  lastPostDate,
  justApplied = false,
  className = '',
}: QuickActionsProps) => {
  const [showAppliedFeedback, setShowAppliedFeedback] = useState(false);

  // Show feedback when settings are applied
  useEffect(() => {
    if (justApplied) {
      setShowAppliedFeedback(true);
      const timer = setTimeout(() => {
        setShowAppliedFeedback(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [justApplied]);

  const handleLoadClick = () => {
    onLoadLastPost();
  };

  // Don't render if no saved settings
  if (!hasLastPost) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Tooltip 
        content={
          <div className="text-xs">
            <p className="font-medium">Restore previous post settings</p>
            <p className="text-muted-foreground mt-0.5">
              Loads your last selected communities, flairs, and title tags
            </p>
          </div>
        }
        side="bottom"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadClick}
          disabled={showAppliedFeedback}
          className={`
            h-8 text-xs font-medium transition-all cursor-pointer
            ${showAppliedFeedback 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
              : 'hover:bg-secondary'
            }
          `}
          aria-label="Load last post settings"
        >
          {showAppliedFeedback ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Applied
            </>
          ) : (
            <>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Load Last Settings
            </>
          )}
        </Button>
      </Tooltip>

      {/* Timestamp indicator */}
      {lastPostDate && !showAppliedFeedback && (
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(lastPostDate)}
        </span>
      )}
    </div>
  );
};

export default QuickActions;
