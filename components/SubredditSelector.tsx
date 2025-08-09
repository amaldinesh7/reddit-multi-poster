import React from 'react';
import { useSubreddits } from '../hooks/useSubreddits';

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

export default function SubredditSelector({ selected, onChange }: Props) {
  const { getSubredditsByCategory, getAllSubreddits, isLoaded } = useSubreddits();
  const [query, setQuery] = React.useState('');
  const [expandedCategories, setExpandedCategories] = React.useState<string[]>([]);
  
  const allSubreddits = getAllSubreddits();
  const categorizedSubreddits = getSubredditsByCategory();
  
  const filtered = React.useMemo(() => {
    if (!query.trim()) return allSubreddits;
    return allSubreddits.filter(o => o.toLowerCase().includes(query.toLowerCase())).slice(0, 100);
  }, [allSubreddits, query]);

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryName) 
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const selectAllInCategory = (subreddits: string[]) => {
    const newSelected = [...new Set([...selected, ...subreddits])];
    if (newSelected.length <= 30) {
      onChange(newSelected);
    }
  };

  const toggle = (name: string) => {
    const exists = selected.includes(name);
    const next = exists ? selected.filter(s => s !== name) : (selected.length < 30 ? [...selected, name] : selected);
    onChange(next);
  };

  if (!isLoaded) {
    return (
      <div className="space-y-2">
        <div className="animate-pulse">
          <div className="h-10 bg-muted rounded-lg mb-2"></div>
          <div className="grid grid-cols-2 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
          placeholder="Search subreddits"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="helper">{selected.length}/30</span>
      </div>
      
      {query.trim() ? (
        // Search results view
        <div className="max-h-56 overflow-y-auto grid grid-cols-2 gap-2">
          {filtered.map(name => (
            <button
              key={name}
              onClick={() => toggle(name)}
              className={`px-3 py-2 rounded-lg text-sm border ${selected.includes(name) ? 'border-[var(--primary)] bg-[rgba(124,92,255,0.08)]' : 'border-[var(--color-ring)] bg-[var(--color-surface)]'}`}
            >
              r/{name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-2 helper">No results</p>
          )}
        </div>
      ) : (
        // Category view
        <div className="max-h-56 overflow-y-auto space-y-3">
          {categorizedSubreddits.map(({ categoryName, subreddits }) => (
            <div key={categoryName} className="border border-[var(--color-ring)] rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(categoryName)}
                className="w-full px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-ring)] flex items-center justify-between hover:bg-muted/50"
              >
                <span className="font-medium text-sm">{categoryName} ({subreddits.length})</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInCategory(subreddits);
                    }}
                    className="text-xs px-2 py-1 rounded bg-[var(--primary)] text-white hover:opacity-80"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {expandedCategories.includes(categoryName) ? '−' : '+'}
                  </span>
                </div>
              </button>
              
              {expandedCategories.includes(categoryName) && (
                <div className="p-2 grid grid-cols-2 gap-2">
                  {subreddits.map(name => (
                    <button
                      key={name}
                      onClick={() => toggle(name)}
                      className={`px-3 py-2 rounded-lg text-sm border ${selected.includes(name) ? 'border-[var(--primary)] bg-[rgba(124,92,255,0.08)]' : 'border-[var(--color-ring)] bg-[var(--color-surface)]'}`}
                    >
                      r/{name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          {categorizedSubreddits.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No subreddits configured.</p>
              <p className="text-xs mt-1">Go to Settings to add subreddits.</p>
            </div>
          )}
        </div>
      )}
      
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selected.map((s) => (
            <span key={s} className="px-2 py-1 text-xs rounded-full border border-[var(--color-ring)] bg-[var(--color-surface)]">r/{s}</span>
          ))}
        </div>
      )}
    </div>
  );
} 