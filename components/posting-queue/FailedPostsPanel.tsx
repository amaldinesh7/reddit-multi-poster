/**
 * FailedPostsPanel Component
 * 
 * Displays failed posts grouped by error category with actionable recovery options.
 * Provides bulk actions and per-item edit/retry/remove controls.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { RefreshCw, Pencil, X, ChevronDown, ChevronRight } from 'lucide-react';
import { FailedPost, FailedPostsState } from '@/hooks/useFailedPosts';
import { ErrorCategory } from '@/lib/errorClassification';

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
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 last:border-b-0 hover:bg-secondary/40 transition-colors">
      <span className="text-sm font-medium flex-1 truncate">r/{post.subreddit}</span>
      <Tooltip content={post.error.details || post.error.originalMessage}>
        <span className="text-xs text-muted-foreground truncate max-w-[160px]">
          {post.error.userMessage}
        </span>
      </Tooltip>
      <div className="flex items-center gap-1">
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 w-7 p-0 cursor-pointer hover:bg-amber-500/20 hover:text-amber-500"
            title="Edit"
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
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  posts,
  onRetryOne,
  onEdit,
  onRemove,
}) => {
  const [expanded, setExpanded] = React.useState(true);

  if (posts.length === 0) return null;

  return (
    <div className="rounded-md border border-border overflow-hidden">
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
        <span className="text-sm font-medium flex-1 text-left">
          {getCategoryLabel(category)} ({posts.length})
        </span>
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
  onRetryAll,
  onEdit,
  onRemove,
  onClearAll,
}) => {
  const { posts, postsByCategory } = state;
  const totalFailed = posts.length;

  if (totalFailed === 0) return null;

  return (
    <div className="space-y-2">
      {/* Category Sections */}
        {/* Fixable Now - Show first */}
        <CategorySection
          category="fixable_now"
          posts={postsByCategory.fixable_now}
          onRetryOne={onRetryOne}
          onEdit={onEdit}
          onRemove={onRemove}
        />

        {/* Fixable Later */}
        <CategorySection
          category="fixable_later"
          posts={postsByCategory.fixable_later}
          onRetryOne={onRetryOne}
          onEdit={onEdit}
          onRemove={onRemove}
        />

        {/* Unfixable */}
        <CategorySection
          category="unfixable"
          posts={postsByCategory.unfixable}
          onRetryOne={onRetryOne}
          onEdit={onEdit}
          onRemove={onRemove}
        />
    </div>
  );
};

export default FailedPostsPanel;
