import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { PerSubredditOverride } from './CustomizePostDialog';

interface SubredditRowMainProps {
  name: string;
  hasError: boolean;
  isSelected: boolean;
  isLoading?: boolean;
  checkboxId: string;
  contentOverride?: PerSubredditOverride;
  onToggle: (name: string) => void;
}

const SubredditRowMain: React.FC<SubredditRowMainProps> = ({
  name,
  hasError,
  isSelected,
  isLoading,
  checkboxId,
  contentOverride,
  onToggle,
}) => {
  const hasCustomContent = !!(contentOverride && (contentOverride.title || contentOverride.body));

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="flex items-center justify-center w-8 h-8 -m-1 flex-shrink-0 cursor-pointer rounded-md hover:bg-secondary/50 active:bg-secondary/80 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(name);
        }}
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
        <Checkbox
          id={checkboxId}
          checked={isSelected}
          onCheckedChange={() => onToggle(name)}
          className="h-5 w-5"
          tabIndex={-1}
        />
      </div>

      <div className="flex items-center gap-2 min-w-0">
        {hasError && (
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" aria-hidden="true" />
        )}
        <span className={`text-[15px] sm:text-sm truncate select-none font-semibold sm:font-medium ${hasError ? 'text-red-400' : ''}`}>
          r/{name}
        </span>

        {isLoading && (
          <div className="w-3.5 h-3.5 border-2 border-muted border-t-primary rounded-full animate-spin flex-shrink-0" aria-label="Loading" />
        )}

        {!isLoading && isSelected && hasCustomContent && (
          <Badge variant="secondary" className="h-4.5 px-1.5 text-[9px] uppercase font-bold tracking-wider text-primary bg-primary/10 hover:bg-primary/20 flex-shrink-0" title="Custom content for this community">
            Custom
          </Badge>
        )}
      </div>
    </div>
  );
};

export default SubredditRowMain;
