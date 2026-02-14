import React from 'react';
import { X, Tag, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

// Variant types for different UI styles
export type ControlsVariant = 1 | 2 | 3 | 4;

interface SubredditRowControlsProps {
  name: string;
  isSelected: boolean;
  flairRequired?: boolean;
  flairOptions: { id: string; text: string }[];
  flairValue?: string;
  titleSuffix?: string;
  hasRequiredStrings: boolean;
  suffixOptions: string[];
  showCustomInput: boolean;
  isCustomSuffix: boolean;
  onFlairChange: (name: string, id: string) => void;
  onTitleSuffixChange: (name: string, suffix: string) => void;
  onSuffixSelectChange: (value: string) => void;
  onShowCustomInputChange: (value: boolean) => void;
  onControlsClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  variant?: ControlsVariant;
}

const SubredditRowControls: React.FC<SubredditRowControlsProps> = ({
  name,
  isSelected,
  flairRequired,
  flairOptions,
  flairValue,
  titleSuffix,
  hasRequiredStrings,
  suffixOptions,
  showCustomInput,
  isCustomSuffix,
  onFlairChange,
  onTitleSuffixChange,
  onSuffixSelectChange,
  onShowCustomInputChange,
  onControlsClick,
  variant = 1,
}) => {
  const showTagControls = isSelected && hasRequiredStrings;

  if (!isSelected || (!showTagControls && flairOptions.length === 0)) {
    return null;
  }

  // Variant 1: Original - subtle background with border separator
  if (variant === 1) {
    return (
      <div
        className="flex items-center gap-2 px-3 sm:px-4 pb-3 pt-3 border-t border-border/60 bg-secondary/20"
        onClick={onControlsClick}
      >
        {flairOptions.length > 0 && (
          <NativeSelect
            value={flairValue || ''}
            onValueChange={(value) => onFlairChange(name, value === '__clear__' || value === '_none' ? '' : value)}
            placeholder={flairRequired ? 'Flair (required)' : 'Flair'}
            options={[
              { value: '__clear__', label: 'Clear flair' },
              ...flairOptions.map((f) => ({
                value: f.id,
                label: f.text || '—',
              })),
            ]}
            className="flex-1 min-w-[100px] max-w-[50%] flex-shrink-0"
            triggerClassName="h-9 sm:h-8 text-xs font-medium bg-secondary/80 hover:bg-secondary"
            aria-label={`Pick flair for r/${name}`}
          />
        )}

        {showTagControls && (
          <>
            {!showCustomInput ? (
              <NativeSelect
                value={isCustomSuffix ? '__custom__' : (titleSuffix || '__none__')}
                onValueChange={onSuffixSelectChange}
                placeholder="Title tag"
                options={[
                  { value: '__none__', label: 'None' },
                  ...suffixOptions.map((opt) => ({ value: opt, label: opt })),
                  { value: '__custom__', label: 'Custom tag…' },
                ]}
                className="flex-1 min-w-[90px] sm:min-w-[80px] flex-shrink-0"
                triggerClassName="h-9 sm:h-8 text-xs font-medium bg-secondary/80 hover:bg-secondary"
                aria-label={`Title tag for r/${name}`}
              />
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0 flex-1">
                <Input
                  className="h-9 sm:h-8 flex-1 w-full text-xs px-2.5"
                  placeholder="e.g. (f), 25F"
                  value={titleSuffix || ''}
                  onChange={(e) => onTitleSuffixChange(name, e.target.value)}
                  title="Add a tag to your title for this community"
                  aria-label={`Title suffix for r/${name}`}
                />
                <button
                  onClick={() => onShowCustomInputChange(false)}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer p-2"
                  aria-label="Switch to dropdown"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Variant 2: Inset card style - deeper indentation with left accent
  if (variant === 2) {
    return (
      <div
        className="mx-2 sm:mx-3 mb-2 rounded-md border-l-2 border-l-primary/40 bg-muted/50 shadow-inner"
        onClick={onControlsClick}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Tag className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          {flairOptions.length > 0 && (
            <NativeSelect
              value={flairValue || ''}
              onValueChange={(value) => onFlairChange(name, value === '__clear__' || value === '_none' ? '' : value)}
              placeholder={flairRequired ? 'Flair *' : 'Flair'}
              options={[
                { value: '__clear__', label: 'Clear flair' },
                ...flairOptions.map((f) => ({
                  value: f.id,
                  label: f.text || '—',
                })),
              ]}
              className="flex-1 min-w-[90px] max-w-[45%]"
              triggerClassName="h-8 text-xs font-medium bg-background/80 hover:bg-background border-border/50"
              aria-label={`Pick flair for r/${name}`}
            />
          )}

          {showTagControls && (
            <>
              {!showCustomInput ? (
                <NativeSelect
                  value={isCustomSuffix ? '__custom__' : (titleSuffix || '__none__')}
                  onValueChange={onSuffixSelectChange}
                  placeholder="Tag"
                  options={[
                    { value: '__none__', label: 'None' },
                    ...suffixOptions.map((opt) => ({ value: opt, label: opt })),
                    { value: '__custom__', label: 'Custom…' },
                  ]}
                  className="flex-1 min-w-[80px]"
                  triggerClassName="h-8 text-xs font-medium bg-background/80 hover:bg-background border-border/50"
                  aria-label={`Title tag for r/${name}`}
                />
              ) : (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    className="h-8 flex-1 w-full text-xs px-2.5 bg-background/80 border-border/50"
                    placeholder="e.g. (f), 25F"
                    value={titleSuffix || ''}
                    onChange={(e) => onTitleSuffixChange(name, e.target.value)}
                    title="Add a tag to your title for this community"
                    aria-label={`Title suffix for r/${name}`}
                  />
                  <button
                    onClick={() => onShowCustomInputChange(false)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer p-1.5 rounded hover:bg-background/50"
                    aria-label="Switch to dropdown"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Variant 3: Compact inline pills - tighter spacing with pill-style selects
  if (variant === 3) {
    return (
      <div
        className="flex items-center gap-1.5 px-3 sm:px-4 pb-2.5 pt-0"
        onClick={onControlsClick}
      >
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mr-1">Options:</span>
        {flairOptions.length > 0 && (
          <NativeSelect
            value={flairValue || ''}
            onValueChange={(value) => onFlairChange(name, value === '__clear__' || value === '_none' ? '' : value)}
            placeholder={flairRequired ? 'Flair*' : 'Flair'}
            options={[
              { value: '__clear__', label: 'Clear' },
              ...flairOptions.map((f) => ({
                value: f.id,
                label: f.text || '—',
              })),
            ]}
            className="min-w-[80px] max-w-[40%]"
            triggerClassName="h-7 text-[11px] font-medium rounded-full bg-primary/10 hover:bg-primary/20 border-0 px-3 text-primary"
            aria-label={`Pick flair for r/${name}`}
          />
        )}

        {showTagControls && (
          <>
            {!showCustomInput ? (
              <NativeSelect
                value={isCustomSuffix ? '__custom__' : (titleSuffix || '__none__')}
                onValueChange={onSuffixSelectChange}
                placeholder="Tag"
                options={[
                  { value: '__none__', label: 'None' },
                  ...suffixOptions.map((opt) => ({ value: opt, label: opt })),
                  { value: '__custom__', label: 'Custom…' },
                ]}
                className="min-w-[70px]"
                triggerClassName="h-7 text-[11px] font-medium rounded-full bg-violet-500/10 hover:bg-violet-500/20 border-0 px-3 text-violet-400"
                aria-label={`Title tag for r/${name}`}
              />
            ) : (
              <div className="flex items-center gap-1 flex-1 max-w-[50%]">
                <Input
                  className="h-7 flex-1 text-[11px] px-2.5 rounded-full bg-violet-500/10 border-0 text-violet-400 placeholder:text-violet-400/50"
                  placeholder="e.g. (f)"
                  value={titleSuffix || ''}
                  onChange={(e) => onTitleSuffixChange(name, e.target.value)}
                  title="Add a tag to your title for this community"
                  aria-label={`Title suffix for r/${name}`}
                />
                <button
                  onClick={() => onShowCustomInputChange(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
                  aria-label="Switch to dropdown"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Variant 4: Stacked layout with labels - vertical arrangement with clear labels
  if (variant === 4) {
    return (
      <div
        className="border-t border-border/40 bg-gradient-to-b from-secondary/30 to-secondary/10"
        onClick={onControlsClick}
      >
        <div className="px-3 sm:px-4 py-2.5 space-y-2">
          {flairOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 min-w-[60px]">
                <Hash className="w-3 h-3 text-orange-400/80" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Flair</span>
                {flairRequired && <span className="text-[9px] text-orange-400">*</span>}
              </div>
              <NativeSelect
                value={flairValue || ''}
                onValueChange={(value) => onFlairChange(name, value === '__clear__' || value === '_none' ? '' : value)}
                placeholder="Select flair"
                options={[
                  { value: '__clear__', label: 'No flair' },
                  ...flairOptions.map((f) => ({
                    value: f.id,
                    label: f.text || '—',
                  })),
                ]}
                className="flex-1"
                triggerClassName="h-8 text-xs font-medium bg-background/60 hover:bg-background/80 border-border/40"
                aria-label={`Pick flair for r/${name}`}
              />
            </div>
          )}

          {showTagControls && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 min-w-[60px]">
                <Tag className="w-3 h-3 text-blue-400/80" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Tag</span>
              </div>
              {!showCustomInput ? (
                <NativeSelect
                  value={isCustomSuffix ? '__custom__' : (titleSuffix || '__none__')}
                  onValueChange={onSuffixSelectChange}
                  placeholder="Select tag"
                  options={[
                    { value: '__none__', label: 'No tag' },
                    ...suffixOptions.map((opt) => ({ value: opt, label: opt })),
                    { value: '__custom__', label: 'Custom tag…' },
                  ]}
                  className="flex-1"
                  triggerClassName="h-8 text-xs font-medium bg-background/60 hover:bg-background/80 border-border/40"
                  aria-label={`Title tag for r/${name}`}
                />
              ) : (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    className="h-8 flex-1 w-full text-xs px-2.5 bg-background/60 border-border/40"
                    placeholder="e.g. (f), 25F"
                    value={titleSuffix || ''}
                    onChange={(e) => onTitleSuffixChange(name, e.target.value)}
                    title="Add a tag to your title for this community"
                    aria-label={`Title suffix for r/${name}`}
                  />
                  <button
                    onClick={() => onShowCustomInputChange(false)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer p-1.5 rounded hover:bg-background/50"
                    aria-label="Switch to dropdown"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default fallback (should not reach here)
  return null;
};

export default SubredditRowControls;
