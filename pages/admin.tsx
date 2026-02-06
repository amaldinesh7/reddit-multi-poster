import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  BarChart3,
  Users,
  HeadphonesIcon,
  RefreshCw,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/layout';

// Dynamic imports for tab components - load only when needed
const AnalyticsTab = dynamic(() => import('@/components/admin/AnalyticsTab').then(mod => ({ default: mod.AnalyticsTab })), {
  loading: () => <TabLoadingState icon={<BarChart3 className="w-6 h-6" />} text="Loading analytics..." />,
  ssr: false,
});

const UserSupportTab = dynamic(() => import('@/components/admin/UserSupportTab').then(mod => ({ default: mod.UserSupportTab })), {
  loading: () => <TabLoadingState icon={<HeadphonesIcon className="w-6 h-6" />} text="Loading support..." />,
  ssr: false,
});

const UserManagementTab = dynamic(() => import('@/components/admin/UserManagementTab').then(mod => ({ default: mod.UserManagementTab })), {
  loading: () => <TabLoadingState icon={<Users className="w-6 h-6" />} text="Loading users..." />,
  ssr: false,
});

// Lightweight loading state for tabs
const TabLoadingState = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center text-muted-foreground animate-pulse">
      {icon}
    </div>
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);

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
  const { isAuthenticated, isLoading: authLoading, me, logout, entitlement } = useAuth();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  const [isAdmin, setIsAdmin] = useState(false);

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
      setIsAdmin(true);
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

  const header = isAuthenticated ? (
    <AppHeader
      userName={me?.name}
      userAvatar={me?.icon_img}
      onLogout={logout}
      entitlement={entitlement}
      isAdmin={isAdmin}
      pageTitle="Admin Panel"
      showBackButton
      onBack={() => router.back()}
      headerActions={
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="min-h-[44px] min-w-[44px] p-2 cursor-pointer hover:bg-cyan-500/10 hover:text-cyan-400"
          aria-label="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      }
    />
  ) : null;

  // Loading state - simple centered spinner
  if (authLoading || isLoading) {
    return (
      <>
        {header}
        <div className="min-h-viewport bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </>
    );
  }

  // Error state (including access denied)
  if (error) {
    return (
      <>
        {header}
        <div className="min-h-viewport bg-background flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <XCircle className="w-10 h-10 text-red-400" />
            <p className="text-foreground font-medium">{error}</p>
            <Button onClick={() => router.push('/')} variant="outline" size="sm" className="cursor-pointer">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </>
    );
  }

  // No data state
  if (!data) {
    return (
      <>
        {header}
        <div className="min-h-viewport bg-background flex items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Panel - Reddit Multi Poster</title>
        <meta name="description" content="Admin panel and analytics" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-viewport bg-background">
        {header}

        {/* Main Content */}
        <main className="app-container py-6 max-w-6xl">
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
