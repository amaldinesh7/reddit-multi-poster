import React, { useEffect, useState, useCallback } from 'react';
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
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  
  // Password login state
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
  const fetchAnalytics = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const res = await fetch('/api/analytics');

      if (res.status === 403) {
        // Not admin - show password login option
        setShowPasswordLogin(true);
        setError(null);
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const analyticsData = await res.json();
      setIsAdmin(true);
      setShowPasswordLogin(false);
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Handle password login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setIsSubmittingPassword(true);

    try {
      const res = await fetch('/api/admin-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const result = await res.json();

      if (result.isAdmin) {
        // Password accepted - fetch analytics
        setShowPasswordLogin(false);
        setPassword('');
        await fetchAnalytics();
      } else {
        setPasswordError(result.error || 'Invalid password');
      }
    } catch {
      setPasswordError('Failed to verify password');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  // Initial fetch - try immediately (password cookie may be set)
  useEffect(() => {
    // Don't wait for auth - try fetching analytics directly
    // This allows password-only access without Reddit login
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle refresh
  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  // Header - show if authenticated via Reddit OR if admin via password
  const header = (isAuthenticated || isAdmin) ? (
    <AppHeader
      userName={me?.name}
      userAvatar={me?.icon_img}
      onLogout={isAuthenticated ? logout : undefined}
      entitlement={entitlement}
      isAdmin={isAdmin}
      pageTitle="Admin Panel"
      showBackButton
      onBack={() => router.push('/')}
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
  if (isLoading) {
    return (
      <>
        {header}
        <div className="min-h-viewport bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </>
    );
  }

  // Password login form (shown when not authenticated as admin)
  if (showPasswordLogin) {
    return (
      <>
        <Head>
          <title>Admin Login - Reddit Multi Poster</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <div className="min-h-viewport bg-background flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center">
                <Lock className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-semibold text-foreground">Admin Access</h1>
                <p className="text-sm text-muted-foreground mt-1">Enter the admin password to continue</p>
              </div>
            </div>

            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="relative">
                <Input
                  ref={(el) => { el?.focus(); }}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Admin password"
                  className="pr-10"
                  disabled={isSubmittingPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {passwordError && (
                <p className="text-sm text-red-400 text-center">{passwordError}</p>
              )}

              <Button
                type="submit"
                className="w-full cursor-pointer"
                disabled={!password || isSubmittingPassword}
              >
                {isSubmittingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Access Admin Panel'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Error state
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
