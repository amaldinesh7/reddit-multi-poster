import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface SubredditData {
  subreddit: string;
  count: number;
  successRate: number;
}

interface SubredditChartProps {
  data: SubredditData[];
  className?: string;
}

const SubredditChart: React.FC<SubredditChartProps> = ({ data, className = '' }) => {
  // Custom tooltip
  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ payload: SubredditData }>;
  }) => {
    if (!active || !payload || !payload[0]) return null;

    const item = payload[0].payload;
    
    return (
      <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
        <p className="text-sm font-medium mb-2">r/{item.subreddit}</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Posts: </span>
            <span className="font-medium">{item.count}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Success: </span>
            <span className="font-medium">{item.successRate}%</span>
          </div>
        </div>
      </div>
    );
  };

  // Get color based on success rate
  const getBarColor = (successRate: number) => {
    if (successRate >= 90) return '#10b981'; // emerald
    if (successRate >= 70) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <div className={`rounded-xl border border-border/50 bg-card p-5 ${className}`}>
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Top Subreddits
      </h3>
      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No data yet
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="subreddit"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
                width={100}
                tickFormatter={(value) => `r/${value.length > 12 ? value.slice(0, 12) + '...' : value}`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.successRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.length > 0 && (
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>≥90%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>70-89%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>&lt;70%</span>
          </div>
          <span className="ml-auto">Success Rate</span>
        </div>
      )}
    </div>
  );
};

export default SubredditChart;
