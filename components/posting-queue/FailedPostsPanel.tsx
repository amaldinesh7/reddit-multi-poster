/**
 * FailedPostsPanel Component
 * 
 * Displays failed posts grouped by error category with actionable recovery options.
 * Provides bulk actions and per-item edit/retry/remove controls.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import {
  AlertTriangle,
  Tag,
  Clock,
  Ban,
  Key,
  FileText,
  Lock,
  Image,
  Wifi,
  RefreshCw,
  Trash2,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import { FailedPost, FailedPostsState } from '@/hooks/useFailedPosts';
import { ErrorCategory, getActionLabel, getErrorGroupSummary } from '@/lib/errorClassification';

// ============================================================================
// Types
// ============================================================================

interface FailedPostsPanelProps {
  state: FailedPostsState;
  onRetryOne: (id: string) => void;
  onRetryCategory: (category: ErrorCategory) => void;
  onRetryAll: () => void;
  onEdit: (post: FailedPost) => void;
  onRemove: (id: string) => void;
  onRemoveCategory: (category: ErrorCategory) => void;
  onClearAll: () => void;
  /** Number of successfully posted items */
  successCount?: number;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const getErrorIcon = (iconName: string, className: string = 'h-4 w-4') => {
  const icons: Record<string, React.ReactNode> = {
    tag: <Tag className={className} />,
    clock: <Clock className={className} />,
    ban: <Ban className={className} />,
    key: <Key className={className} />,
    text: <FileText className={className} />,
    lock: <Lock className={className} />,
    image: <Image className={className} />,
    wifi: <Wifi className={className} />,
    alert: <AlertTriangle className={className} />,
  };
  return icons[iconName] || <AlertTriangle className={className} />;
};

const getCategoryIcon = (category: ErrorCategory, className: string = 'h-4 w-4') => {
  switch (category) {
    case 'fixable_now':
      return <Pencil className={className} />;
    case 'fixable_later':
      return <Clock className={className} />;
    case 'unfixable':
      return <Ban className={className} />;
  }
};

const getCategoryColor = (category: ErrorCategory): string => {
  switch (category) {
    case 'fixable_now':
      return 'text-amber-500';
    case 'fixable_later':
      return 'text-blue-500';
    case 'unfixable':
      return 'text-red-500';
  }
};

const getCategoryBgColor = (category: ErrorCategory): string => {
  switch (category) {
    case 'fixable_now':
      return 'bg-amber-500/10 border-amber-500/30';
    case 'fixable_later':
      return 'bg-blue-500/10 border-blue-500/30';
    case 'unfixable':
      return 'bg-red-500/10 border-red-500/30';
  }
};

const getCategoryLabel = (category: ErrorCategory): string => {
  switch (category) {
    case 'fixable_now':
      return 'Can Fix Now';
    case 'fixable_later':
      return 'Can Retry';
    case 'unfixable':
      return 'Cannot Post';
  }
};

// ============================================================================
// Sub-Components
// ============================================================================

interface FailedPostRowProps {
  post: FailedPost;
  onRetry: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

const FailedPostRow: React.FC<FailedPostRowProps> = ({
  post,
  onRetry,
  onEdit,
  onRemove,
}) => {
  const canEdit = ['edit_flair', 'edit_title', 'edit_content', 'change_media'].includes(post.error.action);
  const canRetry = post.error.category !== 'unfixable' || post.error.action === 'manual_retry';

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 last:border-b-0 hover:bg-secondary/50 transition-colors">
      {/* Error Icon */}
      <Tooltip content={post.error.userMessage}>
        <span className={getCategoryColor(post.error.category)}>
          {getErrorIcon(post.error.icon, 'h-4 w-4')}
        </span>
      </Tooltip>

      {/* Subreddit */}
      <span className="text-sm flex-1 truncate">
        r/{post.subreddit}
      </span>

      {/* Error Message */}
      <Tooltip content={post.error.details || post.error.originalMessage}>
        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
          {post.error.userMessage}
        </span>
      </Tooltip>

      {/* Retry Count Badge */}
      {post.retryCount > 0 && (
        <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
          {post.retryCount}x
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 w-7 p-0 cursor-pointer hover:bg-amber-500/20 hover:text-amber-500"
            title="Edit and retry"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {canRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-7 w-7 p-0 cursor-pointer hover:bg-blue-500/20 hover:text-blue-500"
            title="Retry"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 w-7 p-0 cursor-pointer hover:bg-red-500/20 hover:text-red-500"
          title="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

interface CategorySectionProps {
  category: ErrorCategory;
  posts: FailedPost[];
  onRetryOne: (id: string) => void;
  onEdit: (post: FailedPost) => void;
  onRemove: (id: string) => void;
  onRetryCategory: () => void;
  onRemoveCategory: () => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  posts,
  onRetryOne,
  onEdit,
  onRemove,
  onRetryCategory,
  onRemoveCategory,
}) => {
  const [expanded, setExpanded] = React.useState(true);
  const canRetry = category !== 'unfixable';

  if (posts.length === 0) return null;

  return (
    <div className={`rounded-md border ${getCategoryBgColor(category)} overflow-hidden`}>
      {/* Category Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-black/10 transition-colors"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${getCategoryLabel(category)} section`}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className={getCategoryColor(category)}>
          {getCategoryIcon(category, 'h-4 w-4')}
        </span>
        <span className="text-sm font-medium flex-1 text-left">
          {getCategoryLabel(category)} ({posts.length})
        </span>
        
        {/* Bulk Actions */}
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {canRetry && posts.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetryCategory}
              className="h-6 text-xs cursor-pointer hover:bg-blue-500/20 hover:text-blue-500"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry All
            </Button>
          )}
          {posts.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemoveCategory}
              className="h-6 text-xs cursor-pointer hover:bg-red-500/20 hover:text-red-500"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Remove
            </Button>
          )}
        </div>
      </button>

      {/* Posts List */}
      {expanded && (
        <div className="bg-background/50">
          {posts.map(post => (
            <FailedPostRow
              key={post.id}
              post={post}
              onRetry={() => onRetryOne(post.id)}
              onEdit={() => onEdit(post)}
              onRemove={() => onRemove(post.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const FailedPostsPanel: React.FC<FailedPostsPanelProps> = ({
  state,
  onRetryOne,
  onRetryCategory,
  onRetryAll,
  onEdit,
  onRemove,
  onRemoveCategory,
  onClearAll,
  successCount = 0,
}) => {
  const { posts, postsByCategory, categoryCounts } = state;
  const totalFailed = posts.length;
  const retryableCount = categoryCounts.fixable_now + categoryCounts.fixable_later;

  if (totalFailed === 0) return null;

  return (
    <div className="space-y-3">
      {/* Summary Header */}
      <div className="rounded-md bg-secondary/50 border border-border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {successCount > 0 && (
              <div className="flex items-center gap-1.5 text-green-500">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{successCount} posted</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-red-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">{totalFailed} failed</span>
            </div>
          </div>

          {/* Global Actions */}
          <div className="flex items-center gap-2">
            {retryableCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetryAll}
                className="cursor-pointer border-blue-500/50 text-blue-500 hover:bg-blue-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Retry {retryableCount}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="cursor-pointer text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Category Summary */}
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          {categoryCounts.fixable_now > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {categoryCounts.fixable_now} fixable
            </span>
          )}
          {categoryCounts.fixable_later > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {categoryCounts.fixable_later} retryable
            </span>
          )}
          {categoryCounts.unfixable > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {categoryCounts.unfixable} unfixable
            </span>
          )}
        </div>
      </div>

      {/* Category Sections */}
      <div className="space-y-2">
        {/* Fixable Now - Show first */}
        <CategorySection
          category="fixable_now"
          posts={postsByCategory.fixable_now}
          onRetryOne={onRetryOne}
          onEdit={onEdit}
          onRemove={onRemove}
          onRetryCategory={() => onRetryCategory('fixable_now')}
          onRemoveCategory={() => onRemoveCategory('fixable_now')}
        />

        {/* Fixable Later */}
        <CategorySection
          category="fixable_later"
          posts={postsByCategory.fixable_later}
          onRetryOne={onRetryOne}
          onEdit={onEdit}
          onRemove={onRemove}
          onRetryCategory={() => onRetryCategory('fixable_later')}
          onRemoveCategory={() => onRemoveCategory('fixable_later')}
        />

        {/* Unfixable */}
        <CategorySection
          category="unfixable"
          posts={postsByCategory.unfixable}
          onRetryOne={onRetryOne}
          onEdit={onEdit}
          onRemove={onRemove}
          onRetryCategory={() => onRetryCategory('unfixable')}
          onRemoveCategory={() => onRemoveCategory('unfixable')}
        />
      </div>
    </div>
  );
};

export default FailedPostsPanel;
