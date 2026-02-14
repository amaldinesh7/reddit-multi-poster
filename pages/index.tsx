import React from 'react';
import type { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import { Lightbulb, Settings } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { checkAuthCookies, redirectToLogin } from '@/lib/serverAuth';
import * as Sentry from '@sentry/nextjs';
import MediaUpload from '../components/MediaUpload';
import PostComposer, { PostComposerRef } from '../components/PostComposer';
import { AppLoader, Skeleton, SubredditRowSkeleton, CardSkeleton } from '@/components/ui/loader';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItemPrimitive,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { AppHeader, MobileUserStatsBanner, AppFooter } from '@/components/layout';
import { useHomePageState } from '@/hooks/useHomePageState';
import { QuickActions } from '@/components/QuickActions';
import { useFailedPosts, FailedPost } from '@/hooks/useFailedPosts';
import { useSubredditFlairData } from '@/hooks/useSubredditFlairData';
import { useQueueJob } from '@/hooks/useQueueJob';
import { useAuth } from '@/hooks/useAuth';
import { useSubreddits } from '@/hooks/useSubreddits';
import { FREE_MAX_SUBREDDITS } from '@/lib/entitlement';
import { usePersistentState } from '@/hooks/usePersistentState';
import { captureClientError, addActionBreadcrumb } from '@/lib/clientErrorHandler';
import type { ValidationIssue, PreflightResult } from '@/lib/preflightValidation';
import { cn } from '@/lib/utils';
import { normalizeSubredditKey } from '@/lib/subredditKey';
import type { PerSubredditOverride } from '../components/subreddit-picker';
import { trackEvent } from '@/lib/posthog';

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

const TrialEndedModal = dynamic(
  () => import('../components/TrialEndedModal'),
  { ssr: false }
);

const CommunitySelectionModal = dynamic(
  () => import('../components/CommunitySelectionModal'),
  { ssr: false }
);

const ReviewPanel = dynamic(
  () => import('../components/ReviewPanel'),
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
  const {
    isAuthenticated,
    isLoading: authLoading,
    user,
    me,
    entitlement,
    trialDaysLeft,
    showTrialEndedPopup,
    limits,
    logout,
    refresh,
  } = useAuth();
  
  // Get saved subreddits data for community selection modal (trial expiry flow)
  const {
    data: subredditData,
    getAllSubredditsWithCategory,
    bulkDeleteExcept,
    refresh: refreshSubreddits,
  } = useSubreddits();

  // Calculate total saved subreddits count early (needed for limit checks in callbacks)
  const totalSavedSubreddits = React.useMemo(() => {
    return subredditData.categories.reduce((sum, c) => sum + c.user_subreddits.length, 0);
  }, [subredditData.categories]);
  
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [upgradeLoading, setUpgradeLoading] = React.useState(false);
  const [trialLoading, setTrialLoading] = React.useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const [showTrialEndedModal, setShowTrialEndedModal] = React.useState(false);
  const [showCommunitySelectionModal, setShowCommunitySelectionModal] = React.useState(false);
  const [upgradeModalContext, setUpgradeModalContext] = React.useState<{ title?: string; message: string } | undefined>(undefined);
  
  // Ref to prevent duplicate trial ended popup handling
  const hasRefreshedForTrialRef = React.useRef(false);
  const [mediaResetCounter, setMediaResetCounter] = React.useState(0);
  const [benchResetCounter, setBenchResetCounter] = React.useState(0);
  const [communitiesView, setCommunitiesView] = usePersistentState<'grouped' | 'all'>('rmp_communities_view', 'grouped');
  const [isReviewOpen, setIsReviewOpen] = React.useState(false);
  const postActionRef = React.useRef<(() => void) | null>(null);
  const postComposerRef = React.useRef<PostComposerRef>(null);
  const [validationState, setValidationState] = React.useState<{
    canSubmit: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    result: PreflightResult;
    issuesBySubreddit: Record<string, ValidationIssue[]>;
  } | null>(null);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = React.useState(false);
  const [hasValidationFieldInteraction, setHasValidationFieldInteraction] = React.useState(false);
  const [hasValidationCtaIntent, setHasValidationCtaIntent] = React.useState(false);
  const [validationNavigatorIndex, setValidationNavigatorIndex] = React.useState(0);
  const [navigationTargetSubreddit, setNavigationTargetSubreddit] = React.useState<string | null>(null);

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
    mediaType,
    setMediaType,
    flairs,
    setFlairs,
    titleSuffixes,
    setTitleSuffixes,
    customTitles,
    contentOverrides,
    setContentOverrides,
    postToProfile,
    setPostToProfile,
    hasFlairErrors,
    showValidationErrors,
    setShowValidationErrors,
    items,
    handleValidationChange,
    handlePostAttempt,
    handleUnselectSuccessItems,
    clearSelection,
    clearAllState,
    // Last post settings feature
    hasLastPostSettings,
    lastPostSettingsDate,
    justAppliedLastPost,
    saveCurrentAsLastPost,
    applyLastPostSettings,
  } = useHomePageState({ authMe: me ?? undefined });

  const resetMedia = React.useCallback(() => {
    setMediaUrl('');
    setMediaFiles([]);
    setMediaResetCounter((prev) => prev + 1);
  }, [setMediaUrl, setMediaFiles]);

  // MVP: hide video upload tab and force image mode
  React.useEffect(() => {
    if (mediaType !== 'video') return;
    resetMedia();
    setMediaType('image');
  }, [mediaType, resetMedia, setMediaType]);

  // Failed posts tracking for inline error display
  const failedPostsHook = useFailedPosts();

  const handleClearAll = React.useCallback(() => {
    clearAllState();
    failedPostsHook.clearAll();
    setMediaResetCounter((prev) => prev + 1);
    setBenchResetCounter((prev) => prev + 1);
  }, [clearAllState, failedPostsHook]);

  const hasTitle = caption.trim().length > 0;
  const hasDestinations = selectedSubs.length > 0 || postToProfile;
  const blockingValidationErrors = validationState?.errors ?? [];
  const blockingValidationSubreddits = React.useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (const issue of blockingValidationErrors) {
      if (!issue.subreddit) continue;
      const normalized = normalizeSubredditKey(issue.subreddit);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      ordered.push(issue.subreddit);
    }

    return ordered;
  }, [blockingValidationErrors]);
  const hasBlockingValidation = hasTitle && hasDestinations && blockingValidationErrors.length > 0;
  const reviewCtaMode: 'missing_essentials' | 'blocking_validation' | 'ready' = !hasTitle || !hasDestinations
    ? 'missing_essentials'
    : hasBlockingValidation
      ? 'blocking_validation'
      : 'ready';
  const canReview = reviewCtaMode === 'ready';
  const canPost = canReview;
  const isReviewDisabled = reviewCtaMode !== 'ready';
  const shouldShowValidationNavigator = hasBlockingValidation && (hasValidationFieldInteraction || hasValidationCtaIntent);
  const validationNavigatorSummary = `You have ${blockingValidationErrors.length} blocking errors in ${blockingValidationSubreddits.length} communities.`;

  React.useEffect(() => {
    if (!hasBlockingValidation) {
      setValidationNavigatorIndex(0);
      return;
    }

    if (validationNavigatorIndex >= blockingValidationSubreddits.length) {
      setValidationNavigatorIndex(0);
    }
  }, [hasBlockingValidation, validationNavigatorIndex, blockingValidationSubreddits.length]);

  // Compute current post kind based on media state
  const currentPostKind = React.useMemo((): 'self' | 'link' | 'image' | 'video' | 'gallery' => {
    if (mediaFiles.length > 1) return 'gallery';
    if (mediaFiles.length === 1) {
      const file = mediaFiles[0];
      return file.type?.startsWith('video/') ? 'video' : 'image';
    }
    if (mediaUrl) return 'link';
    return 'self'; // text post
  }, [mediaFiles, mediaUrl]);

  React.useEffect(() => {
    if (isReviewDisabled && isMoreActionsOpen) {
      setIsMoreActionsOpen(false);
    }
  }, [isReviewDisabled, isMoreActionsOpen]);

  const handleNavigateToValidationIssue = React.useCallback((nextIndex: number) => {
    if (blockingValidationSubreddits.length === 0) return;

    const normalizedIndex =
      ((nextIndex % blockingValidationSubreddits.length) + blockingValidationSubreddits.length) % blockingValidationSubreddits.length;
    const target = blockingValidationSubreddits[normalizedIndex];

    setValidationNavigatorIndex(normalizedIndex);
    setNavigationTargetSubreddit(target);
    setShowValidationErrors(true);
    setHasValidationCtaIntent(true);
  }, [blockingValidationSubreddits, setShowValidationErrors]);

  const handleGoToFirstValidationIssue = React.useCallback(() => {
    handleNavigateToValidationIssue(0);
  }, [handleNavigateToValidationIssue]);

  const handleGoToNextValidationIssue = React.useCallback(() => {
    handleNavigateToValidationIssue(validationNavigatorIndex + 1);
  }, [handleNavigateToValidationIssue, validationNavigatorIndex]);

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
    // Track customize post click for feature discovery analytics (PRO feature interest)
    trackEvent('customize_post_clicked', { source: 'subreddit_row' });
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

  const handleValidationStateChange = React.useCallback((state: {
    canSubmit: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    result: PreflightResult;
    issuesBySubreddit: Record<string, ValidationIssue[]>;
  }) => {
    setValidationState(state);
  }, []);

  const handleOpenReview = React.useCallback(() => {
    setIsReviewOpen(true);
  }, []);

  const handleReviewAndPostAction = React.useCallback(() => {
    if (reviewCtaMode === 'missing_essentials') {
      // Focus title field if title is missing
      if (!hasTitle) {
        postComposerRef.current?.focusTitle();
      }
      return;
    }

    if (reviewCtaMode === 'blocking_validation') {
      handleGoToFirstValidationIssue();
      return;
    }

    // Check free user limits BEFORE opening review
    // First check if user is OVER the saved communities limit (e.g., trial expired with many communities)
    if (entitlement === 'free' && totalSavedSubreddits > FREE_MAX_SUBREDDITS) {
      trackEvent('community_selection_required', {
        source: 'review_click',
        subreddit_count: totalSavedSubreddits,
        max_allowed: FREE_MAX_SUBREDDITS,
      });
      setShowCommunitySelectionModal(true);
      return; // Block review, show community selection modal first
    }

    handleOpenReview();
  }, [reviewCtaMode, hasTitle, handleGoToFirstValidationIssue, handleOpenReview, entitlement, totalSavedSubreddits]);

  const handlePostNow = React.useCallback(() => {
    // Check free user limits BEFORE posting
    // First check if user is OVER the saved communities limit (e.g., trial expired with many communities)
    if (entitlement === 'free' && totalSavedSubreddits > FREE_MAX_SUBREDDITS) {
      trackEvent('community_selection_required', {
        source: 'review_post_now',
        subreddit_count: totalSavedSubreddits,
        max_allowed: FREE_MAX_SUBREDDITS,
      });
      setIsReviewOpen(false);
      setShowCommunitySelectionModal(true);
      return; // Block posting, show community selection modal
    }
    
    const maxPostItems = limits.maxPostItems ?? 5;
    // Check if free user is trying to post to more subreddits than their limit
    if (entitlement === 'free' && selectedSubs.length > maxPostItems) {
      trackEvent('free_limit_reached', {
        source: 'review_post_now',
        subreddit_count: selectedSubs.length,
      });
      setIsReviewOpen(false);
      setUpgradeModalContext({
        title: `You picked ${selectedSubs.length} communities`,
        message: `Free: up to ${maxPostItems} per post. Go Pro for unlimited.`,
      });
      setShowUpgradeModal(true);
      return; // Block posting, show upgrade modal
    }

    if (postActionRef.current) {
      postActionRef.current();
    }
    setIsReviewOpen(false);
  }, [entitlement, totalSavedSubreddits, limits.maxPostItems, selectedSubs.length]);

  const handleResetSelection = React.useCallback(() => {
    clearSelection();
    setPostToProfile(false);
    setIsReviewOpen(false);
  }, [clearSelection, setPostToProfile, setIsReviewOpen]);

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

    // Save last post settings if there was at least one successful post
    const hasSuccessfulPost = results.some(r => r.status === 'success');
    if (hasSuccessfulPost) {
      saveCurrentAsLastPost();
    }
  }, [caption, prefixes, failedPostsHook, saveCurrentAsLastPost]);

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
        showToast: false,
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
    updates: { flairId?: string; titleSuffix?: string; customTitle?: string; customBody?: string }
  ) => {
    setIsRetryingEdit(true);
    addActionBreadcrumb('Submit edit and retry', { subreddit: post.subreddit, updates });

    try {
      // Update the post with new values
      failedPostsHook.updatePost(post.id, updates);

      const effectiveTitle = updates.customTitle ?? post.customTitle ?? post.originalCaption;
      const effectiveBody = updates.customBody ?? post.customBody ?? post.originalItem.text;

      // Submit retry with updated values
      const jobId = await queueJobHook.retryItem(
        {
          subreddit: post.subreddit,
          flairId: updates.flairId || post.flairId,
          titleSuffix: updates.titleSuffix || post.titleSuffix,
          customTitle: updates.customTitle ?? post.customTitle ?? post.originalItem.customTitle,
          kind: post.kind,
          url: post.url,
          text: effectiveBody,
          file: post.originalItem.file,
          files: post.originalItem.files,
        },
        effectiveTitle,
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
        showToast: false,
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
        const adminRes = await axios.get<{ isAdmin: boolean; isAdminByUsername: boolean }>('/api/admin-check');
        // Only show admin menu if user is admin by Reddit username (not password)
        // isAdminByUsername is explicitly false for password-only auth
        setIsAdmin(adminRes.data.isAdminByUsername === true);
      } catch {
        // Ignore admin check failures
      }
    };
    checkAdmin();
  }, [isAuthenticated]);

  const handleLogout = React.useCallback(async () => {
    try {
      await logout();
      Sentry.setUser(null);
    } catch (err) {
      captureClientError(err, 'index.handleLogout', {
        toastTitle: 'Logout Failed',
        userMessage: 'Could not log out. Please try again.',
      });
    }
  }, [logout]);

  const handleUpgrade = React.useCallback(() => {
    setUpgradeLoading(true);
    // Add a fallback timeout to reset loading state if navigation is blocked/delayed
    const timeoutId = setTimeout(() => setUpgradeLoading(false), 5000);
    // Clear timeout if page is actually unloading
    const handleUnload = () => clearTimeout(timeoutId);
    window.addEventListener('beforeunload', handleUnload, { once: true });
    // Navigate to inline checkout page (full page load for consistency)
    window.location.href = '/checkout';
  }, []);

  const handleStartTrial = React.useCallback(async () => {
    setTrialLoading(true);
    try {
      await axios.post('/api/trial/start');
      await refresh();
      setShowUpgradeModal(false);
      trackEvent('trial_started', {
        source: 'upgrade_modal',
        plan: 'pro_trial',
      });
    } catch (error) {
      const userMessage = axios.isAxiosError(error)
        ? error.response?.data?.error || 'Could not start trial. Please try again.'
        : 'Could not start trial. Please try again.';

      setUpgradeModalContext({
        title: 'Trial unavailable',
        message: userMessage,
      });
      captureClientError(error, 'index.handleStartTrial', {
        toastTitle: 'Trial unavailable',
        userMessage,
      });
    } finally {
      setTrialLoading(false);
    }
  }, [refresh]);

  // Handle community selection confirmation (when trial ends and user has >5 communities)
  const handleCommunitySelectionConfirm = React.useCallback(async (selectedIds: string[]) => {
    // Validate selectedIds is not empty
    if (!selectedIds || selectedIds.length === 0) {
      captureClientError(new Error('No communities selected'), 'index.handleCommunitySelectionConfirm', {
        toastTitle: 'Selection Error',
        userMessage: 'Please select at least one community to keep.',
      });
      return;
    }
    
    try {
      const success = await bulkDeleteExcept(selectedIds);
      if (success) {
        setShowCommunitySelectionModal(false);
        clearSelection(); // Clear selected subreddits since some may have been deleted
        await refreshSubreddits(); // Refresh the subreddit data after deletion
      } else {
        // bulkDeleteExcept returned false (failure without throwing)
        captureClientError(new Error('Community deletion failed'), 'index.handleCommunitySelectionConfirm', {
          toastTitle: 'Failed to save selection',
          userMessage: 'Could not remove communities. Please try again.',
        });
      }
    } catch (error) {
      captureClientError(error, 'index.handleCommunitySelectionConfirm', {
        toastTitle: 'Failed to save selection',
        userMessage: 'Could not remove communities. Please try again.',
      });
    }
  }, [bulkDeleteExcept, refreshSubreddits, clearSelection]);

  React.useEffect(() => {
    if (!showTrialEndedPopup) {
      // Reset the ref when popup becomes false (allows re-triggering for future popups)
      hasRefreshedForTrialRef.current = false;
      return;
    }
    // Only run once per popup signal
    if (hasRefreshedForTrialRef.current) return;
    hasRefreshedForTrialRef.current = true;
    
    setShowTrialEndedModal(true);
    trackEvent('trial_ended_popup_shown', {
      source: 'home',
    });
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTrialEndedPopup]);

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
    // First check if user is OVER the saved communities limit (e.g., trial expired with many communities)
    // This requires them to select which to keep before posting
    if (entitlement === 'free' && totalSavedSubreddits > FREE_MAX_SUBREDDITS) {
      trackEvent('community_selection_required', {
        source: 'post_attempt',
        subreddit_count: totalSavedSubreddits,
        max_allowed: FREE_MAX_SUBREDDITS,
      });
      setShowCommunitySelectionModal(true);
      return false; // Block posting, show community selection modal
    }
    
    const maxPostItems = limits.maxPostItems ?? 5;
    // Check if free user is trying to post to more subreddits than their limit
    if (entitlement === 'free' && selectedSubs.length > maxPostItems) {
      // Track free limit reached for funnel analytics
      trackEvent('free_limit_reached', {
        source: 'post_attempt',
        subreddit_count: selectedSubs.length,
      });
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
  }, [entitlement, totalSavedSubreddits, limits.maxPostItems, selectedSubs.length, handlePostAttempt]);

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
        <div className="min-h-viewport bg-background flex flex-col noise-texture noise-subtle">
          {/* Header */}
          <AppHeader
            userName={me?.name}
            userAvatar={me?.icon_img}
            onLogout={handleLogout}
            isAdmin={isAdmin}
            entitlement={entitlement}
            trialDaysLeft={trialDaysLeft}
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

            <main className="flex-1 app-container py-4 md:py-6 lg:py-8 max-w-2xl lg:max-w-7xl safe-bottom">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-start lg:divide-x lg:divide-border/50">

              {/* Left Column: Create Post */}
              <div className="lg:pr-6">
                {/* Section Header with Quick Actions - Desktop only */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold tracking-tight hidden lg:block">Your post</h2>
                  {/* Quick Actions - Load Last Post Settings */}
                  <QuickActions
                    onLoadLastPost={applyLastPostSettings}
                    hasLastPost={hasLastPostSettings}
                    lastPostDate={lastPostSettingsDate}
                    justApplied={justAppliedLastPost}
                    className="hidden lg:flex"
                  />
                </div>
                {/* Mobile Quick Actions */}
                <QuickActions
                  onLoadLastPost={applyLastPostSettings}
                  hasLastPost={hasLastPostSettings}
                  lastPostDate={lastPostSettingsDate}
                  justApplied={justAppliedLastPost}
                  className="lg:hidden mb-4"
                />

                {/* Media Section - No card wrapper, flowing layout */}
                <section className="space-y-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-base lg:text-lg font-semibold tracking-tight pt-1 lg:pt-2">Media</h3>
                      <Tooltip content="For uploading videos, use Imgur, Redgif, or GIPHY and paste the link in the URL tab.">
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer">
                          <Lightbulb className="h-3 w-3" aria-hidden="true" />
                          Pro tip
                        </span>
                      </Tooltip>
                    </div>
                    <div className="inline-flex items-center rounded-md bg-secondary/50 p-1 text-muted-foreground">
                      <button
                        onClick={() => {
                          resetMedia();
                          setMediaType('image');
                        }}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          mediaType === 'image'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'hover:bg-background/50 hover:text-foreground',
                          "cursor-pointer"
                        )}
                        aria-pressed={mediaType === 'image'}
                      >
                        Image
                      </button>
                      <button
                        onClick={() => {
                          resetMedia();
                          setMediaType('url');
                        }}
                        className={cn(
                          "inline-flex items-center justify-center whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          mediaType === 'url'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'hover:bg-background/50 hover:text-foreground',
                          "cursor-pointer"
                        )}
                        aria-pressed={mediaType === 'url'}
                      >
                        URL
                      </button>
                    </div>
                  </div>
                  <MediaUpload
                    onUrl={setMediaUrl}
                    onFile={setMediaFiles}
                    mode={mediaType}
                    resetSignal={mediaResetCounter}
                  />
                </section>

                <div className="border-t border-border/50 my-6" aria-hidden="true" />

                {/* Title Section - No card wrapper, flowing layout */}
                <section className="space-y-4 mb-4">
                  <h3 className="text-base lg:text-lg font-semibold tracking-tight">Title & Body</h3>
                  <PostComposer
                    ref={postComposerRef}
                    value={caption}
                    onChange={(value) => {
                      setCaption(value);
                      setHasValidationFieldInteraction(true);
                    }}
                    body={body}
                    onBodyChange={setBody}
                    prefixes={prefixes}
                    onPrefixesChange={setPrefixes}
                    resetSignal={benchResetCounter}
                    aiContext={{
                      selectedSubreddits: selectedSubs,
                      mediaType: currentPostKind,
                    }}
                  />
                </section>
              </div>

              <div className="border-t border-border/50 my-4 lg:hidden" aria-hidden="true" />

              {/* Right Column: Communities & Queue */}
              <div className="lg:pl-6">
                {/* Section Header - Desktop only */}
                <h2 className="text-xl font-semibold tracking-tight hidden lg:block mb-4 lg:mb-4">Where to post</h2>

                {/* Communities Section */}
                <section 
                  className={cn(
                    "space-y-4"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base lg:text-lg font-semibold tracking-tight pt-1 lg:pt-2">Communities</h3>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center rounded-md bg-secondary/50 p-1 text-muted-foreground">
                        <button
                          onClick={() => setCommunitiesView('grouped')}
                          className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            communitiesView === 'grouped'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'hover:bg-background/50 hover:text-foreground',
                            "cursor-pointer"
                          )}
                          aria-pressed={communitiesView === 'grouped'}
                        >
                          Grouped
                        </button>
                        <button
                          onClick={() => setCommunitiesView('all')}
                          className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            communitiesView === 'all'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'hover:bg-background/50 hover:text-foreground',
                            "cursor-pointer"
                          )}
                          aria-pressed={communitiesView === 'all'}
                        >
                          All
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground rounded-md transition-colors hover:bg-secondary"
                        aria-label="Manage communities and flairs"
                        onClick={() => { window.location.href = '/settings'; }}
                      >
                        <Settings className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                        Manage
                      </Button>
                    </div>
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
                    showInlineValidationHint={showValidationErrors}
                    onIssueFieldInteraction={() => setHasValidationFieldInteraction(true)}
                    onNavigateToSubredditIssue={() => setHasValidationCtaIntent(true)}
                    navigationTargetSubreddit={navigationTargetSubreddit}
                    onNavigationHandled={() => setNavigationTargetSubreddit(null)}
                    temporarySelectionEnabled={limits.temporarySelectionEnabled ?? true}
                    resetSignal={benchResetCounter}
                    viewMode={communitiesView}
                    failedPosts={failedPostsHook.state.posts}
                    onRetryPost={handleRetryPost}
                    onEditPost={handleEditPost}
                    onRemovePost={handleRemovePost}
                    validationIssuesBySubreddit={validationIssuesBySubreddit}
                    contentOverrides={contentOverrides}
                    onCustomize={handleCustomize}
                    customizationEnabled={entitlement === 'paid' || entitlement === 'trial'}
                    userData={me ?? undefined}
                    postKind={currentPostKind}
                    onRequestUpgrade={(context) => {
                      setUpgradeModalContext(context ?? {
                        title: 'Upgrade to Pro',
                        message: 'Unlock saving communities and other Pro features.',
                      });
                      setShowUpgradeModal(true);
                    }}
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

                <div className="border-t border-border/50 my-4 lg:my-6" aria-hidden="true" />

                {/* Queue Section */}
                <section 
                  className={cn(
                    "lg:sticky lg:top-20",
                    "pt-2 lg:pt-0"
                  )}
                >
                  <div className="mb-3 hidden lg:flex items-center gap-2">
                    <div className="flex flex-1 flex-col items-stretch gap-2">
                      {shouldShowValidationNavigator && (
                        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                          <p className="font-medium">{validationNavigatorSummary}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleGoToFirstValidationIssue}
                              className="h-7 border-red-400/30 bg-transparent px-2 text-xs text-red-200 hover:bg-red-500/10 cursor-pointer"
                            >
                              Go to first issue
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleGoToNextValidationIssue}
                              className="h-7 border-red-400/30 bg-transparent px-2 text-xs text-red-200 hover:bg-red-500/10 cursor-pointer"
                            >
                              Next issue
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex flex-1 items-center">
                          <Button
                            onClick={handleReviewAndPostAction}
                            className="flex-1 cursor-pointer rounded-r-none"
                            aria-label="Review and post"
                          >
                            {reviewCtaMode === 'blocking_validation' ? 'Fix errors to post' : 'Review & post'}
                          </Button>
                          <DropdownMenuRoot
                            open={isMoreActionsOpen}
                            onOpenChange={(nextOpen) => {
                              if (isReviewDisabled) {
                                setIsMoreActionsOpen(false);
                                return;
                              }
                              setIsMoreActionsOpen(nextOpen);
                            }}
                          >
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                disabled={isReviewDisabled}
                                className={cn(
                                  "h-10 w-10 cursor-pointer rounded-l-none bg-primary text-primary-foreground border border-primary/80 border-l border-l-white/20",
                                  "hover:bg-primary/90",
                                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary"
                                )}
                                aria-label="More actions"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItemPrimitive
                                onClick={handlePostNow}
                                className="text-sm cursor-pointer"
                              >
                                Post now
                              </DropdownMenuItemPrimitive>
                            </DropdownMenuContent>
                          </DropdownMenuRoot>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={handleClearAll}
                          className="hidden lg:inline-flex h-10 px-3 text-sm font-medium cursor-pointer"
                        >
                          Reset
                        </Button>
                      </div>
                      {reviewCtaMode === 'missing_essentials' && (
                        <p 
                          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          onClick={() => {
                            if (!hasTitle) {
                              postComposerRef.current?.focusTitle();
                            }
                          }}
                        >
                          Add a title and choose at least one destination.
                        </p>
                      )}
                    </div>
                  </div>
                  <PostingQueue
                    items={items}
                    caption={caption}
                    body={body}
                    contentOverrides={contentOverrides}
                    customTitles={customTitles}
                    prefixes={prefixes}
                    hasFlairErrors={hasFlairErrors}
                    onPostAttempt={handlePostWithLimitCheck}
                    onUnselectSuccessItems={handleUnselectSuccessItems}
                    onClearAll={handleClearAll}
                    onResetMedia={resetMedia}
                    onResultsAvailable={handleResultsAvailable}
                    onValidationChange={handleQueueValidationChange}
                    onValidationStateChange={handleValidationStateChange}
                    mode="review-entry"
                    onPostActionReady={(handler) => {
                      postActionRef.current = handler;
                    }}
                    onReviewRequest={handleReviewAndPostAction}
                    hideMobileBar={isReviewOpen}
                  />
                </section>
              </div>
            </div>
          </main>

          <ReviewPanel
            open={isReviewOpen}
            onOpenChange={setIsReviewOpen}
            title={caption}
            body={body}
            mediaFiles={mediaFiles}
            mediaUrl={mediaUrl}
            selectedSubs={selectedSubs}
            postToProfile={postToProfile}
            userName={me?.name}
            flairRequired={flairRequired}
            flairValue={flairs}
            flairOptions={flairOptions}
            titleSuffixes={titleSuffixes}
            contentOverrides={contentOverrides}
            canPost={canPost}
            onPostNow={handlePostNow}
            onResetSelection={handleResetSelection}
          />

          {/* Footer */}
          <AppFooter />
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        onUpgrade={handleUpgrade}
        onStartTrial={handleStartTrial}
        upgradeLoading={upgradeLoading}
        trialLoading={trialLoading}
        canStartTrial={entitlement === 'free'}
        trialDaysLeft={trialDaysLeft}
        context={upgradeModalContext}
      />

      <TrialEndedModal
        open={showTrialEndedModal}
        onOpenChange={setShowTrialEndedModal}
        onUpgrade={handleUpgrade}
      />

      {/* Community Selection Modal - shown when trial expired and user has >5 communities */}
      <CommunitySelectionModal
        open={showCommunitySelectionModal}
        onOpenChange={setShowCommunitySelectionModal}
        communities={getAllSubredditsWithCategory()}
        onConfirm={handleCommunitySelectionConfirm}
        onUpgrade={handleUpgrade}
        maxToKeep={FREE_MAX_SUBREDDITS}
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
