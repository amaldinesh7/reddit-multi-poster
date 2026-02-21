import React, { useState } from 'react';
import { ExternalLink, CheckCircle2, XCircle, Image, Link2, FileText, Film, Images, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecentPost {
  id: string;
  subreddit: string;
  postKind: string;
  status: string;
  errorCode: string | null;
  redditUrl: string | null;
  createdAt: string;
}

interface RecentPostsTableProps {
  data: RecentPost[];
  className?: string;
}

type SortField = 'createdAt' | 'subreddit' | 'status';
type SortDirection = 'asc' | 'desc';

interface SortHeaderProps {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
}

const SortHeader = ({ field, sortField, sortDirection, onSort, children }: SortHeaderProps) => (
  <button
    onClick={() => onSort(field)}
    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
    aria-label={`Sort by ${field}`}
  >
    {children}
    {sortField === field && (
      sortDirection === 'asc' ? (
        <ChevronUp className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3" />
      )
    )}
  </button>
);

const RecentPostsTable: React.FC<RecentPostsTableProps> = ({ data, className = '' }) => {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  // Get kind icon
  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'link':
        return <Link2 className="w-4 h-4" />;
      case 'self':
        return <FileText className="w-4 h-4" />;
      case 'video':
        return <Film className="w-4 h-4" />;
      case 'gallery':
        return <Images className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Format error code for display
  const formatErrorCode = (code: string | null) => {
    if (!code) return null;
    return code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort and filter data
  const filteredData = data
    .filter(post => {
      if (filter === 'all') return true;
      return post.status === filter;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'subreddit':
          comparison = a.subreddit.localeCompare(b.subreddit);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  return (
    <div className={`rounded-xl border border-border/50 bg-card ${className}`}>
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            Recent Posts
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
              className="h-7 text-xs cursor-pointer"
            >
              All
            </Button>
            <Button
              variant={filter === 'success' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('success')}
              className="h-7 text-xs cursor-pointer"
            >
              Success
            </Button>
            <Button
              variant={filter === 'error' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('error')}
              className="h-7 text-xs cursor-pointer"
            >
              Failed
            </Button>
          </div>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">
          No posts yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-5 py-3 text-left">
                  <SortHeader field="createdAt" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Date</SortHeader>
                </th>
                <th className="px-5 py-3 text-left">
                  <SortHeader field="subreddit" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Subreddit</SortHeader>
                </th>
                <th className="px-5 py-3 text-left">
                  <span className="text-xs font-medium text-muted-foreground">Type</span>
                </th>
                <th className="px-5 py-3 text-left">
                  <SortHeader field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>Status</SortHeader>
                </th>
                <th className="px-5 py-3 text-left">
                  <span className="text-xs font-medium text-muted-foreground">Link</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-5 py-3">
                    <span className="text-sm text-muted-foreground">
                      {formatDate(post.createdAt)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium">r/{post.subreddit}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground" title={post.postKind}>
                      {getKindIcon(post.postKind)}
                      <span className="text-xs capitalize">{post.postKind}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {post.status === 'success' ? (
                      <div className="flex items-center gap-1.5 text-emerald-500">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-medium">Success</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-500">
                        <XCircle className="w-4 h-4" />
                        <span className="text-xs font-medium" title={post.errorCode || undefined}>
                          {formatErrorCode(post.errorCode) || 'Failed'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {post.redditUrl ? (
                      <a
                        href={post.redditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                        aria-label={`View post on Reddit`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        View
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RecentPostsTable;
