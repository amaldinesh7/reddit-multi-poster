import React from 'react';
import type { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import { Settings } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { checkAuthCookies, redirectToLogin } from '@/lib/serverAuth';
import * as Sentry from '@sentry/nextjs';
import MediaUpload from '../components/MediaUpload';
import PostComposer from '../components/PostComposer';
import { AppLoader, Skeleton, SubredditRowSkeleton, CardSkeleton } from '@/components/ui/loader';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { AppHeader, MobileUserStatsBanner, AppFooter } from '@/components/layout';
import { useHomePageState } from '@/hooks/useHomePageState';
import { useFailedPosts, FailedPost } from '@/hooks/useFailedPosts';
import { useSubredditFlairData } from '@/hooks/useSubredditFlairData';
import { useQueueJob } from '@/hooks/useQueueJob';
import { useAuth } from '@/hooks/useAuth';
import { captureClientError, addActionBreadcrumb } from '@/lib/clientErrorHandler';
import type { ValidationIssue } from '@/lib/preflightValidation';
import { cn } from '@/lib/utils';
import type { PerSubredditOverride } from '../components/subreddit-picker';

// Skeleton loader for SubredditFlairPicker
const SubredditPickerSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-10 w-full rounded-lg" />
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <SubredditRowSkeleton key={i} />
      ))}
    </div>
  </div>
);

// Skeleton loader for PostingQueue
const QueueSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-9 w-24" />
    </div>
    <Skeleton className="h-20 w-full rounded-lg" />
  </div>
);

// Dynamic imports for heavy components with loading states
const SubredditFlairPicker = dynamic(
  () => import('../components/SubredditFlairPicker'),
  { 
    loading: () => <SubredditPickerSkeleton />,
    ssr: false // Client-side only for faster initial load
  }
);

const PostingQueue = dynamic(
  () => import('../components/PostingQueue'),
  { 
    loading: () => <QueueSkeleton />,
    ssr: false
  }
);

const UpgradeModal = dynamic(
  () => import('../components/UpgradeModal'),
  { ssr: false }
);

const EditFailedPostDialog = dynamic(
  () => import('../components/posting-queue/EditFailedPostDialog'),
  { ssr: false }
);

const CustomizePostDialog = dynamic(
  () => import('../components/subreddit-picker').then(mod => ({ default: mod.CustomizePostDialog })),
  { ssr: false }
);

import { PwaOnboarding } from '@/components/PwaOnboarding';


export default function Home() {
  const router = useRouter();
  
  // Use cached auth from context - no redundant API calls on navigation
  const { isAuthenticated, isLoading: authLoading, user, me, entitlement, limits, logout } = useAuth();
  
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [upgradeLoading, setUpgradeLoading] = React.useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const [upgradeModalContext, setUpgradeModalContext] = React.useState<{ title?: string; message: string } | undefined>(undefined);

  // Smooth loader exit: keep AppLoader mounted briefly to fade out
  const [showLoader, setShowLoader] = React.useState(true);
  const [loaderExiting, setLoaderExiting] = React.useState(false);

  React.useEffect(() => {
    if (!authLoading && showLoader) {
      // Auth resolved — begin fade-out
      setLoaderExiting(true);
      const timer = setTimeout(() => {
        setShowLoader(false);
      }, 300); // matches the CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [authLoading, showLoader]);

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
  } = useHomePageState({ authMe: me ?? undefined });

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

  // Redirect to login if not authenticated (after auth check completes)
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Set Sentry user context when auth is available
  React.useEffect(() => {
    if (me && user) {
      Sentry.setUser({
        id: me.id || user.userId,
        username: me.name,
      });
    }
  }, [me, user]);

  // Check admin status (separate from auth, non-blocking)
  React.useEffect(() => {
    if (!isAuthenticated) return;
    
    const checkAdmin = async () => {
      try {
        const adminRes = await axios.get<{ isAdmin: boolean }>('/api/admin-check');
        setIsAdmin(adminRes.data.isAdmin);
      } catch {
        // Ignore admin check failures
      }
    };
    checkAdmin();
  }, [isAuthenticated]);

  const handleLogout = React.useCallback(async () => {
    Sentry.setUser(null);
    await logout();
  }, [logout]);

  const handleUpgrade = React.useCallback(() => {
    // Navigate to inline checkout page
    router.push('/checkout');
  }, [router]);

  // Calculate user stats for header display
  const userStats = React.useMemo(() => {
    if (!me) return undefined;
    
    const createdUtc = me.created_utc;
    let accountAgeDays = 0;
    let accountAgeLabel = 'Unknown';
    
    if (createdUtc) {
      const now = Date.now() / 1000;
      const ageSeconds = now - createdUtc;
      accountAgeDays = Math.floor(ageSeconds / (60 * 60 * 24));
      
      if (accountAgeDays < 1) accountAgeLabel = 'Today';
      else if (accountAgeDays === 1) accountAgeLabel = '1 day';
      else if (accountAgeDays < 30) accountAgeLabel = `${accountAgeDays} days`;
      else if (accountAgeDays < 365) {
        const months = Math.floor(accountAgeDays / 30);
        accountAgeLabel = `${months} month${months !== 1 ? 's' : ''}`;
      } else {
        const years = Math.floor(accountAgeDays / 365);
        accountAgeLabel = `${years} year${years !== 1 ? 's' : ''}`;
      }
    }
    
    return {
      totalKarma: me.total_karma ?? 0,
      followers: me.followers ?? 0,
      accountAgeDays,
      accountAgeLabel,
      hasVerifiedEmail: me.has_verified_email ?? false,
    };
  }, [me]);

  // Wrapper for post attempt that checks free user limit
  // Returns false to block posting, true to allow
  const handlePostWithLimitCheck = React.useCallback((): boolean => {
    const maxPostItems = limits.maxPostItems ?? 5;
    // Check if free user is trying to post to more subreddits than their limit
    if (entitlement === 'free' && selectedSubs.length > maxPostItems) {
      setUpgradeModalContext({
        title: `You picked ${selectedSubs.length} communities`,
        message: `Free: up to ${maxPostItems} per post. Go Pro for unlimited.`,
      });
      setShowUpgradeModal(true);
      return false; // Block posting, show upgrade modal instead
    }
    // Otherwise proceed with normal post attempt
    handlePostAttempt();
    return true; // Allow posting
  }, [entitlement, limits.maxPostItems, selectedSubs.length, handlePostAttempt]);

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

      {/* Subtle loader overlay — fades out once auth resolves */}
      {showLoader && <AppLoader exiting={loaderExiting} />}

      {!authLoading && (
        <div className="min-h-screen bg-background flex flex-col noise-texture noise-subtle">
          {/* Header */}
          <AppHeader
            userName={me?.name}
            userAvatar={me?.icon_img}
            onLogout={handleLogout}
            isAdmin={isAdmin}
            entitlement={entitlement}
            onUpgrade={() => {
              setUpgradeModalContext(undefined);
              setShowUpgradeModal(true);
            }}
            upgradeLoading={upgradeLoading}
            userStats={userStats}
          />

          {/* Mobile: User Stats Banner (hides on scroll) */}
          <MobileUserStatsBanner userStats={userStats} />

          <PwaOnboarding hasQueueItems={items.length > 0} />

            <main className="flex-1 container mx-auto px-4 sm:px-6 py-4 lg:py-8 max-w-2xl lg:max-w-7xl safe-bottom pb-20 md:pb-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">

              {/* Left Column: Create Post */}
              <div className="lg:space-y-8">
                {/* Section Header - Desktop only */}
                <h2 className="text-xl mb-4 font-semibold tracking-tight hidden lg:block">Your post</h2>

                {/* Media Section - No card wrapper, flowing layout */}
                <section className="space-y-4 mb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base lg:text-lg font-semibold tracking-tight">Media</h3>
                    <div className="inline-flex items-center rounded-md bg-secondary/50 p-1 text-muted-foreground">
                      <button
                        onClick={() => setMediaMode('file')}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          mediaMode === 'file'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'hover:bg-background/50 hover:text-foreground'
                        )}
                        aria-pressed={mediaMode === 'file'}
                      >
                        Upload
                      </button>
                      <button
                        onClick={() => setMediaMode('url')}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          mediaMode === 'url'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'hover:bg-background/50 hover:text-foreground'
                        )}
                        aria-pressed={mediaMode === 'url'}
                      >
                        URL
                      </button>
                    </div>
                  </div>
                  <MediaUpload onUrl={setMediaUrl} onFile={setMediaFiles} mode={mediaMode} />
                </section>

                {/* Title Section - No card wrapper, flowing layout */}
                <section className="space-y-4 mb-4">
                  <h3 className="text-base lg:text-lg font-semibold tracking-tight">Title & Body</h3>
                  <PostComposer
                    value={caption}
                    onChange={setCaption}
                    body={body}
                    onBodyChange={setBody}
                    prefixes={prefixes}
                    onPrefixesChange={setPrefixes}
                  />
                </section>
              </div>

              {/* Right Column: Communities & Queue */}
              <div className="space-y-4 lg:space-y-8">
                {/* Section Header - Desktop only */}
                <h2 className="text-xl font-semibold tracking-tight hidden lg:block">Where to post</h2>

                {/* Communities Section */}
                <section 
                  className={cn(
                    "space-y-4",
                    "lg:rounded-lg lg:border lg:border-border/50 lg:p-6 lg:bg-card/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base lg:text-lg font-semibold tracking-tight">Communities</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/settings')}
                      className="h-9 px-3 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground rounded-md transition-colors hover:bg-secondary"
                      aria-label="Manage communities and flairs"
                    >
                      <Settings className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                      Manage
                    </Button>
                  </div>
                  
                  <SubredditFlairPicker
                    selected={selectedSubs}
                    onSelectedChange={setSelectedSubs}
                    flairValue={flairs}
                    onFlairChange={setFlairs}
                    titleSuffixValue={titleSuffixes}
                    onTitleSuffixChange={setTitleSuffixes}
                    onValidationChange={handleValidationChange}
                    showValidationErrors={showValidationErrors}
                    temporarySelectionEnabled={limits.temporarySelectionEnabled ?? true}
                    failedPosts={failedPostsHook.state.posts}
                    onRetryPost={handleRetryPost}
                    onEditPost={handleEditPost}
                    onRemovePost={handleRemovePost}
                    validationIssuesBySubreddit={validationIssuesBySubreddit}
                    contentOverrides={contentOverrides}
                    onCustomize={handleCustomize}
                    customizationEnabled={entitlement === 'paid'}
                    userData={me ?? undefined}
                  />

                  {/* Post to Profile - Soft divider */}
                  {isAuthenticated && me?.name && (
                    <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                      <Checkbox
                        id="post-to-profile"
                        checked={postToProfile}
                        onCheckedChange={(checked) => setPostToProfile(checked === true)}
                        className="rounded-md"
                      />
                      <label
                        htmlFor="post-to-profile"
                        className="text-sm cursor-pointer select-none font-medium text-foreground"
                      >
                        Post to profile 
                        <span className="text-muted-foreground text-xs font-normal ml-1.5">
                          (u/{me.name})
                        </span>
                      </label>
                    </div>
                  )}
                </section>

                {/* Queue Section */}
                <section 
                  className={cn(
                    "lg:sticky lg:top-20",
                    "lg:rounded-lg lg:border lg:border-border/50 lg:p-6 lg:bg-card/50",
                    "pt-6  border-t border-border/50 lg:border-t-0"
                  )}
                >
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
                </section>
              </div>
            </div>
          </main>

          {/* Footer */}
          <AppFooter />
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
