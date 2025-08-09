import React from 'react';
import axios from 'axios';
import { useSubredditCache } from '../hooks/useSubredditCache';

interface Props {
  subreddits: string[];
  value: Record<string, string | undefined>;
  onChange: (v: Record<string, string | undefined>) => void;
}

export default function FlairManager({ subreddits, value, onChange }: Props) {
  const { getCachedData, fetchAndCache } = useSubredditCache();
  const [options, setOptions] = React.useState<Record<string, { id: string; text: string }[]>>({});
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  const loadFlairs = async (sr: string) => {
    if (options[sr]) return;
    
    // Try to get cached data first
    const cached = getCachedData(sr);
    if (cached) {
      setOptions((prev) => ({ ...prev, [sr]: cached.flairs }));
      return;
    }
    
    // Fallback to API call and cache the result
    try {
      const cachedData = await fetchAndCache(sr);
      setOptions((prev) => ({ ...prev, [sr]: cachedData.flairs }));
    } catch (error) {
      console.error(`Failed to load flairs for ${sr}:`, error);
      setOptions((prev) => ({ ...prev, [sr]: [] }));
    }
  };

  const toggle = async (sr: string) => {
    setOpen((prev) => ({ ...prev, [sr]: !prev[sr] }));
    if (!options[sr]) await loadFlairs(sr);
  };

  const setFlair = (sr: string, id?: string) => {
    onChange({ ...value, [sr]: id });
  };

  return (
    <div className="space-y-2">
      {subreddits.length === 0 && <p className="helper">Select subreddits to configure flairs.</p>}
      {subreddits.map((sr) => (
        <div key={sr} className="card">
          <button type="button" onClick={() => toggle(sr)} className="w-full text-left px-3 py-2 text-sm flex justify-between">
            <span>r/{sr}</span>
            <span className="helper">{open[sr] ? 'Hide' : 'Show'} flairs</span>
          </button>
          {open[sr] && (
            <div className="p-3 border-t border-[var(--color-ring)] space-y-2">
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setFlair(sr, undefined)} className={`px-2 py-1 rounded-full border text-xs ${!value[sr] ? 'border-[var(--primary)] bg-[rgba(124,92,255,0.08)]' : 'border-[var(--color-ring)] bg-[var(--color-surface)]'}`}>No flair</button>
                {(options[sr] || []).map((o) => (
                  <button key={o.id} onClick={() => setFlair(sr, o.id)} className={`px-2 py-1 rounded-full border text-xs ${value[sr] === o.id ? 'border-[var(--primary)] bg-[rgba(124,92,255,0.08)]' : 'border-[var(--color-ring)] bg-[var(--color-surface)]'}`}>{o.text || '—'}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 