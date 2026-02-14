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
      className="flex items-center gap-2 px-3 sm:px-4 pb-3 pt-3 border-t border-border/60 bg-secondary/20"
      onClick={onControlsClick}
    >
      {flairOptions.length > 0 && (
        <NativeSelect
          value={flairValue || ''}
          onValueChange={(value) => onFlairChange(name, value === '_none' ? '' : value)}
          placeholder={flairRequired ? 'Flair (required)' : 'Flair'}
          options={[
            ...(!flairRequired ? [{ value: '_none', label: 'No flair' }] : []),
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
};

export default SubredditRowControls;
