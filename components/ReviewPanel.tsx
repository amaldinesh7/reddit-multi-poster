import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ValidationWarnings from '@/components/posting-queue/ValidationWarnings';
import type { PreflightResult } from '@/lib/preflightValidation';
import { Link as LinkIcon, FileText } from 'lucide-react';

interface ReviewPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body?: string;
  mediaType: 'image' | 'video' | 'url';
  mediaUrl?: string;
  mediaFiles?: File[];
  selectedSubs: string[];
  postToProfile: boolean;
  userName?: string;
  flairRequired: Record<string, boolean>;
  flairValue: Record<string, string | undefined>;
  flairOptions: Record<string, { id: string; text: string }[]>;
  titleSuffixes: Record<string, string | undefined>;
  validationResult?: PreflightResult | null;
  canPost: boolean;
  onPostNow: () => void;
  onBack: () => void;
  onResetSelection: () => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({
  open,
  onOpenChange,
  title,
  body,
  mediaType,
  mediaUrl,
  mediaFiles,
  selectedSubs,
  postToProfile,
  userName,
  flairRequired,
  flairValue,
  flairOptions,
  titleSuffixes,
  validationResult,
  canPost,
  onPostNow,
  onBack,
  onResetSelection,
}) => {
  const hasValidation = !!validationResult && validationResult.issues.length > 0;
  const [mediaPreviews, setMediaPreviews] = React.useState<Array<{ url: string; type: string }>>([]);

  const selectedTargets = React.useMemo(() => {
    const targets = [...selectedSubs];
    if (postToProfile && userName) {
      targets.push(`u/${userName}`);
    }
    return targets.sort((a, b) => a.localeCompare(b));
  }, [selectedSubs, postToProfile, userName]);

  React.useEffect(() => {
    if (!mediaFiles || mediaFiles.length === 0) {
      setMediaPreviews([]);
      return;
    }
    const previews = mediaFiles.map((file) => ({ url: URL.createObjectURL(file), type: file.type }));
    setMediaPreviews(previews);
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [mediaFiles]);

  const renderMediaPreview = () => {
    if (mediaPreviews.length > 0) {
      return (
        <div className="flex flex-wrap gap-2">
          {mediaPreviews.slice(0, 6).map((preview, index) => (
            preview.type.startsWith('image/') ? (
              <img
                key={`${preview.url}-${index}`}
                src={preview.url}
                alt="Selected media"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-md object-cover border border-border/50"
              />
            ) : (
              <div
                key={`${preview.url}-${index}`}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-md border border-border/50 bg-secondary/60 flex items-center justify-center text-[10px] text-muted-foreground"
              >
                file
              </div>
            )
          ))}
          {mediaPreviews.length > 6 && (
            <span className="text-xs text-muted-foreground">+{mediaPreviews.length - 6} more</span>
          )}
        </div>
      );
    }
    if (mediaUrl) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LinkIcon className="h-4 w-4" />
          <span className="truncate">{mediaUrl}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-4 w-4" />
        <span>Text post</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed bottom-0 left-0 right-0 z-50 h-auto w-full max-w-full translate-x-0 translate-y-0 rounded-t-2xl border-t border-border/50 bg-background p-0 max-h-[60dvh]"
      >
        <div className="flex h-full flex-col">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="border-b border-border/60 px-4 py-3 sm:px-6 sm:py-4">
            <div className="max-w-3xl mx-auto w-full">
              <DialogTitle className="text-lg font-semibold tracking-tight">Review &amp; post</DialogTitle>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4 space-y-4 max-h-[calc(60dvh-120px)]">
            <div className="max-w-3xl mx-auto w-full space-y-4">
              <section className="rounded-lg border border-border/60 bg-card/50 p-3">
                <div className="grid grid-cols-[auto,1fr] gap-3 items-start">
                  <div className="flex flex-wrap gap-2">
                    {renderMediaPreview()}
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">Preview</div>
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        {mediaType}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium truncate">{title || 'Untitled post'}</div>
                    {body && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{body}</div>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">Selected</div>
                  <span className="text-xs text-muted-foreground">{selectedTargets.length}</span>
                </div>
                <div className="space-y-1.5">
                  {selectedTargets.map((target) => {
                    const isProfile = target.startsWith('u/');
                    const subredditKey = isProfile ? '' : target.replace('r/', '');
                    const flairText = !isProfile
                      ? flairOptions[subredditKey]?.find(option => option.id === flairValue[subredditKey])?.text
                      : undefined;
                    const titleTag = !isProfile ? titleSuffixes[subredditKey] : undefined;
                    const flairMissing = !isProfile && flairRequired[subredditKey] && !flairValue[subredditKey];

                    return (
                      <div key={target} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card/50 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{target}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {flairMissing && (
                            <Badge variant="destructive" className="text-[10px]">Flair required</Badge>
                          )}
                          {flairText && (
                            <Badge variant="secondary" className="text-[10px]">{flairText}</Badge>
                          )}
                          {titleTag && (
                            <Badge variant="outline" className="text-[10px]">Tag: {titleTag}</Badge>
                          )}
                          {isProfile && (
                            <Badge variant="secondary" className="text-[10px]">Profile</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {validationResult && (
                <section className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Validation</div>
                  {hasValidation ? (
                    <ValidationWarnings result={validationResult} />
                  ) : (
                    <div className="text-xs text-muted-foreground">No validation issues found.</div>
                  )}
                </section>
              )}
            </div>
          </div>

          <div className="border-t border-border/60 px-4 py-3 sm:px-6 sm:py-4 bg-background/95 sticky bottom-0">
            <div className="max-w-3xl mx-auto w-full">
              <div className="flex items-center gap-2">
                <Button
                  onClick={onPostNow}
                  disabled={!canPost}
                  className="flex-1 cursor-pointer"
                >
                  Post now
                </Button>
                <Button
                  variant="outline"
                  onClick={onBack}
                  className="h-10 cursor-pointer"
                >
                  Back to edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={onResetSelection}
                  className="h-10 cursor-pointer"
                >
                  Reset
                </Button>
              </div>
              {!canPost && (
                <p className="text-xs text-muted-foreground mt-2">
                  Add a title and resolve blocking issues to enable posting.
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewPanel;
