import React from 'react';
import axios from 'axios';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  options: string[];
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  flairValue: Record<string, string | undefined>;
  onFlairChange: (v: Record<string, string | undefined>) => void;
  newSub: string;
  setNewSub: (value: string) => void;
  addCustomSub: () => void;
}

export default function SubredditFlairPicker({ options, selected, onSelectedChange, flairValue, onFlairChange, newSub, setNewSub, addCustomSub }: Props) {
  const [query, setQuery] = React.useState('');
  const [flairOptions, setFlairOptions] = React.useState<Record<string, { id: string; text: string }[]>>({});
  const [flairRequired, setFlairRequired] = React.useState<Record<string, boolean>>({});
  const [loadingFlairs, setLoadingFlairs] = React.useState<Record<string, boolean>>({});
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const filtered = React.useMemo(() => options.filter(o => o.toLowerCase().includes(query.toLowerCase())), [options, query]);

  const toggle = (name: string) => {
    const exists = selected.includes(name);
    const next = exists ? selected.filter(s => s !== name) : (selected.length < 30 ? [...selected, name] : selected);
    onSelectedChange(next);
  };

  // Load all flair requirements upfront
  React.useEffect(() => {
    const loadAllFlairRequirements = async () => {
      const uncachedOptions = options.filter(name => !flairOptions[name]);
      if (uncachedOptions.length === 0) {
        setIsInitialLoad(false);
        return;
      }

      // Set loading state for all uncached options
      const loadingStates: Record<string, boolean> = {};
      uncachedOptions.forEach(name => {
        loadingStates[name] = true;
      });
      setLoadingFlairs(loadingStates);

      // Load all at once with Promise.all
      const promises = uncachedOptions.map(async (sr) => {
        try {
          const { data } = await axios.get('/api/flairs', { params: { subreddit: sr } });
          return { sr, flairs: data.flairs || [], required: data.required || false };
        } catch {
          return { sr, flairs: [], required: false };
        }
      });

      try {
        const results = await Promise.all(promises);
        const newFlairOptions: Record<string, { id: string; text: string }[]> = {};
        const newFlairRequired: Record<string, boolean> = {};

        results.forEach(({ sr, flairs, required }) => {
          newFlairOptions[sr] = flairs;
          newFlairRequired[sr] = required;
        });

        setFlairOptions(prev => ({ ...prev, ...newFlairOptions }));
        setFlairRequired(prev => ({ ...prev, ...newFlairRequired }));
      } finally {
        // Clear all loading states
        setLoadingFlairs({});
        setIsInitialLoad(false);
      }
    };

    loadAllFlairRequirements();
  }, [options]);

  const handleFlairChange = (sr: string, id: string) => {
    onFlairChange({ ...flairValue, [sr]: id || undefined });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search subreddits"
          value={newSub}
          onChange={(e) => setNewSub(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={addCustomSub} className="px-3 py-2 h-9">
          Add
        </Button>
        <Input
          placeholder="Filter list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">{selected.length}/30</span>
      </div>

      <div className="divide-y rounded-lg border">
        {filtered.map((name) => {
          const isSelected = selected.includes(name);
          return (
            <div key={name} className="flex items-center gap-3 px-3 py-3">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggle(name)}
              />
              <div className="flex-1 flex items-center gap-2">
                <Label className="text-sm truncate cursor-pointer" onClick={() => toggle(name)}>
                  r/{name}
                </Label>
                {loadingFlairs[name] && (
                  <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                )}
                {!loadingFlairs[name] && isSelected && flairRequired[name] && (
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                )}
                {!loadingFlairs[name] && isSelected && flairRequired[name] === false && (
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                )}
              </div>
              {isSelected && (flairOptions[name] || []).length > 0 && (
                <select
                  className="flex h-8 w-32 rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={flairValue[name] || ''}
                  onChange={(e) => handleFlairChange(name, e.target.value)}
                >
                  <option value="">{flairRequired[name] ? 'Select flair...' : 'No flair'}</option>
                  {(flairOptions[name] || []).map((f) => (
                    <option key={f.id} value={f.id}>{f.text || '—'}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No results</div>
        )}
      </div>
    </div>
  );
} 