import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Shield,
  BarChart3,
  Users,
  HeadphonesIcon,
  RefreshCw,
  Loader2,
  XCircle,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsTab, UserSupportTab, UserManagementTab } from '@/components/admin';

// ============================================================================
// Types
// ============================================================================

interface TopPoster {
  userId: string;
  username: string;
  avatarUrl: string | null;
  postCount: number;
  successCount: number;
  successRate: number;
}

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
  topPosters: TopPoster[];
}

// ============================================================================
// Component
// ============================================================================

export default function AdminPanel() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');

  // Get initial tab from URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (['analytics', 'support', 'users'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  // Update URL hash when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.history.replaceState(null, '', `#${value}`);
  };

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
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center animate-pulse">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <Loader2 className="w-3 h-3 animate-spin text-white" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-foreground font-display font-semibold">Admin Panel</p>
            <p className="text-muted-foreground text-sm">Loading command center...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state (including access denied)
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold font-display">{error}</h1>
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
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No data yet</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Panel - Reddit Multi Poster</title>
        <meta name="description" content="Admin panel and analytics" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-background">
        {/* Command Center Header */}
        <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="flex h-16 items-center gap-4">
              {/* Back Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-secondary cursor-pointer"
                aria-label="Go back to home"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              {/* Logo & Title */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center glow-cyan">
                    <Shield className="w-5 h-5 text-cyan-400" />
                  </div>
                  {/* Status indicator */}
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold font-display flex items-center gap-2">
                    Admin Panel
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-5 bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                    >
                      <Activity className="w-2.5 h-2.5 mr-1" />
                      Live
                    </Badge>
                  </h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Command Center • System Overview
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
                  className="min-h-[44px] min-w-[44px] p-2 cursor-pointer hover:bg-cyan-500/10 hover:text-cyan-400"
                  aria-label="Refresh data"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            {/* Tab Navigation */}
            <div className="mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="w-full sm:w-auto inline-flex">
                <TabsTrigger value="analytics" className="min-w-[120px]">
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="support" className="min-w-[120px]">
                  <HeadphonesIcon className="w-4 h-4" />
                  Support
                </TabsTrigger>
                <TabsTrigger value="users" className="min-w-[120px]">
                  <Users className="w-4 h-4" />
                  Users
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content */}
            <TabsContent value="analytics">
              <AnalyticsTab data={data} />
            </TabsContent>

            <TabsContent value="support">
              <UserSupportTab />
            </TabsContent>

            <TabsContent value="users">
              <UserManagementTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
