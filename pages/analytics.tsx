import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ArrowLeft, BarChart3, CheckCircle2, XCircle, Users, Calendar, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  StatsCard,
  PostsChart,
  SubredditChart,
  RecentPostsTable,
  AdminUsers,
} from '@/components/analytics';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsData {
  totalPosts: number;
  successfulPosts: number;
  failedPosts: number;
  successRate: number;
  postsToday: number;
  postsLast7Days: number;
  postsLast30Days: number;
  topSubreddits: Array<{
    subreddit: string;
    count: number;
    successRate: number;
  }>;
  postsByDay: Array<{
    date: string;
    success: number;
    error: number;
  }>;
  recentPosts: Array<{
    id: string;
    subreddit: string;
    postKind: string;
    status: string;
    errorCode: string | null;
    redditUrl: string | null;
    createdAt: string;
  }>;
  totalUsers: number;
}

// ============================================================================
// Component
// ============================================================================

export default function Analytics() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch analytics data
  const fetchAnalytics = async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const res = await fetch('/api/analytics');
      
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      
      if (res.status === 403) {
        setError('Only admins can view this page.');
        return;
      }
      
      if (!res.ok) {
        throw new Error('Failed to fetch analytics');
      }
      
      const analyticsData = await res.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchAnalytics();
    } else if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Handle refresh
  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  // Error state (including access denied)
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <XCircle className="w-12 h-12 text-red-500" />
          <h1 className="text-xl font-semibold">{error}</h1>
          <p className="text-muted-foreground text-sm">
            {error.includes('admins')
              ? 'This page is only accessible to administrators.'
              : 'Please try again later.'}
          </p>
          <Button
            onClick={() => router.push('/')}
            variant="outline"
            className="cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BarChart3 className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground">No data yet</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Analytics - Reddit Multi Poster</title>
        <meta name="description" content="Post analytics and metrics" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="flex h-14 items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-secondary cursor-pointer"
                aria-label="Go back to home"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">Analytics</h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Post metrics & insights
                  </p>
                </div>
              </div>

              {/* Refresh button */}
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="min-h-[44px] min-w-[44px] p-2 cursor-pointer"
                  aria-label="Refresh analytics"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-6xl">
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Posts"
                value={data.totalPosts.toLocaleString()}
                subtitle={`${data.postsLast7Days} this week`}
                icon={<BarChart3 className="w-5 h-5" />}
              />
              <StatsCard
                title="Success rate"
                value={`${data.successRate}%`}
                subtitle={`${data.successfulPosts} successful`}
                trend={data.successRate >= 90 ? 'up' : data.successRate >= 70 ? 'neutral' : 'down'}
                icon={<CheckCircle2 className="w-5 h-5" />}
              />
              <StatsCard
                title="Failed"
                value={data.failedPosts.toLocaleString()}
                subtitle={`${data.totalPosts > 0 ? Math.round((data.failedPosts / data.totalPosts) * 100) : 0}% of total`}
                icon={<XCircle className="w-5 h-5" />}
              />
              <StatsCard
                title="Users"
                value={data.totalUsers.toLocaleString()}
                subtitle={`${data.postsToday} posts today`}
                icon={<Users className="w-5 h-5" />}
              />
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              <PostsChart data={data.postsByDay} />
              <SubredditChart data={data.topSubreddits} />
            </div>

            {/* Recent Posts Table */}
            <RecentPostsTable data={data.recentPosts} />

            {/* Admin Section */}
            <AdminUsers />

            {/* Privacy Notice */}
            <div className="text-center text-xs text-muted-foreground py-4">
              <p>
                Privacy: Only post metadata is tracked. No images, videos, or user content is stored.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
