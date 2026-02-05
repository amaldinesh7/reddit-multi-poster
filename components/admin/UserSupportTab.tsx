import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  BookOpen,
  Bug,
  Settings,
} from 'lucide-react';

// Quick action buttons for common support tasks
const quickActions = [
  {
    id: 'docs',
    label: 'Documentation',
    icon: BookOpen,
    href: '/docs',
    description: 'View setup guides',
  },
  {
    id: 'bugs',
    label: 'Known Issues',
    icon: Bug,
    href: 'https://github.com/issues',
    description: 'Check bug tracker',
    external: true,
  },
  {
    id: 'settings',
    label: 'System Settings',
    icon: Settings,
    href: '/settings',
    description: 'Configure app',
  },
];

// Placeholder support stats
const supportStats = [
  { label: 'Open Tickets', value: 0, icon: MessageSquare, color: 'text-cyan-400' },
  { label: 'Pending Review', value: 0, icon: Clock, color: 'text-amber-400' },
  { label: 'Resolved Today', value: 0, icon: CheckCircle, color: 'text-emerald-400' },
  { label: 'Critical Issues', value: 0, icon: AlertTriangle, color: 'text-red-400' },
];

// Common issues shortcuts
const commonIssues = [
  {
    id: 'auth',
    title: 'Authentication Issues',
    description: 'Reddit OAuth errors, token expiration',
    count: 0,
  },
  {
    id: 'posting',
    title: 'Posting Failures',
    description: 'Rate limits, subreddit restrictions',
    count: 0,
  },
  {
    id: 'media',
    title: 'Media Upload Problems',
    description: 'Image/video processing errors',
    count: 0,
  },
  {
    id: 'flairs',
    title: 'Flair Selection',
    description: 'Missing or invalid flairs',
    count: 0,
  },
];

export const UserSupportTab: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Support Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {supportStats.map((stat, index) => (
          <Card 
            key={stat.label} 
            className="border-border/50 bg-card/50 backdrop-blur-sm"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-secondary/50 ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono-admin tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-display">
              <Zap className="w-4 h-4 text-amber-400" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => (
              <Button
                key={action.id}
                variant="ghost"
                className="w-full justify-start h-auto py-3 px-4 hover:bg-secondary/50 cursor-pointer"
                asChild
              >
                <a
                  href={action.href}
                  target={action.external ? '_blank' : undefined}
                  rel={action.external ? 'noopener noreferrer' : undefined}
                >
                  <action.icon className="w-4 h-4 mr-3 text-muted-foreground" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  {action.external && (
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  )}
                </a>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Common Issues */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-display">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              Common Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {commonIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{issue.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {issue.description}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 font-mono-admin">
                  {issue.count}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Support Activity Placeholder */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            Recent Support Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold font-display mb-2">All Clear!</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              No pending support tickets. Your users are happy!
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Support ticket system coming soon. For now, users can reach out via GitHub issues.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
