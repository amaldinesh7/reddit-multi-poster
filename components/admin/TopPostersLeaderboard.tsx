import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';

interface TopPoster {
  userId: string;
  username: string;
  avatarUrl: string | null;
  postCount: number;
  successCount: number;
  successRate: number;
}

interface TopPostersLeaderboardProps {
  data: TopPoster[];
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="w-5 h-5 text-amber-400" />;
    case 2:
      return <Medal className="w-5 h-5 text-slate-300" />;
    case 3:
      return <Award className="w-5 h-5 text-amber-600" />;
    default:
      return (
        <span className="w-5 h-5 flex items-center justify-center text-xs font-mono-admin text-muted-foreground">
          {rank}
        </span>
      );
  }
};

const getSuccessRateColor = (rate: number) => {
  if (rate >= 90) return 'text-emerald-400';
  if (rate >= 70) return 'text-amber-400';
  return 'text-red-400';
};

export const TopPostersLeaderboard: React.FC<TopPostersLeaderboardProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Top Posters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            No posting activity yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/30">
        <CardTitle className="flex items-center gap-2 text-base font-display">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          Top Posters
          <Badge variant="secondary" className="ml-auto text-xs font-mono-admin">
            {data.length} users
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/30">
          {data.map((poster, index) => (
            <div
              key={poster.userId}
              className={`flex items-center gap-3 p-3 transition-colors hover:bg-secondary/30 ${
                index < 3 ? 'bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent' : ''
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Rank */}
              <div className="w-8 flex items-center justify-center shrink-0">
                {getRankIcon(index + 1)}
              </div>

              {/* Avatar */}
              <Avatar
                src={poster.avatarUrl || undefined}
                alt={poster.username}
                fallback={poster.username}
                size="sm"
                className={index === 0 ? 'ring-2 ring-amber-400/50' : ''}
              />

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  u/{poster.username}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className={getSuccessRateColor(poster.successRate)}>
                    {poster.successRate}% success
                  </span>
                </p>
              </div>

              {/* Post Count */}
              <div className="text-right shrink-0">
                <p className="text-lg font-bold font-mono-admin tabular-nums">
                  {poster.postCount}
                </p>
                <p className="text-xs text-muted-foreground">posts</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
