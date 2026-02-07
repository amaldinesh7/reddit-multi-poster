/**
 * EditFailedPostDialog Component
 * 
 * Dialog for editing a failed post before retrying.
 * Shows the error context and allows editing flair/title based on error type.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Tag,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react';
import { FailedPost } from '@/hooks/useFailedPosts';
import { getEditField, getErrorGuidance } from '@/lib/errorClassification';
import { FlairOption } from '@/utils/subredditCache';
import { Textarea } from '@/components/ui/textarea';

// ============================================================================
// Types
// ============================================================================

interface EditFailedPostDialogProps {
  /** The failed post to edit */
  post: FailedPost;
  /** Available flairs for the subreddit */
  flairOptions: FlairOption[];
  /** Whether flair is loading */
  flairLoading?: boolean;
  /** Whether flair is required for this subreddit */
  flairRequired?: boolean;
  /** Called when user submits the edit */
  onSubmit: (post: FailedPost, updates: { flairId?: string; titleSuffix?: string; customTitle?: string; customBody?: string }) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
}

// ============================================================================
// Component
// ============================================================================

const EditFailedPostDialog: React.FC<EditFailedPostDialogProps> = ({
  post,
  flairOptions,
  flairLoading = false,
  flairRequired = false,
  onSubmit,
  onCancel,
  isRetrying = false,
}) => {
  const [flairId, setFlairId] = useState<string>(post.flairId || '');
  const [titleSuffix, setTitleSuffix] = useState<string>(post.titleSuffix || '');
  const [customTitle, setCustomTitle] = useState<string>(post.customTitle ?? post.originalCaption ?? '');
  const [customBody, setCustomBody] = useState<string>(post.customBody ?? post.originalItem.text ?? '');

  // Determine which fields to show based on error
  const editField = getEditField(post.error);
  const showFlairField = editField === 'flair' || flairRequired || flairOptions.length > 0;
  const showTitleField = editField === 'title';

  // Reset state when post changes
  useEffect(() => {
    setFlairId(post.flairId || '');
    setTitleSuffix(post.titleSuffix || '');
    setCustomTitle(post.customTitle ?? post.originalCaption ?? '');
    setCustomBody(post.customBody ?? post.originalItem.text ?? '');
  }, [post]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(post, {
      flairId: flairId || undefined,
      titleSuffix: titleSuffix || undefined,
      customTitle: customTitle || undefined,
      customBody: customBody || undefined,
    });
  };

  const canSubmit = !isRetrying && (!flairRequired || flairId);
  const guidance = getErrorGuidance(post.error);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-background border border-border rounded-lg shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 id="edit-dialog-title" className="text-lg font-semibold">
            Fix Failed Post
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 w-8 p-0 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Subreddit */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Posting to:</span>
            <span className="font-medium">r/{post.subreddit}</span>
          </div>

          {/* Error Info */}
          <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-500">
                  {post.error.userMessage}
                </p>
                {post.error.details && (
                  <p className="text-xs text-red-400">
                    {post.error.details}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Guidance */}
          <div className="rounded-md bg-secondary/30 border border-border p-3 space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Why this failed</p>
              <p className="text-sm">{guidance.reason}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">What to do next</p>
              <ul className="text-sm list-disc list-inside space-y-1">
                {guidance.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Title Field */}
          <div className="space-y-2">
            <Label htmlFor="custom-title">Title</Label>
            <Input
              id="custom-title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Edit your title"
              className="cursor-text"
            />
          </div>

          {/* Body/Description Field */}
          <div className="space-y-2">
            <Label htmlFor="custom-body">Description</Label>
            <Textarea
              id="custom-body"
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              placeholder="Edit your description"
              className="min-h-[110px] resize-y"
            />
          </div>

          {/* Flair Field */}
          {showFlairField && (
            <div className="space-y-2">
              <Label htmlFor="flair-select" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Flair
                {flairRequired && (
                  <span className="text-red-500 text-xs">(required)</span>
                )}
              </Label>

              {flairLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading flairs...
                </div>
              ) : flairOptions.length > 0 ? (
                <Select value={flairId} onValueChange={setFlairId}>
                  <SelectTrigger id="flair-select" className="cursor-pointer">
                    <SelectValue placeholder="Select a flair" />
                  </SelectTrigger>
                  <SelectContent>
                    {!flairRequired && (
                      <SelectItem value="_none" className="cursor-pointer">
                        <span className="text-muted-foreground">No flair</span>
                      </SelectItem>
                    )}
                    {flairOptions.map((flair) => (
                      <SelectItem
                        key={flair.id}
                        value={flair.id}
                        className="cursor-pointer"
                      >
                        {flair.text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No flairs available for this subreddit
                </p>
              )}
            </div>
          )}

          {/* Title Suffix Field */}
          {showTitleField && (
            <div className="space-y-2">
              <Label htmlFor="title-suffix">
                Title Suffix
                <span className="text-muted-foreground text-xs ml-2">
                  (appended to your title)
                </span>
              </Label>
              <Input
                id="title-suffix"
                value={titleSuffix}
                onChange={(e) => setTitleSuffix(e.target.value.slice(0, 300))}
                placeholder="e.g., [OC], (25F)"
                className="cursor-text"
                maxLength={300}
              />
              <div className="flex justify-end">
                <span className={`text-xs ${titleSuffix.length > 270 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                  {titleSuffix.length}/300
                </span>
              </div>
            </div>
          )}

          {/* Retry Count */}
          {post.retryCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Attempted {post.retryCount} time{post.retryCount !== 1 ? 's' : ''} before
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isRetrying}
              className="flex-1 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 cursor-pointer"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Post
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFailedPostDialog;
