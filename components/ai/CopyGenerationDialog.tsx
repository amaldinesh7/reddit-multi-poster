import React from 'react';
import { 
  Check,
  ChevronDown,
  Loader2, 
  MessageSquare, 
  RefreshCw, 
  Rocket, 
  Smile, 
  Sparkles, 
  Target, 
  TrendingUp, 
  User, 
  X, 
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { usePointerCoarse } from '@/hooks/usePointerCoarse';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

export type CopyGenerationKind = 'title' | 'description';
export type CopyGenerationTone = 'straightforward' | 'viral' | 'discussion' | 'excited' | 'personal' | 'humor' | 'professional';
export type CopyGenerationProvider = 'auto' | 'gemini' | 'groq';

interface CopyGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: CopyGenerationKind;
  onApply: (value: string) => void;
  baseText: string;
  globalTitle?: string;
  globalBody?: string;
  selectedSubreddits?: string[];
  subreddit?: string;
  mediaType?: 'self' | 'link' | 'image' | 'video' | 'gallery';
}

interface GenerateCopyApiResponse {
  success: boolean;
  data?: {
    options: string[];
    provider: 'gemini' | 'groq' | 'fallback';
    fallbackUsed: boolean;
  };
  error?: string;
}

interface RedditPostsApiResponse {
  success: boolean;
  data?: { titles: string[] };
  error?: { message: string };
}

interface ToneOption {
  value: CopyGenerationTone;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const toneOptions: ToneOption[] = [
  { value: 'straightforward', label: 'Direct', icon: Target },
  { value: 'viral', label: 'Viral', icon: TrendingUp },
  { value: 'discussion', label: 'Discussion', icon: MessageSquare },
  { value: 'excited', label: 'Hyped', icon: Zap },
  { value: 'personal', label: 'Personal', icon: User },
  { value: 'humor', label: 'Funny', icon: Smile },
  { value: 'professional', label: 'Pro', icon: Rocket },
];

const providerLabels: Record<CopyGenerationProvider, string> = {
  auto: 'Auto',
  gemini: 'Gemini',
  groq: 'Groq',
};

const providerOrder: CopyGenerationProvider[] = ['auto', 'gemini', 'groq'];

const CopyGenerationDialog: React.FC<CopyGenerationDialogProps> = ({
  open,
  onOpenChange,
  kind,
  onApply,
  baseText,
  globalTitle,
  globalBody,
  selectedSubreddits,
  subreddit,
  mediaType,
}) => {
  const isCoarsePointer = usePointerCoarse();
  const [tone, setTone] = React.useState<CopyGenerationTone>('straightforward');
  const [preferredProvider, setPreferredProvider] = React.useState<CopyGenerationProvider>('auto');
  const [userBrief, setUserBrief] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [options, setOptions] = React.useState<string[]>([]);
  const [usedProvider, setUsedProvider] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [useMyPosts, setUseMyPosts] = React.useState(false);
  const [previousTitles, setPreviousTitles] = React.useState<string[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setIsGenerating(false);
      setOptions([]);
      setUsedProvider(null);
      setError(null);
      setTone('straightforward');
      setPreferredProvider('auto');
      setUserBrief('');
      setUseMyPosts(false);
      setPreviousTitles([]);
    }
  }, [open]);

  // Use refs for regeneration
  const userBriefRef = React.useRef(userBrief);
  const toneRef = React.useRef(tone);
  const preferredProviderRef = React.useRef(preferredProvider);
  const previousTitlesRef = React.useRef(previousTitles);
  const useMyPostsRef = React.useRef(useMyPosts);

  React.useEffect(() => { userBriefRef.current = userBrief; }, [userBrief]);
  React.useEffect(() => { toneRef.current = tone; }, [tone]);
  React.useEffect(() => { preferredProviderRef.current = preferredProvider; }, [preferredProvider]);
  React.useEffect(() => { previousTitlesRef.current = previousTitles; }, [previousTitles]);
  React.useEffect(() => { useMyPostsRef.current = useMyPosts; }, [useMyPosts]);

  const handleToggleMyPosts = React.useCallback(async (checked: boolean) => {
    setUseMyPosts(checked);
    if (checked && previousTitles.length === 0) {
      setIsLoadingPosts(true);
      try {
        const res = await fetch('/api/user/reddit-posts?limit=15');
        const data = (await res.json()) as RedditPostsApiResponse;
        if (data.success && data.data?.titles) {
          setPreviousTitles(data.data.titles);
        }
      } catch {
        toast.error({ title: 'Could not fetch posts' });
        setUseMyPosts(false);
      } finally {
        setIsLoadingPosts(false);
      }
    }
  }, [previousTitles.length]);

  const handleGenerate = React.useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          count: 3,
          baseText,
          globalTitle,
          globalBody,
          selectedSubreddits,
          subreddit,
          mediaType,
          userBrief: userBriefRef.current,
          tone: toneRef.current,
          preferredProvider: preferredProviderRef.current,
          previousTitles: useMyPostsRef.current ? previousTitlesRef.current : undefined,
        }),
      });

      const payload = (await response.json()) as GenerateCopyApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Could not generate options');
      }

      setOptions(payload.data.options);
      setUsedProvider(payload.data.provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not generate options';
      setError(message);
      toast.error({ title: 'Generation failed', description: message });
    } finally {
      setIsGenerating(false);
    }
  }, [kind, baseText, globalTitle, globalBody, selectedSubreddits, subreddit, mediaType]);

  const handleApply = React.useCallback((value: string) => {
    onApply(value);
    onOpenChange(false);
  }, [onApply, onOpenChange]);

  const title = kind === 'title' ? 'Title Generator' : 'Description Generator';

  const modelSelector = (
    <DropdownMenu
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label="Select AI model"
        >
          {providerLabels[preferredProvider]}
          <ChevronDown className="h-3 w-3" />
        </button>
      }
    >
      {providerOrder.map((provider) => (
        <DropdownMenuItem
          key={provider}
          onClick={() => setPreferredProvider(provider)}
          className="flex items-center justify-between gap-2"
        >
          <span>{providerLabels[provider]}</span>
          {preferredProvider === provider && (
            <Check className="h-3.5 w-3.5 text-primary" />
          )}
        </DropdownMenuItem>
      ))}
    </DropdownMenu>
  );

  const content = (
    <div className="space-y-4">
      {/* Textarea */}
      <div className="space-y-1.5">
        <label htmlFor="copy-brief" className="text-xs text-muted-foreground">
          Describe your post
        </label>
        <Textarea
          id="copy-brief"
          value={userBrief}
          onChange={(e) => setUserBrief(e.target.value.slice(0, 300))}
          placeholder={kind === 'title' ? 'What is your post about?' : 'Key points to cover'}
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Style pills */}
      <fieldset className="space-y-1.5 border-0 p-0 m-0">
        <legend className="text-xs text-muted-foreground">Style</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tone style">
          {toneOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = tone === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTone(opt.value)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon className="h-3 w-3" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Use my posts checkbox */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={useMyPosts}
            onCheckedChange={(checked) => handleToggleMyPosts(!!checked)}
            disabled={isLoadingPosts}
          />
          <span className="text-xs text-muted-foreground">
            {isLoadingPosts ? 'Loading posts...' : 'Use my recent posts as context'}
          </span>
        </label>
        {modelSelector}
      </div>

      {/* Generate button */}
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating || isLoadingPosts}
        className="w-full cursor-pointer"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate
          </>
        )}
      </Button>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Results */}
      {options.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {usedProvider && `via ${usedProvider}`}
            </span>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", isGenerating && "animate-spin")} />
              Redo
            </button>
          </div>
          <div className="space-y-1.5">
            {options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleApply(opt)}
                className="w-full text-left px-3 py-2 text-sm rounded-md border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (isCoarsePointer) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="relative">
            <div className="flex items-center justify-between pr-8">
              <DrawerTitle className="text-base">{title}</DrawerTitle>
            </div>
            <DrawerClose className="absolute right-4 top-4 p-1 opacity-70 hover:opacity-100 cursor-pointer">
              <X className="h-4 w-4" />
            </DrawerClose>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-base">{title}</DialogTitle>
          </div>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default CopyGenerationDialog;
