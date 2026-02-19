import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ResearchCandidate, ResearchStep } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResultsTabProps {
  activeJobId: string | null;
  results: ResearchCandidate[];
  totalResults: number;
  page: number;
  setPage: (v: number | ((p: number) => number)) => void;
  totalPages: number;
  minScore: string;
  setMinScore: (v: string) => void;
  minSubreddits: string;
  setMinSubreddits: (v: string) => void;
  duplicateOnly: boolean;
  setDuplicateOnly: (v: boolean) => void;
  nsfwOnly: boolean;
  setNsfwOnly: (v: boolean) => void;
  handleCopyTopChannels: () => Promise<void>;
  handleSaveNote: (username: string, noteText: string) => Promise<void>;
  handleRunStep: (step: ResearchStep) => Promise<void>;
  runningStep: ResearchStep | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const leadQuality = (score: number): { label: string; className: string } => {
  if (score >= 0.5) return { label: 'Hot', className: 'bg-emerald-500/20 text-emerald-400' };
  if (score >= 0.3) return { label: 'Warm', className: 'bg-yellow-500/20 text-yellow-400' };
  if (score >= 0.15) return { label: 'Cool', className: 'bg-blue-500/20 text-blue-400' };
  return { label: 'Low', className: 'bg-zinc-700 text-zinc-400' };
};

const TH = ({ children, title }: { children: React.ReactNode; title: string }) => (
  <th
    className="cursor-help whitespace-nowrap px-3 py-2.5 text-xs font-medium text-muted-foreground"
    title={title}
  >
    {children}
  </th>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ResultsTab = ({
  activeJobId,
  results,
  totalResults,
  page,
  setPage,
  totalPages,
  minScore,
  setMinScore,
  minSubreddits,
  setMinSubreddits,
  duplicateOnly,
  setDuplicateOnly,
  nsfwOnly,
  setNsfwOnly,
  handleCopyTopChannels,
  handleSaveNote,
  handleRunStep,
  runningStep,
}: ResultsTabProps) => (
  <div className="space-y-4">
    {/* Metric legend */}
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <p className="mb-2 text-xs font-semibold text-zinc-300">How to read these results</p>
      <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
        Each row is a Reddit user who posted in your target subreddits. The scores help you identify
        <strong className="text-zinc-300"> high-value leads </strong>
        — users who are actively promoting content and could benefit from your product.
      </p>
      <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="font-medium text-zinc-300">Lead Score</span> — Overall likelihood this user is a
          promoter/lead (0 = unlikely, 1 = very likely). Combines all signals below.
        </div>
        <div>
          <span className="font-medium text-zinc-300">Post Frequency</span> — How often they post. High
          frequency = active promoter who posts regularly.
        </div>
        <div>
          <span className="font-medium text-zinc-300">Reposts / Duplicate Posts</span> — Total posts with
          repeated titles across subreddits, grouped into clusters. Shows how many posts were
          copy-pasted and the average copies per title.
        </div>
        <div>
          <span className="font-medium text-zinc-300">Cross-posting Reach</span> — Number of different
          subreddits they post in. Higher = wider promotional reach.
        </div>
        <div>
          <span className="font-medium text-zinc-300">Profile Visibility</span> — Whether their profile image
          and post history are public. Public profiles are easier to verify and contact.
        </div>
        <div>
          <span className="font-medium text-zinc-300">Suggested Channel</span> — The subreddit where this user
          is most active. Best place to reach or study them.
        </div>
      </div>
    </div>

    {/* Toolbar */}
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Min Lead Score</Label>
          <Input
            value={minScore}
            onChange={(event) => { setMinScore(event.target.value); setPage(1); }}
            className="h-8 w-24 text-sm"
            aria-label="Minimum lead score filter"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Min Subreddits</Label>
          <Input
            value={minSubreddits}
            onChange={(event) => { setMinSubreddits(event.target.value); setPage(1); }}
            className="h-8 w-24 text-sm"
            aria-label="Minimum subreddits filter"
          />
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <Checkbox
            id="dupOnly"
            checked={duplicateOnly}
            onCheckedChange={(value) => { setDuplicateOnly(Boolean(value)); setPage(1); }}
            aria-label="Show only users who repost duplicate content"
          />
          <Label htmlFor="dupOnly" className="cursor-pointer text-sm">Duplicate posters only</Label>
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <Checkbox
            id="nsfwOnlyFilter"
            checked={nsfwOnly}
            onCheckedChange={(value) => { setNsfwOnly(Boolean(value)); setPage(1); }}
            aria-label="Show only NSFW content posters"
          />
          <Label htmlFor="nsfwOnlyFilter" className="cursor-pointer text-sm">NSFW only</Label>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer text-xs"
          onClick={handleCopyTopChannels}
          disabled={results.length === 0}
        >
          Copy Channels
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer text-xs"
          onClick={() => handleRunStep('score_rank')}
          disabled={runningStep !== null}
        >
          {runningStep === 'score_rank' ? 'Scoring...' : 'Re-Score'}
        </Button>
        <Button variant="outline" size="sm" className="cursor-pointer text-xs" asChild disabled={!activeJobId}>
          <a
            href={activeJobId ? `/api/internal/research/jobs/${activeJobId}/export.csv` : '#'}
            tabIndex={0}
            aria-label="Export results as CSV"
          >
            Export CSV
          </a>
        </Button>
      </div>
    </div>

    {/* Table or empty state */}
    {results.length === 0 ? (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          {totalResults === 0 && results.length === 0
            ? 'Run the pipeline steps and Score & Rank to see candidates here.'
            : 'No matching candidates found with current filters.'}
        </p>
      </div>
    ) : (
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <TH title="Reddit username — click to view their profile">User</TH>
              <TH title="Lead Score (0-1): Combined signal of how likely this user is a promoter or lead. Higher = stronger lead.">
                Lead Score
              </TH>
              <TH title="Post Frequency (0-1): How actively this user posts. High value = they post very often, likely a promoter.">
                Frequency
              </TH>
              <TH title="Total Duplicate Posts: Total number of posts that share the same title as another post by this user, posted across 2+ subreddits. Higher = more content being copy-pasted.">
                Dup Posts
              </TH>
              <TH title="Avg per Title: On average, how many times each repeated title was posted. e.g. 3.5 means each duplicated title was posted ~3-4 times across subreddits.">
                Avg / Title
              </TH>
              <TH title="Cross-posting Reach: Number of distinct subreddits this user posts in. More subreddits = wider promotional reach.">
                Reach
              </TH>
              <TH title="Profile Visibility: Whether the user has a profile image and public post history. Public profiles are easier to verify.">
                Visibility
              </TH>
              <TH title="Sample Post: Click 'view' to see an example of their content.">Sample</TH>
              <TH title="Suggested Channel: The subreddit where this user is most active — best place to study or reach them.">
                Top Channel
              </TH>
              <TH title="Your notes about this lead — saved automatically on blur.">Outreach Note</TH>
            </tr>
          </thead>
          <tbody>
            {results.map((item) => {
              const quality = leadQuality(item.overallScore);
              return (
                <tr
                  key={item.username}
                  className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-900/30"
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    <a
                      href={`https://www.reddit.com/user/${item.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
                      tabIndex={0}
                      aria-label={`View profile of ${item.username}`}
                    >
                      u/{item.username}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          item.overallScore >= 0.5
                            ? 'font-mono text-xs text-emerald-400'
                            : item.overallScore >= 0.2
                              ? 'font-mono text-xs text-yellow-400'
                              : 'font-mono text-xs text-zinc-400'
                        }
                      >
                        {item.overallScore.toFixed(3)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${quality.className}`}
                      >
                        {quality.label}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${Math.round(Math.min(1, item.frequencyScore) * 48)}px` }}
                        title={`Frequency: ${item.frequencyScore.toFixed(3)}`}
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.frequencyScore.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-2 text-center"
                    title={`${item.totalDuplicatePosts} total posts with repeated titles across ${item.clusterCount} unique title group(s)${item.maxClusterSize > 1 ? `. Largest group: ${item.maxClusterSize} posts with the same title` : ''}`}
                  >
                    {item.totalDuplicatePosts > 0 ? (
                      <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-xs font-medium text-red-400">
                        {item.totalDuplicatePosts}
                        <span className="ml-1 text-[10px] text-red-500/70">
                          ({item.clusterCount} title{item.clusterCount !== 1 ? 's' : ''})
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">0</span>
                    )}
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-2 text-center"
                    title={`On average, each repeated title was posted ${item.avgClusterSize} times across different subreddits`}
                  >
                    {item.avgClusterSize > 0 ? (
                      <span className={`font-mono text-xs ${item.avgClusterSize >= 3 ? 'font-medium text-red-400' : 'text-muted-foreground'}`}>
                        {item.avgClusterSize.toFixed(1)}×
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-2 text-center"
                    title={`Posts across ${item.subredditsCount} different subreddits — wider reach means more promotional activity`}
                  >
                    <span className={`font-mono text-xs ${item.subredditsCount >= 3 ? 'font-medium text-amber-400' : 'text-muted-foreground'}`}>
                      {item.subredditsCount} subs
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${item.hasProfileImage ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                        title={item.hasProfileImage ? 'Has a profile image — more likely a real person' : 'No profile image — could be a throwaway account'}
                      />
                      <span
                        className={item.profilePostsPublic ? 'text-zinc-300' : 'text-zinc-500'}
                        title={item.profilePostsPublic ? 'Post history is public — you can review their full activity' : 'Post history is hidden — harder to verify'}
                      >
                        {item.profilePostsPublic ? 'Public' : 'Hidden'}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {item.evidence.sampleLinks[0] ? (
                      <a
                        className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                        href={item.evidence.sampleLinks[0]}
                        target="_blank"
                        rel="noreferrer"
                        tabIndex={0}
                        aria-label={`Sample post by ${item.username}`}
                      >
                        view post
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">--</span>
                    )}
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-2"
                    title={item.suggestedChannel ? `Most active in r/${item.suggestedChannel}` : 'No dominant channel detected'}
                  >
                    {item.suggestedChannel ? (
                      <a
                        href={`https://www.reddit.com/r/${item.suggestedChannel}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                        tabIndex={0}
                        aria-label={`View r/${item.suggestedChannel}`}
                      >
                        r/{item.suggestedChannel}
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">--</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      defaultValue={item.noteText}
                      onBlur={(event) => handleSaveNote(item.username, event.target.value)}
                      className="h-7 min-w-[140px] text-xs"
                      placeholder="Add note..."
                      aria-label={`Outreach note for ${item.username}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}

    {/* Pagination */}
    {totalResults > 0 && (
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
          <span className="ml-2 text-zinc-500">
            ({totalResults} lead{totalResults !== 1 ? 's' : ''})
          </span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs"
            onClick={() => setPage((v: number) => Math.max(1, v - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer text-xs"
            onClick={() => setPage((v: number) => Math.min(totalPages, v + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    )}
  </div>
);
