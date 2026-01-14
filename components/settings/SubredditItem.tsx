import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Edit2, X, Trash2, Loader2 } from 'lucide-react';
import { useSettingsContext } from './SettingsContext';
import { SubredditItem as SubredditItemType, Category } from './types';

interface SubredditItemComponentProps {
  subreddit: SubredditItemType;
  category: Category;
  dragHandleProps: Record<string, unknown>;
  isDragging: boolean;
}

const SubredditItemComponent: React.FC<SubredditItemComponentProps> = ({
  subreddit,
  dragHandleProps,
  isDragging
}) => {
  const [editingSubreddit, setEditingSubreddit] = React.useState(false);
  const { updateSubreddit, deleteSubreddit, loading, errors } = useSettingsContext();

  const handleUpdateSubredditName = async (newName: string) => {
    if (newName.trim() && newName !== subreddit.subreddit_name) {
      await updateSubreddit(subreddit.id, { subreddit_name: newName.trim() });
    }
    setEditingSubreddit(false);
  };

  const handleDeleteSubreddit = async () => {
    await deleteSubreddit(subreddit.id);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleUpdateSubredditName((e.target as HTMLInputElement).value);
    }
  };

  const isLoading = loading[subreddit.subreddit_name.toLowerCase()];
  const error = errors[subreddit.subreddit_name.toLowerCase()];

  return (
    <div className={`
      flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/20 border border-border/30 
      transition-all duration-200 hover:bg-secondary/30
      ${isDragging ? 'opacity-50 ring-2 ring-primary/50' : ''}
    `}>
      <div {...dragHandleProps} className="cursor-grab">
        <GripVertical className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
      </div>
      
      {editingSubreddit ? (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-muted-foreground">r/</span>
          <Input
            defaultValue={subreddit.subreddit_name}
            onKeyPress={handleKeyPress}
            onBlur={(e) => handleUpdateSubredditName(e.target.value)}
            autoFocus
            className="h-7 text-xs bg-secondary/50 border-border/50"
            aria-label="Edit subreddit name"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingSubreddit(false)}
            className="h-7 w-7 p-0 cursor-pointer"
            aria-label="Cancel editing"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm">r/{subreddit.subreddit_name}</span>
            {isLoading && (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" aria-label="Loading" />
            )}
            {error && (
              <span className="text-xs text-red-400" title={error} aria-label={`Error: ${error}`}>⚠️</span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingSubreddit(true)}
            className="h-7 w-7 p-0 hover:bg-secondary cursor-pointer"
            aria-label={`Edit r/${subreddit.subreddit_name}`}
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeleteSubreddit}
            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
            aria-label={`Delete r/${subreddit.subreddit_name}`}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </>
      )}
    </div>
  );
};

export default SubredditItemComponent;
