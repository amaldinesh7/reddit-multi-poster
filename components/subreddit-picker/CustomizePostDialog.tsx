import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PostRequirements } from '@/utils/reddit';

export interface PerSubredditOverride {
  title?: string;
  body?: string;
}

interface CustomizePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subredditName: string;
  globalTitle: string;
  globalBody: string;
  override?: PerSubredditOverride;
  postRequirements?: PostRequirements;
  onSave: (subreddit: string, override: PerSubredditOverride | undefined) => void;
}

export const CustomizePostDialog: React.FC<CustomizePostDialogProps> = ({
  open,
  onOpenChange,
  subredditName,
  globalTitle,
  globalBody,
  override,
  postRequirements,
  onSave,
}) => {
  const [useCustomTitle, setUseCustomTitle] = useState(false);
  const [useCustomBody, setUseCustomBody] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Initialize state when dialog opens
  useEffect(() => {
    if (open) {
      setUseCustomTitle(!!override?.title);
      setUseCustomBody(!!override?.body);
      setCustomTitle(override?.title || globalTitle);
      setCustomBody(override?.body || globalBody);
    }
  }, [open, override, globalTitle, globalBody]);

  // Auto-expand title textarea
  useEffect(() => {
    const el = titleRef.current;
    if (el && useCustomTitle) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(40, el.scrollHeight)}px`;
    }
  }, [customTitle, useCustomTitle]);

  // Auto-expand body textarea
  useEffect(() => {
    const el = bodyRef.current;
    if (el && useCustomBody) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(80, el.scrollHeight)}px`;
    }
  }, [customBody, useCustomBody]);

  const handleSave = () => {
    const newOverride: PerSubredditOverride | undefined = 
      (useCustomTitle || useCustomBody) 
        ? {
            title: useCustomTitle ? customTitle : undefined,
            body: useCustomBody ? customBody : undefined,
          }
        : undefined;
    
    onSave(subredditName, newOverride);
    onOpenChange(false);
  };

  const handleReset = () => {
    setUseCustomTitle(false);
    setUseCustomBody(false);
    setCustomTitle(globalTitle);
    setCustomBody(globalBody);
  };

  const titleMinLength = postRequirements?.title_text_min_length;
  const titleMaxLength = postRequirements?.title_text_max_length || 300;
  const bodyMinLength = postRequirements?.body_text_min_length;
  const bodyMaxLength = postRequirements?.body_text_max_length || 40000;
  const bodyRequired = postRequirements?.body_restriction_policy === 'required';

  const displayTitle = useCustomTitle ? customTitle : globalTitle;
  const displayBody = useCustomBody ? customBody : globalBody;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Customize for r/{subredditName}
            <Badge className="text-[10px] font-semibold bg-gradient-to-r from-amber-400/20 to-orange-500/20 text-amber-300 border border-amber-400/30">
              PRO
            </Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Override title and description for this community only.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Custom Title Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={useCustomTitle}
                  id="use-custom-title"
                  onClick={() => {
                    const next = !useCustomTitle;
                    setUseCustomTitle(next);
                    if (next && !customTitle) {
                      setCustomTitle(globalTitle);
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    useCustomTitle ? 'bg-orange-500' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useCustomTitle ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
                <Label htmlFor="use-custom-title" className="text-sm font-medium cursor-pointer">
                  Custom title
                </Label>
              </div>
              {titleMinLength && (
                <span className="text-xs text-muted-foreground">
                  Min: {titleMinLength} chars
                </span>
              )}
            </div>
            
            {useCustomTitle ? (
              <div className="mt-2">
                <Textarea
                  ref={titleRef}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value.slice(0, titleMaxLength))}
                  placeholder="Custom title for this community"
                  className="resize-none min-h-[40px] overflow-hidden"
                  rows={1}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs ${displayTitle.length > titleMaxLength * 0.9 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {displayTitle.length}/{titleMaxLength}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-2 px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground">
                Using global: &quot;{globalTitle.slice(0, 60)}{globalTitle.length > 60 ? '...' : ''}&quot;
              </div>
            )}
          </div>
          <div className="border-t border-border/50" aria-hidden="true" />

          {/* Custom Body Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={useCustomBody}
                  id="use-custom-body"
                  onClick={() => {
                    const next = !useCustomBody;
                    setUseCustomBody(next);
                    if (next && !customBody) {
                      setCustomBody(globalBody);
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    useCustomBody ? 'bg-orange-500' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useCustomBody ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
                <Label htmlFor="use-custom-body" className="text-sm font-medium cursor-pointer">
                  Custom description
                  {bodyRequired && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
              </div>
              {bodyMinLength && (
                <span className="text-xs text-muted-foreground">
                  Min: {bodyMinLength} chars
                </span>
              )}
            </div>
            
            {useCustomBody ? (
              <div className="mt-2">
                <Textarea
                  ref={bodyRef}
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value.slice(0, bodyMaxLength))}
                  placeholder="Custom description for this community"
                  className="resize-none min-h-[80px] overflow-hidden"
                  rows={3}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs ${displayBody.length > bodyMaxLength * 0.9 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {displayBody.length}/{bodyMaxLength}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-2 px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground">
                {globalBody ? (
                  <>Using global: &quot;{globalBody.slice(0, 80)}{globalBody.length > 80 ? '...' : ''}&quot;</>
                ) : (
                  <span className="italic">No description set</span>
                )}
              </div>
            )}
          </div>

          {/* Requirements hint */}
          {(postRequirements?.title_blacklisted_strings?.length ?? 0) + (postRequirements?.body_blacklisted_strings?.length ?? 0) > 0 && (
            <div className="text-xs text-muted-foreground bg-yellow-500/10 px-3 py-2 rounded-md border border-yellow-500/20">
              This community has content restrictions. Check the community rules for blacklisted words.
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {(useCustomTitle || useCustomBody) && (
            <Button variant="ghost" onClick={handleReset} className="cursor-pointer">
              Reset to global
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={handleSave} className="cursor-pointer">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomizePostDialog;
