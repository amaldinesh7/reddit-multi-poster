import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AnalyticsSummaryPayload } from './types';

interface AnalyticsTabProps {
  summary: AnalyticsSummaryPayload | null;
  loading: boolean;
  syncing: boolean;
  error: string;
  message: string;
  lookbackDays: number;
  setLookbackDays: (value: number) => void;
  minPostAgeHours: number;
  setMinPostAgeHours: (value: number) => void;
  timezone: string;
  setTimezone: (value: string) => void;
  minPostsPerUser: string;
  setMinPostsPerUser: (value: string) => void;
  handleRefreshSummary: () => Promise<void>;
  handleRefreshEngagement: () => Promise<void>;
}

const confidenceClass = (value: 'low' | 'medium' | 'high'): string => {
  if (value === 'high') return 'bg-emerald-500/20 text-emerald-300';
  if (value === 'medium') return 'bg-amber-500/20 text-amber-300';
  return 'bg-zinc-700/60 text-zinc-300';
};

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const hourLabel = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

const heatClass = (volumeShare: number): string => {
  if (volumeShare >= 0.04) return 'bg-emerald-600/70 text-white';
  if (volumeShare >= 0.02) return 'bg-emerald-600/40 text-emerald-100';
  if (volumeShare >= 0.01) return 'bg-emerald-700/30 text-emerald-200';
  if (volumeShare > 0) return 'bg-zinc-800 text-zinc-300';
  return 'bg-zinc-900 text-zinc-600';
};

export const AnalyticsTab = ({
  summary,
  loading,
  syncing,
  error,
  message,
  lookbackDays,
  setLookbackDays,
  minPostAgeHours,
  setMinPostAgeHours,
  timezone,
  setTimezone,
  minPostsPerUser,
  setMinPostsPerUser,
  handleRefreshSummary,
  handleRefreshEngagement,
}: AnalyticsTabProps) => {
  const heatRows = summary
    ? [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
        dow,
        dowLabel: summary.postingVolumeByDow.find((item) => item.dow === dow)?.dowLabel ?? '',
        cells: summary.heatmap
          .filter((cell) => cell.dow === dow)
          .sort((a, b) => a.hour - b.hour),
      }))
    : [];

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Posting Analytics Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Lookback</Label>
              <Select value={String(lookbackDays)} onValueChange={(value) => setLookbackDays(Number(value))}>
                <SelectTrigger className="h-8 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min Post Age</Label>
              <Select value={String(minPostAgeHours)} onValueChange={(value) => setMinPostAgeHours(Number(value))}>
                <SelectTrigger className="h-8 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="h-8 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min Posts/User</Label>
              <Input
                value={minPostsPerUser}
                onChange={(event) => setMinPostsPerUser(event.target.value)}
                className="h-8"
                aria-label="Minimum posts per user"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={() => handleRefreshSummary()}
              disabled={loading}
            >
              {loading ? 'Computing...' : 'Recompute'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => handleRefreshEngagement()}
              disabled={syncing}
            >
              {syncing ? 'Refreshing...' : 'Refresh Engagement'}
            </Button>
            {summary && (
              <span className="text-xs text-muted-foreground">
                Generated: {new Date(summary.generatedAt).toLocaleString()}
              </span>
            )}
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          {message && (
            <p className="text-xs text-zinc-300">{message}</p>
          )}
        </CardContent>
      </Card>

      {!summary ? (
        <Card className="border-zinc-800">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {loading ? 'Loading analytics…' : 'No analytics data yet. Click Recompute.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Card className="border-zinc-800">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Posts</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{summary.coverage.totalPosts}</p>
              </CardContent>
            </Card>
            <Card className="border-zinc-800">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Score Coverage</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatPercent(summary.coverage.scoreCoverage)}</p>
              </CardContent>
            </Card>
            <Card className="border-zinc-800">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Comments Coverage</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatPercent(summary.coverage.commentsCoverage)}</p>
              </CardContent>
            </Card>
            <Card className="border-zinc-800">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Both Metrics</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatPercent(summary.coverage.bothCoverage)}</p>
              </CardContent>
            </Card>
            <Card className="border-zinc-800">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Users in Corr.</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{summary.totalUsersConsidered}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Posting Volume by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.postingVolumeByHour}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.2)" />
                      <XAxis dataKey="hour" tickFormatter={hourLabel} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="posts" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Posting Volume by Weekday</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.postingVolumeByDow}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.2)" />
                      <XAxis dataKey="dowLabel" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="posts" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Frequency vs Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.2)" />
                    <XAxis type="number" dataKey="avgPostsPerActiveDay" name="posts/day" tick={{ fontSize: 11 }} />
                    <YAxis type="number" dataKey="avgScore" name="avg upvotes" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Scatter name="Bins (avg upvotes)" data={summary.frequencyBins} fill="#a855f7" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Hour x Weekday Heatmap (Volume Share)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="border border-zinc-800 bg-zinc-900 px-2 py-1 text-left">Day / Hour</th>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <th key={hour} className="border border-zinc-800 bg-zinc-900 px-1 py-1 text-center">
                        {String(hour).padStart(2, '0')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatRows.map((row) => (
                    <tr key={row.dow}>
                      <td className="border border-zinc-800 bg-zinc-900 px-2 py-1 font-medium">{row.dowLabel}</td>
                      {row.cells.map((cell) => (
                        <td
                          key={`${cell.dow}-${cell.hour}`}
                          title={`${row.dowLabel} ${hourLabel(cell.hour)} | posts: ${cell.posts} | share: ${formatPercent(cell.volumeShare)}`}
                          className={`border border-zinc-800 px-1 py-1 text-center tabular-nums ${heatClass(cell.volumeShare)}`}
                        >
                          {cell.posts}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Best Posting Windows</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.bestWindows.map((window) => (
                  <div key={window.label} className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{window.label}</p>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${confidenceClass(window.confidence)}`}>
                        {window.confidence}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Score: {window.windowScore.toFixed(4)} | Posts: {window.posts} | Share: {formatPercent(window.volumeShare)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Correlations & Caveats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.correlations.map((correlation) => (
                  <div key={correlation.key} className="rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
                    <p className="text-xs font-medium text-zinc-200">{correlation.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      rho: {correlation.rho === null ? 'n/a' : correlation.rho.toFixed(3)} | n={correlation.n} | {correlation.interpretation}
                    </p>
                  </div>
                ))}
                {summary.caveats.length > 0 ? (
                  <div className="rounded border border-amber-700/40 bg-amber-950/30 p-2">
                    <p className="text-xs font-medium text-amber-300">Caveats</p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-amber-200/90">
                      {summary.caveats.map((caveat) => (
                        <li key={caveat}>{caveat}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No major caveats detected.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
