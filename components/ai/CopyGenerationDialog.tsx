import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { usePointerCoarse } from '@/hooks/usePointerCoarse';
import { toast } from '@/hooks/useToast';

export type CopyGenerationKind = 'title' | 'description';
export type CopyGenerationTone = 'neutral' | 'catchy' | 'question' | 'urgent' | 'story';

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

const toneOptions: Array<{ value: CopyGenerationTone; label: string }> = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'catchy', label: 'Catchy' },
  { value: 'question', label: 'Question style' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'story', label: 'Story-like' },
];

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
  const [tone, setTone] = React.useState<CopyGenerationTone>('neutral');
  const [userBrief, setUserBrief] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [options, setOptions] = React.useState<string[]>([]);
  const [provider, setProvider] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setIsGenerating(false);
      setOptions([]);
      setProvider(null);
      setError(null);
      setTone('neutral');
      setUserBrief('');
    }
  }, [open]);

  const handleGenerate = React.useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/generate-copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind,
          count: 3,
          baseText,
          globalTitle,
          globalBody,
          selectedSubreddits,
          subreddit,
          mediaType,
          userBrief,
          tone,
        }),
      });

      const payload = (await response.json()) as GenerateCopyApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Could not generate options');
      }

      setOptions(payload.data.options);
      setProvider(payload.data.provider);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : 'Could not generate options';
      setError(message);
      toast.error({
        title: `AI ${kind} generation failed`,
        description: message,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [kind, baseText, globalTitle, globalBody, selectedSubreddits, subreddit, mediaType, userBrief, tone]);

  const handleApply = React.useCallback((value: string) => {
    onApply(value);
    onOpenChange(false);
  }, [onApply, onOpenChange]);

  const subtitle = kind === 'title'
    ? 'Generate 3 title ideas and pick one.'
    : 'Generate 3 description ideas and pick one.';

  const contextText = subreddit
    ? `Context: r/${subreddit}`
    : `Context: ${(selectedSubreddits?.length || 0)} communities`;

  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="copy-brief" className="text-xs font-medium text-muted-foreground">
          Optional brief
        </label>
        <Textarea
          id="copy-brief"
          value={userBrief}
          onChange={(event) => setUserBrief(event.target.value.slice(0, 300))}
          placeholder={kind === 'title' ? 'Any angle to include?' : 'Any points to include?'}
          rows={3}
          className="min-h-[80px] resize-none"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="copy-tone" className="text-xs font-medium text-muted-foreground">
          Tone
        </label>
        <NativeSelect
          id="copy-tone"
          value={tone}
          onValueChange={(value) => setTone(value as CopyGenerationTone)}
          options={toneOptions.map((option) => ({ value: option.value, label: option.label }))}
          aria-label="Select tone"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {contextText}{mediaType ? ` • Media: ${mediaType}` : ''}
      </p>

      <Button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
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
            Generate 3 options
          </>
        )}
      </Button>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {options.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pick one</p>
            {provider && (
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{provider}</span>
            )}
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {options.map((option, index) => (
              <button
                key={`${option}-${index}`}
                type="button"
                onClick={() => handleApply(option)}
                className="w-full rounded-md border border-border bg-secondary/30 px-3 py-2 text-left text-sm hover:bg-secondary/60 transition-colors cursor-pointer"
              >
                {option}
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
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader>
            <DrawerTitle>AI {kind === 'title' ? 'Title' : 'Description'} Generator</DrawerTitle>
            <DrawerDescription>{subtitle}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-1 overflow-y-auto">{content}</div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI {kind === 'title' ? 'Title' : 'Description'} Generator</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {content}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CopyGenerationDialog;
