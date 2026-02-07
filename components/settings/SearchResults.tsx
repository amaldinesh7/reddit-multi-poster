import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Users, ExternalLink } from 'lucide-react';
import { Category } from './types';
import { NativeSelect } from '@/components/ui/native-select';

interface SearchResult {
  name: string;
  subscribers: number;
  over18: boolean;
  url: string;
}

interface SearchResultsProps {
  searchResults: SearchResult[];
  searchQuery: string;
  categories: Category[];
  onClose: () => void;
  onAddSubreddit: (categoryId: string, subredditName: string) => void;
}

const formatSubscribers = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

const SearchResults: React.FC<SearchResultsProps> = ({
  searchResults,
  searchQuery,
  categories,
  onClose,
  onAddSubreddit,
}) => {
  const [addingSub, setAddingSub] = React.useState<string | null>(null);

  const handleAdd = async (categoryId: string, subredditName: string) => {
    if (!categoryId) return;
    setAddingSub(subredditName);
    try {
      await onAddSubreddit(categoryId, subredditName);
    } finally {
      // Small delay for visual feedback
      setTimeout(() => setAddingSub(null), 1000);
    }
  };

  return (
    <Card className="glass-card rounded-xl overflow-hidden animate-fadeIn">
      <CardHeader className="p-4 border-b border-border/30 bg-secondary/20">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Communities found</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 cursor-pointer"
            aria-label="Close search results"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 max-h-64 overflow-y-auto">
        {searchResults.length > 0 ? (
          <div className="divide-y divide-border/30">
            {searchResults.map((subreddit) => (
              <div
                key={subreddit.name}
                className="flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">r/{subreddit.name}</span>
                    {subreddit.over18 && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">18+</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" aria-hidden="true" />
                      {formatSubscribers(subreddit.subscribers)}
                    </div>
                    <a
                      href={subreddit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary hidden sm:flex cursor-pointer"
                      aria-label={`View r/${subreddit.name} on Reddit`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </a>
                  </div>
                </div>

                {categories.length > 0 && (
                  <div className="flex-shrink-0 ml-4">
                    <NativeSelect
                      value=""
                      onValueChange={(value) => handleAdd(value, subreddit.name)}
                      disabled={addingSub === subreddit.name}
                      placeholder={addingSub === subreddit.name ? "Adding..." : "Add to list"}
                      options={categories.map((category) => ({
                        value: category.id,
                        label: category.name,
                      }))}
                      className="w-[110px]"
                      triggerClassName="h-8 text-[11px] font-medium bg-secondary/50 border-border/50 hover:bg-secondary transition-colors cursor-pointer"
                      aria-label={`Add r/${subreddit.name} to list`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {searchQuery ? 'No subreddits found' : 'Enter a search term'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SearchResults;
