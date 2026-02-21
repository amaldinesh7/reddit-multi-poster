import React from 'react';
import NextImage from 'next/image';
import { Drawer, DrawerContent, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon, Pencil } from 'lucide-react';
import { X } from 'lucide-react';
import { PerSubredditOverride } from '@/components/subreddit-picker';

interface ReviewPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body?: string;
  mediaFiles?: File[];
  mediaUrl?: string;
  selectedSubs: string[];
  postToProfile: boolean;
  userName?: string;
  flairRequired: Record<string, boolean>;
  flairValue: Record<string, string | undefined>;
  flairOptions: Record<string, { id: string; text: string }[]>;
  titleSuffixes: Record<string, string | undefined>;
  contentOverrides?: Record<string, PerSubredditOverride>;
  canPost: boolean;
  onPostNow: () => void;
  onResetSelection: () => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({
  open,
  onOpenChange,
  title,
  body,
  mediaFiles,
  mediaUrl,
  selectedSubs,
  postToProfile,
  userName,
  flairRequired,
  flairValue,
  flairOptions,
  titleSuffixes,
  contentOverrides,
  canPost,
  onPostNow,
  onResetSelection,
}) => {
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
    if (mediaPreviews.length === 0) return null;
    return (
      <div className="w-full">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {mediaPreviews.map((preview) => (
            preview.type.startsWith('image/') ? (
              <div
                key={preview.url}
                className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-md overflow-hidden border border-border/60 shadow-sm flex-shrink-0"
              >
                <NextImage
                  src={preview.url}
                  alt="Selected media"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <div
                key={preview.url}
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-md border border-border/60 bg-secondary/60 flex items-center justify-center text-[10px] text-muted-foreground flex-shrink-0"
              >
                file
              </div>
            )
          ))}
        </div>
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[80dvh] max-h-[80dvh] w-full">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="border-b border-border/40 px-4 py-3 sm:px-8 sm:py-4">
            <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-2">
              <DrawerTitle className="text-lg font-semibold tracking-tight">Review &amp; post</DrawerTitle>
              <DrawerClose className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </DrawerClose>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-8 sm:py-4 space-y-4">
            <div className="max-w-3xl mx-auto w-full space-y-4">
              <section className="space-y-2 border-b border-border/40 pb-3">
                {mediaUrl && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LinkIcon className="h-4 w-4" />
                    <span className="truncate">{mediaUrl}</span>
                  </div>
                )}
                {mediaPreviews.length > 0 && renderMediaPreview()}
                <div className="text-sm font-semibold">{title || 'Untitled post'}</div>
                {body && (
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {body}
                  </div>
                )}
              </section>

              <section className="space-y-2 border-b border-border/40 pb-3">
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
                    const hasCustomContent = !isProfile && contentOverrides?.[subredditKey] && 
                      (contentOverrides[subredditKey].title || contentOverrides[subredditKey].body);

                    return (
                      <div key={target} className="flex items-center justify-between gap-2 py-1.5">
                        <div className="min-w-0 flex items-center gap-1.5">
                          <div className="text-sm font-medium truncate">{target}</div>
                          {hasCustomContent && (
                            <span title="Custom content applied">
                              <Pencil className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                            </span>
                          )}
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

            </div>
          </div>

          <div className="shrink-0 border-t border-border/40 px-4 py-3 sm:px-8 sm:py-4 bg-background/95">
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
      </DrawerContent>
    </Drawer>
  );
};

export default ReviewPanel;
