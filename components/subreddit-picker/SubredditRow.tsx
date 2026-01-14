import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info } from 'lucide-react';
import { TitleTag } from '../../utils/subredditCache';

export interface SubredditRules {
  requiresGenderTag: boolean;
  requiresContentTag: boolean;
  genderTags: string[];
  contentTags: string[];
  titleTags?: TitleTag[];
  submitText?: string;
}

export interface SubredditRowProps {
  name: string;
  hasError: boolean;
  isSelected: boolean;
  isLoading?: boolean;
  flairRequired?: boolean;
  flairOptions: { id: string; text: string }[];
  subredditRules?: SubredditRules;
  titleSuffix?: string;
  flairValue?: string;
  onToggle: (name: string) => void;
  onFlairChange: (name: string, id: string) => void;
  onTitleSuffixChange: (name: string, suffix: string) => void;
}

const SubredditRow = React.memo(({
  name,
  hasError,
  isSelected,
  isLoading,
  flairRequired,
  flairOptions,
  subredditRules,
  titleSuffix,
  flairValue,
  onToggle,
  onFlairChange,
  onTitleSuffixChange
}: SubredditRowProps) => {
  const checkboxId = `checkbox-${name}`;

  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('select') || target.closest('input') || target.closest('button') || target.closest('.group')) {
      return;
    }
    onToggle(name);
  };

  const handleCheckboxContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const handleControlsClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-3 sm:px-4 py-3 transition-colors cursor-pointer
        ${hasError ? 'bg-red-500/20 border-l-2 border-red-500' : 'hover:bg-secondary'}
      `}
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      aria-label={`Toggle r/${name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(name);
        }
      }}
    >
      <div className="flex items-center" onClick={handleCheckboxContainerClick}>
        <Checkbox
          id={checkboxId}
          checked={isSelected}
          onCheckedChange={() => onToggle(name)}
        />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {hasError && (
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" aria-hidden="true" />
        )}
        <span
          className={`text-sm truncate select-none ${hasError ? 'text-red-400' : ''}`}
        >
          r/{name}
        </span>

        {/* Loading indicator */}
        {isLoading && (
          <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" aria-label="Loading" />
        )}

        {/* Desktop Badges */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {!isLoading && isSelected && flairRequired && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Required
            </Badge>
          )}
          {!isLoading && isSelected && flairRequired === false && flairOptions.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Optional
            </Badge>
          )}
          {!isLoading && isSelected && subredditRules?.requiresGenderTag && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              (f)/(c)
            </Badge>
          )}
        </div>

        {/* Mobile badges */}
        <div className="flex sm:hidden items-center gap-1">
          {!isLoading && isSelected && flairRequired && (
            <span className="text-red-500 text-xs font-bold">*</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-shrink-0" onClick={handleControlsClick}>
        {/* Rules Tooltip */}
        {isSelected && subredditRules?.submitText && (
          <div className="relative group hidden sm:block">
            <Info 
              className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" 
              aria-label="View posting rules"
            />
            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg border border-border shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 w-64 max-h-40 overflow-y-auto">
              <div className="font-medium mb-1 text-foreground">Posting Rules:</div>
              <div className="whitespace-pre-wrap break-words text-muted-foreground">{subredditRules.submitText}</div>
            </div>
          </div>
        )}

        {/* Custom Title Suffix Input */}
        {isSelected && (
          <Input
            className="h-8 w-16 sm:w-20 text-xs px-2"
            placeholder="Suffix"
            value={titleSuffix || ''}
            onChange={(e) => onTitleSuffixChange(name, e.target.value)}
            title="Custom title suffix (e.g., (f), 25F, [OC])"
            aria-label={`Title suffix for r/${name}`}
          />
        )}

        {/* Flair Dropdown */}
        {isSelected && flairOptions.length > 0 && (
          <select
            className={`
              h-8 w-24 sm:w-32 rounded-md border px-2 text-xs bg-input text-foreground cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-primary
              ${hasError
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-border'
              }
            `}
            value={flairValue || ''}
            onChange={(e) => onFlairChange(name, e.target.value)}
            aria-label={`Select flair for r/${name}`}
          >
            <option value="">{flairRequired ? 'Select flair...' : 'No flair'}</option>
            {flairOptions.map((f) => (
              <option key={f.id} value={f.id}>{f.text || '—'}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
});

SubredditRow.displayName = 'SubredditRow';

export default SubredditRow;
