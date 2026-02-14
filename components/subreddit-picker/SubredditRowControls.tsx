import React from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

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
}) => {
  const showTagControls = isSelected && hasRequiredStrings;

  if (!isSelected || (!showTagControls && flairOptions.length === 0)) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-b from-zinc-50/50 to-zinc-200/50 dark:from-zinc-800/30 dark:to-zinc-900/60"
      onClick={onControlsClick}
    >
      {flairOptions.length > 0 && (
        <NativeSelect
          value={flairValue || ''}
          onValueChange={(value) => onFlairChange(name, value)}
          placeholder={flairRequired ? 'Select flair *' : 'Select flair'}
          options={flairOptions.map((f) => ({
            value: f.id,
            label: f.text || '—',
          }))}
          className="flex-1 min-w-[90px] max-w-[50%]"
          triggerClassName="h-8 text-xs font-medium bg-white/70 dark:bg-zinc-800/70 hover:bg-white/90 dark:hover:bg-zinc-800/90 border-0 shadow-sm"
          aria-label={`Pick flair for r/${name}`}
        />
      )}

      {showTagControls && (
        showCustomInput ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              className="h-8 flex-1 w-full text-xs px-2.5 bg-white/70 dark:bg-zinc-800/70 border-0 shadow-sm"
              placeholder="e.g. (f), 25F"
              value={titleSuffix || ''}
              onChange={(e) => onTitleSuffixChange(name, e.target.value)}
              title="Add a tag to your title for this community"
              aria-label={`Title suffix for r/${name}`}
            />
            <button
              onClick={() => onShowCustomInputChange(false)}
              className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer p-1.5 rounded hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50"
              aria-label="Switch to dropdown"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <NativeSelect
            value={isCustomSuffix ? '__custom__' : (titleSuffix || '')}
            onValueChange={onSuffixSelectChange}
            placeholder="Select tag"
            options={[
              ...suffixOptions.map((opt) => ({ value: opt, label: opt })),
              { value: '__custom__', label: 'Custom…' },
            ]}
            className="flex-1 min-w-[80px]"
            triggerClassName="h-8 text-xs font-medium bg-white/70 dark:bg-zinc-800/70 hover:bg-white/90 dark:hover:bg-zinc-800/90 border-0 shadow-sm"
            aria-label={`Title tag for r/${name}`}
          />
        )
      )}
    </div>
  );
};

export default SubredditRowControls;
