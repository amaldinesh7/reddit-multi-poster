import React from 'react';
import type { GetServerSideProps } from 'next';
import { Settings } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { checkAuthCookies, redirectToLogin } from '@/lib/serverAuth';
import * as Sentry from '@sentry/nextjs';
import MediaUpload from '../components/MediaUpload';
import SubredditFlairPicker from '../components/SubredditFlairPicker';
import PostComposer from '../components/PostComposer';
import PostingQueue from '../components/PostingQueue';
import UpgradeModal from '../components/UpgradeModal';
import EditFailedPostDialog from '../components/posting-queue/EditFailedPostDialog';
import { CustomizePostDialog, PerSubredditOverride } from '../components/subreddit-picker';
import { AppLoader } from '@/components/ui/loader';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/layout';
import { useHomePageState } from '@/hooks/useHomePageState';
import { useFailedPosts, FailedPost } from '@/hooks/useFailedPosts';
import { useSubredditFlairData } from '@/hooks/useSubredditFlairData';
import { useQueueJob } from '@/hooks/useQueueJob';
import { captureClientError, addActionBreadcrumb } from '@/lib/clientErrorHandler';
import type { ValidationIssue } from '@/lib/preflightValidation';

interface PlanLimits {
  maxSubreddits: number;
  maxPostItems: number;
  temporarySelectionEnabled: boolean;
}

interface MeResponse {
  authenticated: boolean;
  me?: { name: string; icon_img?: string; id?: string };
  subs?: string[];
  userId?: string;
  entitlement?: 'free' | 'paid';
  limits?: PlanLimits;
}

import { PwaOnboarding } from '@/components/PwaOnboarding';


export default function Home() {
  const router = useRouter();
  const [auth, setAuth] = React.useState<MeResponse>({ authenticated: false });
  const [loading, setLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [upgradeLoading, setUpgradeLoading] = React.useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const [upgradeModalContext, setUpgradeModalContext] = React.useState<{ title?: string; message: string } | undefined>(undefined);

  // Track if we're redirecting to prevent showing content during navigation
  const isRedirectingRef = React.useRef(false);

  const {
    selectedSubs,
    setSelectedSubs,
    caption,
    setCaption,
    body,
    setBody,
    prefixes,
    setPrefixes,
    mediaUrl,
    setMediaUrl,
    mediaFiles,
    setMediaFiles,
    mediaMode,
    setMediaMode,
    flairs,
    setFlairs,
    titleSuffixes,
    setTitleSuffixes,
    contentOverrides,
    setContentOverrides,
    postToProfile,
    setPostToProfile,
    hasFlairErrors,
    showValidationErrors,
    items,
    handleValidationChange,
    handlePostAttempt,
    handleUnselectSuccessItems,
    clearSelection,
    clearAllState,
  } = useHomePageState({ authMe: auth.me });

  // Failed posts tracking for inline error display
  const failedPostsHook = useFailedPosts();

  // Flair data for edit dialog
  const { flairOptions, flairRequired, postRequirements, cacheLoading: flairLoading } = useSubredditFlairData();

  // Queue job hook for retrying failed posts
  const queueJobHook = useQueueJob();

  // State for edit dialog
  const [editingPost, setEditingPost] = React.useState<FailedPost | null>(null);
  const [isRetryingEdit, setIsRetryingEdit] = React.useState(false);

  // Validation issues by subreddit for inline display
  const [validationIssuesBySubreddit, setValidationIssuesBySubreddit] = React.useState<Record<string, ValidationIssue[]>>({});

  // Per-subreddit customization dialog state (PRO feature)
  const [customizingSubreddit, setCustomizingSubreddit] = React.useState<string | null>(null);

  // Handle customize button click
  const handleCustomize = React.useCallback((subredditName: string) => {
    setCustomizingSubreddit(subredditName);
  }, []);

  // Handle save override from customize dialog
  const handleSaveOverride = React.useCallback((subreddit: string, override: PerSubredditOverride | undefined) => {
    setContentOverrides(prev => {
      if (!override || (!override.title && !override.body)) {
        // Remove the override if it's undefined or empty
        const { [subreddit]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [subreddit]: override,
      };
    });
    setCustomizingSubreddit(null);
  }, [setContentOverrides]);

  // Handle validation changes from PostingQueue
  const handleQueueValidationChange = React.useCallback((issuesBySubreddit: Record<string, ValidationIssue[]>) => {
    setValidationIssuesBySubreddit(issuesBySubreddit);
  }, []);

  // Handle posting results and track failed posts
  const handleResultsAvailable = React.useCallback((
    results: Array<{ index: number; status: 'success' | 'error' | 'skipped'; subreddit: string; error?: string; url?: string }>,
    postedItems: typeof items
  ) => {
    // Convert to the format expected by addFromResults
    // Note: addFromResults expects QueueJobResult[] with 'skipped' as possible status
    const queueJobResults = results.map(r => ({
      index: r.index,
      subreddit: r.subreddit,
      status: r.status as 'success' | 'error' | 'skipped',
      url: r.url,
      error: r.error,
      postedAt: new Date().toISOString(),
    }));

    // Convert items to QueueJobItem format
    const queueJobItems = postedItems.map(item => ({
      subreddit: item.subreddit,
      flairId: item.flairId,
      titleSuffix: item.titleSuffix,
      kind: item.kind,
      url: item.url,
      text: item.text,
      file: item.file,
      files: item.files,
    }));

    // Add failed results to the tracker
    failedPostsHook.addFromResults(queueJobResults, queueJobItems, caption, prefixes);
  }, [caption, prefixes, failedPostsHook]);

  // Action handlers for inline error display
  const handleRetryPost = React.useCallback(async (id: string) => {
    const postToRetry = failedPostsHook.retryOne(id);
    if (!postToRetry) return;

    addActionBreadcrumb('Retry failed post', { subreddit: postToRetry.subreddit, id });

    try {
      const jobId = await queueJobHook.retryItem(
        {
          subreddit: postToRetry.subreddit,
          flairId: postToRetry.flairId,
          titleSuffix: postToRetry.titleSuffix,
          kind: postToRetry.kind,
          url: postToRetry.url,
          text: postToRetry.text,
          file: postToRetry.originalItem.file,
          files: postToRetry.originalItem.files,
        },
        postToRetry.originalCaption,
        postToRetry.originalPrefixes
      );

      if (jobId) {
        // Job submitted successfully, mark as success (will be removed from failed list)
        failedPostsHook.markSuccess(id);
      } else {
        // Submission failed
        failedPostsHook.markFailed(id, 'Failed to submit retry');
      }
    } catch (error) {
      captureClientError(error, 'index.handleRetryPost', {
        toastTitle: 'Retry Failed',
        context: { subreddit: postToRetry.subreddit },
      });
      failedPostsHook.markFailed(id, error instanceof Error ? error.message : 'Retry failed');
    }
  }, [failedPostsHook, queueJobHook]);

  const handleEditPost = React.useCallback((post: FailedPost) => {
    addActionBreadcrumb('Open edit failed post dialog', { subreddit: post.subreddit });
    setEditingPost(post);
  }, []);

  const handleEditDialogSubmit = React.useCallback(async (
    post: FailedPost, 
    updates: { flairId?: string; titleSuffix?: string }
  ) => {
    setIsRetryingEdit(true);
    addActionBreadcrumb('Submit edit and retry', { subreddit: post.subreddit, updates });

    try {
      // Update the post with new values
      failedPostsHook.updatePost(post.id, updates);

      // Submit retry with updated values
      const jobId = await queueJobHook.retryItem(
        {
          subreddit: post.subreddit,
          flairId: updates.flairId || post.flairId,
          titleSuffix: updates.titleSuffix || post.titleSuffix,
          kind: post.kind,
          url: post.url,
          text: post.text,
          file: post.originalItem.file,
          files: post.originalItem.files,
        },
        post.originalCaption,
        post.originalPrefixes
      );

      if (jobId) {
        // Job submitted successfully
        failedPostsHook.markSuccess(post.id);
        setEditingPost(null);
      } else {
        // Submission failed
        failedPostsHook.markFailed(post.id, 'Failed to submit retry');
      }
    } catch (error) {
      captureClientError(error, 'index.handleEditDialogSubmit', {
        toastTitle: 'Retry Failed',
        context: { subreddit: post.subreddit },
      });
      failedPostsHook.markFailed(post.id, error instanceof Error ? error.message : 'Retry failed');
    } finally {
      setIsRetryingEdit(false);
    }
  }, [failedPostsHook, queueJobHook]);

  const handleEditDialogCancel = React.useCallback(() => {
    setEditingPost(null);
  }, []);

  const handleRemovePost = React.useCallback((id: string) => {
    failedPostsHook.remove(id);
  }, [failedPostsHook]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get<MeResponse>('/api/me');
        setAuth(data);

        // Redirect to login if not authenticated (token invalid/expired)
        if (!data.authenticated) {
          isRedirectingRef.current = true;
          router.replace('/login');
          return;
        }

        // Set Sentry user context for better error tracking
        if (data.me) {
          Sentry.setUser({
            id: data.me.id || data.userId,
            username: data.me.name,
          });
        }

        // Check admin status (non-blocking)
        try {
          const adminRes = await axios.get<{ isAdmin: boolean }>('/api/admin-check');
          setIsAdmin(adminRes.data.isAdmin);
        } catch {
          // Ignore admin check failures
        }
      } catch {
        isRedirectingRef.current = true;
        setAuth({ authenticated: false });
        router.replace('/login');
      } finally {
        // Only hide loader if we're not redirecting (prevents flash)
        if (!isRedirectingRef.current) {
          setLoading(false);
        }
      }
    };
    load();
  }, [router]);

  const handleLogout = async () => {
    await axios.post('/api/auth/logout');
    Sentry.setUser(null);
    router.replace('/login');
  };

  const handleUpgrade = React.useCallback(() => {
    // Navigate to inline checkout page
    router.push('/checkout');
  }, [router]);

  // Wrapper for post attempt that checks free user limit
  const handlePostWithLimitCheck = React.useCallback(() => {
    const maxPostItems = auth.limits?.maxPostItems ?? 5;
    // Check if free user is trying to post to more subreddits than their limit
    if (auth.entitlement === 'free' && selectedSubs.length > maxPostItems) {
      setUpgradeModalContext({
        title: `You picked ${selectedSubs.length} communities`,
        message: `Free: up to ${maxPostItems} per post. Go Pro for unlimited.`,
      });
      setShowUpgradeModal(true);
      return;
    }
    // Otherwise proceed with normal post attempt
    handlePostAttempt();
  }, [auth.entitlement, auth.limits?.maxPostItems, selectedSubs.length, handlePostAttempt]);

  return (
    <>
      <Head>
        <title>Reddit Multi Poster - Share Once, Reach Everywhere | Post to 30+ Subreddits</title>
        <meta name="description" content="Tired of copy-pasting posts to multiple subreddits? Reddit Multi Poster lets you share content to 30+ communities with one click. Smart scheduling, auto-flairs, real-time tracking. Free to use." />
        <meta name="keywords" content="reddit, multi poster, cross-post, subreddit, bulk posting, reddit automation, content sharing, social media tool, reddit scheduler" />
        <meta name="author" content="Reddit Multi Poster" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://reddit-multi-poster.vercel.app/" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://reddit-multi-poster.vercel.app/" />
        <meta property="og:title" content="Reddit Multi Poster - Share Once, Reach Everywhere" />
        <meta property="og:description" content="Stop wasting time copy-pasting. Post to 30+ subreddits with one click. Smart scheduling prevents spam flags. Auto-flair detection. Real-time progress tracking." />
        <meta property="og:image" content="https://reddit-multi-poster.vercel.app/og-image.svg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Reddit Multi Poster" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://reddit-multi-poster.vercel.app/" />
        <meta name="twitter:title" content="Reddit Multi Poster - Share Once, Reach Everywhere" />
        <meta name="twitter:description" content="Post to 30+ subreddits with one click. Smart scheduling, auto-flairs, real-time tracking. The tool every Reddit content creator needs." />
        <meta name="twitter:image" content="https://reddit-multi-poster.vercel.app/og-image.svg" />
        <meta name="twitter:creator" content="@redditposter" />
      </Head>

      {loading ? (
        <AppLoader />
      ) : (
        <div className="min-h-screen bg-background">
          {/* Header */}
          <AppHeader
            userName={auth.me?.name}
            userAvatar={auth.me?.icon_img}
            onLogout={handleLogout}
            isAdmin={isAdmin}
            entitlement={auth.entitlement}
            onUpgrade={() => {
              setUpgradeModalContext(undefined);
              setShowUpgradeModal(true);
            }}
            upgradeLoading={upgradeLoading}
          />

          <PwaOnboarding />

          {/* Main Content */}
          <main className="container mx-auto px-4 sm:px-6 py-4 lg:py-6 max-w-2xl lg:max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-x-6 items-start">

              {/* Left Column: Create Post */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold hidden lg:block lg:mb-2">Your post</h2>

                {/* Media Section */}
                <section>
                  {/* Desktop: Card wrapper */}
                  <div className="hidden lg:block rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Image or video</h3>
                      <div className="inline-flex items-center rounded-lg border border-border bg-card p-1 text-muted-foreground">
                        <button
                          onClick={() => setMediaMode('file')}
                          className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${mediaMode === 'file'
                            ? 'bg-secondary text-foreground shadow-sm'
                            : 'hover:bg-muted/50'
                            }`}
                          aria-pressed={mediaMode === 'file'}
                        >
                          Upload
                        </button>
                        <button
                          onClick={() => setMediaMode('url')}
                          className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${mediaMode === 'url'
                            ? 'bg-secondary text-foreground shadow-sm'
                            : 'hover:bg-muted/50'
                            }`}
                          aria-pressed={mediaMode === 'url'}
                        >
                          URL
                        </button>
                      </div>
                    </div>
                    <MediaUpload onUrl={setMediaUrl} onFile={setMediaFiles} mode={mediaMode} />
                  </div>

                  {/* Mobile: No card wrapper */}
                  <div className="lg:hidden">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold">Image or video</h3>
                      <div className="inline-flex items-center rounded-lg border border-border bg-card p-1 text-muted-foreground">
                        <button
                          onClick={() => setMediaMode('file')}
                          className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${mediaMode === 'file'
                            ? 'bg-secondary text-foreground shadow-sm'
                            : 'hover:bg-muted/50'
                            }`}
                          aria-pressed={mediaMode === 'file'}
                        >
                          Upload
                        </button>
                        <button
                          onClick={() => setMediaMode('url')}
                          className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${mediaMode === 'url'
                            ? 'bg-secondary text-foreground shadow-sm'
                            : 'hover:bg-muted/50'
                            }`}
                          aria-pressed={mediaMode === 'url'}
                        >
                          URL
                        </button>
                      </div>
                    </div>
                    <MediaUpload onUrl={setMediaUrl} onFile={setMediaFiles} mode={mediaMode} />
                  </div>
                </section>

                {/* Title Section */}
                <section>
                  {/* Desktop: Card wrapper */}
                  <div className="hidden lg:block rounded-lg border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Title</h3>
                    <PostComposer
                      value={caption}
                      onChange={setCaption}
                      body={body}
                      onBodyChange={setBody}
                      prefixes={prefixes}
                      onPrefixesChange={setPrefixes}
                    />
                  </div>

                  {/* Mobile: No card wrapper */}
                  <div className="lg:hidden">
                    <h3 className="text-base font-semibold mb-3">Title</h3>
                    <PostComposer
                      value={caption}
                      onChange={setCaption}
                      body={body}
                      onBodyChange={setBody}
                      prefixes={prefixes}
                      onPrefixesChange={setPrefixes}
                    />
                  </div>
                </section>
              </div>

              {/* Right Column: Communities & Queue */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold hidden lg:block lg:mb-2">Where to post</h2>

                {/* Communities Section */}
                <section>
                  {/* Desktop: Card wrapper */}
                  <div className="hidden lg:block rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Communities</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/settings')}
                        className="h-8 px-2 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                        aria-label="Manage communities and flairs"
                      >
                        <Settings className="w-3.5 h-3.5 mr-1.5" />
                        Manage list
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <SubredditFlairPicker
                        selected={selectedSubs}
                        onSelectedChange={setSelectedSubs}
                        flairValue={flairs}
                        onFlairChange={setFlairs}
                        titleSuffixValue={titleSuffixes}
                        onTitleSuffixChange={setTitleSuffixes}
                        onValidationChange={handleValidationChange}
                        showValidationErrors={showValidationErrors}
                        temporarySelectionEnabled={auth.limits?.temporarySelectionEnabled ?? true}
                        failedPosts={failedPostsHook.state.posts}
                        onRetryPost={handleRetryPost}
                        onEditPost={handleEditPost}
                        onRemovePost={handleRemovePost}
                        validationIssuesBySubreddit={validationIssuesBySubreddit}
                        contentOverrides={contentOverrides}
                        onCustomize={handleCustomize}
                        customizationEnabled={auth.entitlement === 'paid'}
                      />

                      {/* Post to Profile */}
                      {auth.authenticated && auth.me?.name && (
                        <div className="flex items-center gap-2 pt-3 border-t border-border">
                          <Checkbox
                            id="post-to-profile-desktop"
                            checked={postToProfile}
                            onCheckedChange={(checked) => setPostToProfile(checked === true)}
                          />
                          <label
                            htmlFor="post-to-profile-desktop"
                            className="text-sm cursor-pointer select-none font-medium text-foreground"
                          >
                            Post to profile <span className="text-muted-foreground/50 text-xs font-normal ml-1">(u/{auth.me.name})</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile: No card wrapper */}
                  <div className="lg:hidden">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold">Communities</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/settings')}
                        className="h-8 px-2 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                        aria-label="Manage communities and flairs"
                      >
                        <Settings className="w-3.5 h-3.5 mr-1.5" />
                        Manage list
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <SubredditFlairPicker
                        selected={selectedSubs}
                        onSelectedChange={setSelectedSubs}
                        flairValue={flairs}
                        onFlairChange={setFlairs}
                        titleSuffixValue={titleSuffixes}
                        onTitleSuffixChange={setTitleSuffixes}
                        onValidationChange={handleValidationChange}
                        showValidationErrors={showValidationErrors}
                        temporarySelectionEnabled={auth.limits?.temporarySelectionEnabled ?? true}
                        failedPosts={failedPostsHook.state.posts}
                        onRetryPost={handleRetryPost}
                        onEditPost={handleEditPost}
                        onRemovePost={handleRemovePost}
                        validationIssuesBySubreddit={validationIssuesBySubreddit}
                        contentOverrides={contentOverrides}
                        onCustomize={handleCustomize}
                        customizationEnabled={auth.entitlement === 'paid'}
                      />

                      {/* Post to Profile */}
                      {auth.authenticated && auth.me?.name && (
                        <div className="flex items-center gap-2 pt-3 border-t border-border">
                          <Checkbox
                            id="post-to-profile-mobile"
                            checked={postToProfile}
                            onCheckedChange={(checked) => setPostToProfile(checked === true)}
                          />
                          <label
                            htmlFor="post-to-profile-mobile"
                            className="text-sm cursor-pointer select-none font-medium text-foreground"
                          >
                            Post to profile <span className="text-muted-foreground/50 text-xs font-normal ml-1">(u/{auth.me.name})</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Queue Section */}
                <section>
                  {/* Desktop: Card wrapper */}
                  <div className="hidden lg:block rounded-lg border border-border bg-card p-6">

                    <PostingQueue
                      items={items}
                      caption={caption}
                      body={body}
                      prefixes={prefixes}
                      hasFlairErrors={hasFlairErrors}
                      onPostAttempt={handlePostWithLimitCheck}
                      onUnselectSuccessItems={handleUnselectSuccessItems}
                      onClearAll={clearAllState}
                      onResultsAvailable={handleResultsAvailable}
                      onValidationChange={handleQueueValidationChange}
                    />
                  </div>

                  {/* Mobile: No card wrapper */}
                  <div className="lg:hidden">

                    <PostingQueue
                      items={items}
                      caption={caption}
                      body={body}
                      prefixes={prefixes}
                      hasFlairErrors={hasFlairErrors}
                      onPostAttempt={handlePostWithLimitCheck}
                      onUnselectSuccessItems={handleUnselectSuccessItems}
                      onClearAll={clearAllState}
                      onResultsAvailable={handleResultsAvailable}
                      onValidationChange={handleQueueValidationChange}
                    />
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        onUpgrade={handleUpgrade}
        upgradeLoading={upgradeLoading}
        context={upgradeModalContext}
      />

      {/* Edit Failed Post Dialog */}
      {editingPost && (
        <EditFailedPostDialog
          post={editingPost}
          flairOptions={flairOptions[editingPost.subreddit] || []}
          flairLoading={flairLoading[editingPost.subreddit] || false}
          flairRequired={flairRequired[editingPost.subreddit] || false}
          onSubmit={handleEditDialogSubmit}
          onCancel={handleEditDialogCancel}
          isRetrying={isRetryingEdit}
        />
      )}

      {/* Per-subreddit content customization dialog (PRO feature) */}
      {customizingSubreddit && (
        <CustomizePostDialog
          open={!!customizingSubreddit}
          onOpenChange={(open) => !open && setCustomizingSubreddit(null)}
          subredditName={customizingSubreddit}
          globalTitle={caption}
          globalBody={body}
          override={contentOverrides[customizingSubreddit]}
          postRequirements={postRequirements[customizingSubreddit]}
          onSave={handleSaveOverride}
        />
      )}
    </>
  );
}

/**
 * Server-side authentication check.
 * Redirects to /login if no auth cookies exist (prevents flash of content).
 * Token validation still happens client-side via /api/me.
 */
export const getServerSideProps: GetServerSideProps = async (context) => {
  const authCheck = checkAuthCookies(context);
  
  // If no auth cookies exist, redirect to login immediately (no flash)
  if (!authCheck.authenticated) {
    return redirectToLogin();
  }
  
  // User has auth cookies - render the page
  // Client-side will validate the token and handle refresh
  return { props: {} };
};
