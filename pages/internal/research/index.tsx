import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { isInternalResearchClientEnabled } from '@/lib/internal/research/guard';
import { useResearchJob } from '@/components/internal/research/use-research-job';
import { WorkspaceStatsBar } from '@/components/internal/research/WorkspaceStatsBar';
import { JobStatusBar } from '@/components/internal/research/JobStatusBar';
import { SubredditsTab } from '@/components/internal/research/SubredditsTab';
import { PipelineTab } from '@/components/internal/research/PipelineTab';
import { DiscoveryTab } from '@/components/internal/research/DiscoveryTab';
import { ResultsTab } from '@/components/internal/research/ResultsTab';

export default function InternalResearchPage() {
  const enabled = isInternalResearchClientEnabled();
  const r = useResearchJob();
  const [activeTab, setActiveTab] = useState('subreddits');

  if (!enabled) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Internal research is not enabled.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Research Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add subreddits, collect posts, profile users, and score candidates. All data accumulates
          across scans — add more subreddits at any time and re-score repeatedly.
        </p>
      </div>

      {/* Workspace stats bar */}
      <WorkspaceStatsBar stats={r.wsStats} />

      {/* Job status bar -- only when a job is actively running */}
      {r.isActive && r.job && (
        <JobStatusBar
          jobId={r.wsStats?.activeJobId ?? ''}
          job={r.job}
          phase={r.phase}
          isActive={r.isActive}
          elapsedText={r.elapsedText}
          runningStep={r.runningStep}
          handleCancel={r.handleCancel}
          handleForceRestart={r.handleForceRestart}
          handleRunStep={r.handleRunStep}
        />
      )}

      {/* Error display */}
      {r.error && !r.isActive && (
        <div className="rounded-md border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
          {r.error}
        </div>
      )}

      {/* Tabs -- ALWAYS visible */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="subreddits" className="cursor-pointer">
            Subreddits
            {r.wsSubreddits.length > 0 && (
              <span className="ml-1.5 rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                {r.wsSubreddits.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="cursor-pointer">
            Pipeline
            {r.isActive && (
              <span className="ml-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="discovery" className="cursor-pointer">
            Discovery
            {r.discoveredSubs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                {r.discoveredSubs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="results" className="cursor-pointer">
            Results
            {r.totalResults > 0 && (
              <span className="ml-1.5 rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                {r.totalResults}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subreddits">
          <SubredditsTab
            wsSubreddits={r.wsSubreddits}
            subredditsInput={r.subredditsInput}
            setSubredditsInput={r.setSubredditsInput}
            addingSubreddits={r.addingSubreddits}
            handleAddSubreddits={r.handleAddSubreddits}
            handleRemoveSubreddit={r.handleRemoveSubreddit}
            error={r.error}
          />
        </TabsContent>

        <TabsContent value="pipeline">
          <PipelineTab
            job={r.job}
            wsStats={r.wsStats}
            runningStep={r.runningStep}
            handleRunStep={r.handleRunStep}
            handleCancel={r.handleCancel}
          />
        </TabsContent>

        <TabsContent value="discovery">
          <DiscoveryTab
            discoveredSubs={r.discoveredSubs}
            discoveredSubsSlice={r.discoveredSubsSlice}
            addingSubs={r.addingSubs}
            discoveredPage={r.discoveredPage}
            setDiscoveredPage={r.setDiscoveredPage}
            discoveredPageSize={r.discoveredPageSize}
            discoveredTotalPages={r.discoveredTotalPages}
            discoveredCollapsed={r.discoveredCollapsed}
            setDiscoveredCollapsed={r.setDiscoveredCollapsed}
            handleAddSubreddit={r.handleAddDiscoveredSub}
            handleAddAllDiscovered={r.handleAddAllDiscovered}
          />
        </TabsContent>

        <TabsContent value="results">
          <ResultsTab
            activeJobId={r.wsStats?.activeJobId ?? null}
            results={r.results}
            totalResults={r.totalResults}
            page={r.page}
            setPage={r.setPage}
            totalPages={r.totalPages}
            minScore={r.minScore}
            setMinScore={r.setMinScore}
            minSubreddits={r.minSubreddits}
            setMinSubreddits={r.setMinSubreddits}
            duplicateOnly={r.duplicateOnly}
            setDuplicateOnly={r.setDuplicateOnly}
            nsfwOnly={r.nsfwOnly}
            setNsfwOnly={r.setNsfwOnly}
            handleCopyTopChannels={r.handleCopyTopChannels}
            handleSaveNote={r.handleSaveNote}
            handleRunStep={r.handleRunStep}
            runningStep={r.runningStep}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}

export async function getServerSideProps() {
  if (process.env.ENABLE_INTERNAL_RESEARCH !== 'true') {
    return { notFound: true };
  }
  return { props: {} };
}
