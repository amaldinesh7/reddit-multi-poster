import React from 'react';
import { BarChart3, CheckCircle2, XCircle, Users } from 'lucide-react';
import {
  StatsCard,
  PostsChart,
  SubredditChart,
  RecentPostsTable,
} from '@/components/analytics';
import { TopPostersLeaderboard } from './TopPostersLeaderboard';

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

interface AnalyticsTabProps {
  data: AnalyticsData;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ data }) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Posts"
          value={data.totalPosts.toLocaleString()}
          subtitle={`${data.postsLast7Days} this week`}
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <StatsCard
          title="Success Rate"
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

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <PostsChart data={data.postsByDay} />
        <SubredditChart data={data.topSubreddits} />
      </div>

      {/* Top Posters Leaderboard */}
      <TopPostersLeaderboard data={data.topPosters} />

      {/* Recent Posts Table */}
      <RecentPostsTable data={data.recentPosts} />

      {/* Privacy Notice */}
      <div className="text-center text-xs text-muted-foreground py-4 border-t border-border/30">
        <p>
          Privacy: Only post metadata is tracked. No images, videos, or user content is stored.
        </p>
      </div>
    </div>
  );
};
