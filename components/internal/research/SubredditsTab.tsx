import { Button } from '@/components/ui/button';
import type { WorkspaceSubreddit } from './types';
import { formatNumber } from './helpers';
import { ScanConfigCard } from './ScanConfigCard';

interface SubredditsTabProps {
  wsSubreddits: WorkspaceSubreddit[];
  subredditsInput: string;
  setSubredditsInput: (v: string) => void;
  addingSubreddits: boolean;
  handleAddSubreddits: () => Promise<void>;
  handleRemoveSubreddit: (sub: string) => Promise<void>;
  error: string;
}

export const SubredditsTab = ({
  wsSubreddits,
  subredditsInput,
  setSubredditsInput,
  addingSubreddits,
  handleAddSubreddits,
  handleRemoveSubreddit,
  error,
}: SubredditsTabProps) => (
  <div className="flex flex-col gap-4">
    <ScanConfigCard
      subredditsInput={subredditsInput}
      setSubredditsInput={setSubredditsInput}
      addingSubreddits={addingSubreddits}
      handleAddSubreddits={handleAddSubreddits}
      error={error}
    />

    {wsSubreddits.length === 0 ? (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 py-16 text-center">
        <p className="text-sm text-muted-foreground">Add subreddits above to start building your research dataset.</p>
      </div>
    ) : (
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            {wsSubreddits.length} subreddit{wsSubreddits.length !== 1 ? 's' : ''} in research
            {wsSubreddits.filter((s) => s.scanStatus === 'pending').length > 0 && (
              <span className="ml-1 text-amber-400">
                ({wsSubreddits.filter((s) => s.scanStatus === 'pending').length} pending)
              </span>
            )}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Subreddit</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Posts</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground" />
            </tr>
          </thead>
          <tbody>
            {wsSubreddits.map((item) => (
              <tr key={item.subreddit} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                <td className="px-4 py-2 font-mono text-sm">
                  <a
                    href={`https://www.reddit.com/r/${item.subreddit}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 hover:underline"
                    tabIndex={0}
                    aria-label={`View r/${item.subreddit}`}
                  >
                    r/{item.subreddit}
                  </a>
                </td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      item.scanStatus === 'scanned'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {item.scanStatus === 'scanned' ? 'Scanned' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatNumber(item.postCount)}</td>
                <td className="px-4 py-2 text-right">
                  {item.postCount === 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                      onClick={() => handleRemoveSubreddit(item.subreddit)}
                      aria-label={`Remove r/${item.subreddit}`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
