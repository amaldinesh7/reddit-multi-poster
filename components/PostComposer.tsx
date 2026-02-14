import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { usePersistentState } from '@/hooks/usePersistentState';
import CopyGenerationDialog from '@/components/ai/CopyGenerationDialog';

interface Props {
  value: string;
  onChange: (value: string) => void;
  body?: string;
  onBodyChange?: (value: string) => void;
  prefixes: { f: boolean; c: boolean };
  onPrefixesChange: (prefixes: { f: boolean; c: boolean }) => void;
  resetSignal?: number;
  aiContext?: {
    selectedSubreddits?: string[];
    mediaType?: 'self' | 'link' | 'image' | 'video' | 'gallery';
  };
}

export interface PostComposerRef {
  focusTitle: () => void;
}

const PostComposer = forwardRef<PostComposerRef, Props>(function PostComposer({
  value,
  onChange,
  body,
  onBodyChange,
  prefixes,
  onPrefixesChange,
  resetSignal,
  aiContext,
}, ref) {
  const [showBody, setShowBody] = usePersistentState<boolean>('rmp_show_body', false);
  const [isAiDialogOpen, setIsAiDialogOpen] = React.useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const count = value.length;
  const limit = 300;
  const bodyLimit = 40000;
  const hasBody = (body?.length ?? 0) > 0;

  // Expose focusTitle method to parent components
  useImperativeHandle(ref, () => ({
    focusTitle: () => {
      titleRef.current?.focus();
      titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  }), []);

  // Auto-expand title textarea based on content
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(40, el.scrollHeight)}px`;
    }
  }, [value]);

  // Auto-expand body textarea based on content
  useEffect(() => {
    const el = bodyRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(120, el.scrollHeight)}px`;
    }
  }, [body]);

  useEffect(() => {
    if (resetSignal !== undefined) {
      setShowBody(false);
    }
  }, [resetSignal, setShowBody]);

  useEffect(() => {
    if (hasBody && !showBody) {
      setShowBody(true);
    }
  }, [hasBody, showBody, setShowBody]);

  const handleChange = (newValue: string) => {
    if (newValue.length <= limit) {
      onChange(newValue);
    }
  };

  const handleBodyChange = (newValue: string) => {
    if (onBodyChange && newValue.length <= bodyLimit) {
      onBodyChange(newValue);
    }
  };

  const handleBodyToggle = () => {
    if (hasBody) {
      setShowBody(true);
      return;
    }

    setShowBody(!showBody);
  };

  return (
    <div className="space-y-1">
      {/* Title Input */}
      <div>
        <div className="relative">
          <Textarea
            ref={titleRef}
            placeholder="Post title"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="resize-none min-h-[40px] overflow-hidden pr-14"
            rows={1}
          />
          <button
            type="button"
            onClick={() => setIsAiDialogOpen(true)}
            className="absolute right-2 top-2 inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background/90 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background cursor-pointer"
            aria-label="Generate title options with AI"
            title="Generate title options with AI"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI</span>
          </button>
        </div>
        <div className="flex justify-end mt-1">
          <span className={`text-xs ${count > limit * 0.9 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {count}/{limit}
          </span>
        </div>
      </div>

      {/* Body/Description Toggle */}
      <div>
        <button
          type="button"
          onClick={handleBodyToggle}
          aria-expanded={showBody}
          aria-controls="post-composer-body"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {showBody ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>Add description{body && body.length > 0 ? ` (${body.length} chars)` : ''}</span>
        </button>
        
        {showBody && onBodyChange && (
          <div className="mt-2" id="post-composer-body">
            <Textarea
              ref={bodyRef}
              placeholder="Description (optional)"
              value={body || ''}
              onChange={(e) => handleBodyChange(e.target.value)}
              className="resize-none min-h-[120px] overflow-hidden"
              rows={4}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                Description (optional)
              </span>
              <span className={`text-xs ${(body?.length || 0) > bodyLimit * 0.9 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {body?.length || 0}/{bodyLimit}
              </span>
            </div>
          </div>
        )}
      </div>

      <CopyGenerationDialog
        open={isAiDialogOpen}
        onOpenChange={setIsAiDialogOpen}
        kind="title"
        onApply={onChange}
        baseText={value}
        globalTitle={value}
        globalBody={body}
        selectedSubreddits={aiContext?.selectedSubreddits}
        mediaType={aiContext?.mediaType}
      />
    </div>
  );
});

export default PostComposer;
