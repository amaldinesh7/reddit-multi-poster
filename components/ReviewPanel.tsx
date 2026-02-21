import React from 'react';
import NextImage from 'next/image';
import { Drawer, DrawerContent, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon, Pencil, FileText, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-8 sm:py-5 space-y-5">
            <div className="max-w-3xl mx-auto w-full space-y-5">

              {/* Post preview */}
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Your post</span>
                </div>
                <div className="rounded-lg border border-border/50 bg-secondary/20 p-3.5 space-y-2">
                  {mediaUrl && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <LinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{mediaUrl}</span>
                    </div>
                  )}
                  {mediaPreviews.length > 0 && renderMediaPreview()}
                  <p className="text-sm font-semibold leading-snug">{title || 'Untitled post'}</p>
                  {body && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words line-clamp-4">
                      {body}
                    </p>
                  )}
                </div>
              </section>

              {/* Destinations */}
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <Send className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Posting to {selectedTargets.length} {selectedTargets.length === 1 ? 'community' : 'communities'}
                  </span>
                </div>
                <div className="rounded-lg border border-border/50 divide-y divide-border/30 overflow-hidden">
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
                      <div key={target} className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-card/50 hover:bg-secondary/20 transition-colors">
                        <div className="min-w-0 flex items-center gap-2">
                          {flairMissing ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">{target}</span>
                          {hasCustomContent && (
                            <span title="Custom content" aria-label="Custom content">
                              <Pencil className="h-3 w-3 text-violet-400/70 flex-shrink-0" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-end flex-shrink-0">
                          {flairMissing && (
                            <Badge variant="destructive" className="text-[10px]">Flair missing</Badge>
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

          <div className="shrink-0 border-t border-border/50 px-4 py-3 sm:px-8 sm:py-4 bg-background/95 backdrop-blur-sm">
            <div className="max-w-3xl mx-auto w-full space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  onClick={onPostNow}
                  disabled={!canPost}
                  className="flex-1 cursor-pointer h-11"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post to {selectedTargets.length} {selectedTargets.length === 1 ? 'community' : 'communities'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={onResetSelection}
                  className="h-11 cursor-pointer"
                >
                  Reset
                </Button>
              </div>
              {!canPost && (
                <p className="text-xs text-muted-foreground">
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
