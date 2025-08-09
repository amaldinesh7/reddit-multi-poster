import React from 'react';

interface Props {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export default function SubredditSelector({ options, selected, onChange }: Props) {
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => options.filter(o => o.toLowerCase().includes(query.toLowerCase())).slice(0, 100), [options, query]);

  const toggle = (name: string) => {
    const exists = selected.includes(name);
    const next = exists ? selected.filter(s => s !== name) : (selected.length < 30 ? [...selected, name] : selected);
    onChange(next);
  };

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