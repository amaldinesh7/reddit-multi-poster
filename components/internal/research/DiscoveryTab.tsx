import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DiscoveredSubredditRow } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DiscoveryTabProps {
  discoveredSubs: DiscoveredSubredditRow[];
  discoveredSubsSlice: DiscoveredSubredditRow[];
  addingSubs: Set<string>;
  discoveredPage: number;
  setDiscoveredPage: (v: number | ((p: number) => number)) => void;
  discoveredPageSize: number;
  discoveredTotalPages: number;
  discoveredCollapsed: boolean;
  setDiscoveredCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  handleAddSubreddit: (sub: string) => Promise<void>;
  handleAddAllDiscovered: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DiscoveryTab = ({
  discoveredSubs,
  discoveredSubsSlice,
  addingSubs,
  discoveredPage,
  setDiscoveredPage,
  discoveredPageSize,
  discoveredTotalPages,
  discoveredCollapsed,
  setDiscoveredCollapsed,
  handleAddSubreddit,
  handleAddAllDiscovered,
}: DiscoveryTabProps) => {
  if (discoveredSubs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Run profiling (Step 2) to discover new subreddits from user activity.
        </p>
      </div>
    );
  }

  return (
    <Card className="border-zinc-800">
      <CardHeader
        className="cursor-pointer select-none pb-3"
        onClick={() => setDiscoveredCollapsed((prev: boolean) => !prev)}
        role="button"
        tabIndex={0}
        aria-expanded={!discoveredCollapsed}
        aria-label="Toggle discovered subreddits"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDiscoveredCollapsed((prev: boolean) => !prev);
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                discoveredCollapsed ? '-rotate-90' : 'rotate-0'
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
            <CardTitle className="text-base font-semibold">
              Discovered Subreddits
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({discoveredSubs.length} new from user profiles)
              </span>
            </CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleAddAllDiscovered();
            }}
            disabled={addingSubs.size > 0}
          >
            Add All to Scan List
          </Button>
        </div>
        {!discoveredCollapsed && (
          <p className="mt-1 text-xs text-muted-foreground">
            Subreddits where 2+ profiled users have posted, not yet in your scan config. Add them
            and re-run Step 1 to collect posts.
          </p>
        )}
      </CardHeader>
      {!discoveredCollapsed && (
        <CardContent className="space-y-2">
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-medium text-muted-foreground">
                    Subreddit
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    Users
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    Posts
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-medium text-muted-foreground">
                    NSFW
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody>
                {discoveredSubsSlice.map((row) => (
                  <tr key={row.subreddit} className="border-b border-zinc-800/50">
                    <td className="whitespace-nowrap px-3 py-1.5 text-sm">
                      <a
                        href={`https://www.reddit.com/r/${row.subreddit}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                        tabIndex={0}
                        aria-label={`View r/${row.subreddit}`}
                      >
                        r/{row.subreddit}
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-xs">
                      {row.userCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-xs">
                      {row.postCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      {row.isNsfw && (
                        <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400">
                          NSFW
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer text-xs"
                        onClick={() => handleAddSubreddit(row.subreddit)}
                        disabled={addingSubs.has(row.subreddit)}
                      >
                        {addingSubs.has(row.subreddit) ? 'Adding...' : 'Add'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {discoveredSubs.length > discoveredPageSize && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {discoveredPage} of {discoveredTotalPages} ({discoveredSubs.length} subreddits)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer text-xs"
                  onClick={() => setDiscoveredPage((p: number) => Math.max(1, p - 1))}
                  disabled={discoveredPage <= 1}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer text-xs"
                  onClick={() => setDiscoveredPage((p: number) => Math.min(discoveredTotalPages, p + 1))}
                  disabled={discoveredPage >= discoveredTotalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
