import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import ConfirmDialog, { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Users,
  Crown,
  Loader2,
  RefreshCw,
  Check,
  Search,
  X,
  ArrowUpDown,
  Filter,
  BarChart3,
} from 'lucide-react';

interface User {
  id: string;
  reddit_username: string;
  reddit_avatar_url: string | null;
  entitlement: 'free' | 'trial' | 'paid';
  paid_at: string | null;
  created_at: string;
  post_count: number;
}

type SortField = 'created_at' | 'reddit_username' | 'post_count';
type SortOrder = 'asc' | 'desc';
type EntitlementFilter = 'all' | 'free' | 'trial' | 'paid';

export const UserManagementTab: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entitlementFilter, setEntitlementFilter] = useState<EntitlementFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Confirm dialog
  const confirmDialog = useConfirmDialog();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch users with filters
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (entitlementFilter !== 'all') params.set('entitlement', entitlementFilter);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, entitlementFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle entitlement toggle with confirmation
  const handleToggleEntitlement = async (user: User) => {
    const isUpgrading = user.entitlement === 'free';
    
    const confirmed = await confirmDialog.openDialog({
      title: isUpgrading ? 'Upgrade to Pro' : 'Revoke Pro Access',
      message: isUpgrading
        ? `Are you sure you want to upgrade u/${user.reddit_username} to Pro? This will grant them access to all premium features.`
        : `Are you sure you want to revoke Pro access for u/${user.reddit_username}? They will be downgraded to the free tier.`,
      variant: isUpgrading ? 'default' : 'destructive',
    });

    if (!confirmed) return;

    const newEntitlement = isUpgrading ? 'paid' : 'free';
    setUpdatingUserId(user.id);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, entitlement: newEntitlement }),
      });

      if (!res.ok) throw new Error('Failed to update user');

      const data = await res.json();

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, entitlement: data.user.entitlement, paid_at: data.user.paid_at }
            : u
        )
      );
    } catch (err) {
      console.error('Failed to update user:', err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = users.length;
    const paid = users.filter((u) => u.entitlement === 'paid' || u.entitlement === 'trial').length;
    const free = total - paid;
    const totalPosts = users.reduce((sum, u) => sum + u.post_count, 0);
    return { total, paid, free, totalPosts };
  }, [users]);

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const openUserProfile = (username: string) => {
    const trimmed = username.trim();
    if (!trimmed) return;
    window.open(`https://reddit.com/user/${trimmed}`, '_blank', 'noopener,noreferrer');
  };

  const handleProfileClick = (username: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    openUserProfile(username);
  };

  const handleProfileKeyDown = (username: string) => (event: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openUserProfile(username);
  };

  if (error && !isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Users className="w-4 h-4 text-cyan-400" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-red-400 mb-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              className="cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fadeIn">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono-admin tabular-nums">
                    {stats.total}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono-admin tabular-nums">
                    {stats.paid}
                  </p>
                  <p className="text-xs text-muted-foreground">Pro Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary text-muted-foreground">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono-admin tabular-nums">
                    {stats.free}
                  </p>
                  <p className="text-xs text-muted-foreground">Free Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono-admin tabular-nums">
                    {stats.totalPosts.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Posts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 bg-secondary/30 border-border/50"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Entitlement Filter */}
              <div className="flex gap-2">
                <Button
                  variant={entitlementFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntitlementFilter('all')}
                  className="cursor-pointer"
                >
                  <Filter className="w-3 h-3 mr-1" />
                  All
                </Button>
                <Button
                  variant={entitlementFilter === 'paid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntitlementFilter('paid')}
                  className="cursor-pointer"
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Pro
                </Button>
                <Button
                  variant={entitlementFilter === 'trial' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntitlementFilter('trial')}
                  className="cursor-pointer"
                >
                  Trial
                </Button>
                <Button
                  variant={entitlementFilter === 'free' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntitlementFilter('free')}
                  className="cursor-pointer"
                >
                  Free
                </Button>
              </div>

              {/* Sort Options */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSort('created_at')}
                  className={`cursor-pointer ${sortBy === 'created_at' ? 'bg-secondary' : ''}`}
                >
                  <ArrowUpDown className="w-3 h-3 mr-1" />
                  Date
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSort('post_count')}
                  className={`cursor-pointer ${sortBy === 'post_count' ? 'bg-secondary' : ''}`}
                >
                  <ArrowUpDown className="w-3 h-3 mr-1" />
                  Posts
                </Button>
              </div>

              {/* Refresh */}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchUsers}
                disabled={isLoading}
                className="cursor-pointer shrink-0"
                aria-label="Refresh users"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User List */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3 border-b border-border/30">
            <CardTitle className="flex items-center gap-2 text-base font-display">
              <Users className="w-4 h-4 text-cyan-400" />
              Users
              {isLoading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && users.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {debouncedSearch
                  ? `No users found matching "${debouncedSearch}"`
                  : 'No users found'}
              </div>
            ) : (
              <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
                {users.map((user, index) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/30 transition-colors"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <a
                      href={`https://reddit.com/user/${user.reddit_username}`}
                      target="_blank"
                      rel="noreferrer"
                      tabIndex={0}
                      aria-label={`Open profile for u/${user.reddit_username}`}
                      onClick={handleProfileClick(user.reddit_username)}
                      onKeyDown={handleProfileKeyDown(user.reddit_username)}
                      className="flex items-center gap-3 min-w-0 cursor-pointer hover:underline"
                    >
                      <Avatar
                        src={user.reddit_avatar_url || undefined}
                        alt={user.reddit_username}
                        fallback={user.reddit_username}
                        size="sm"
                        className={user.entitlement === 'paid' || user.entitlement === 'trial' ? 'ring-2 ring-violet-500/50' : ''}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          u/{user.reddit_username}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Joined {formatDate(user.created_at)}</span>
                          <span className="text-border">•</span>
                          <span className="font-mono-admin">{user.post_count} posts</span>
                        </div>
                      </div>
                    </a>

                    <div className="flex items-center gap-3 shrink-0">
                      {user.entitlement === 'paid' || user.entitlement === 'trial' ? (
                        <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 gap-1">
                          <Crown className="w-3 h-3" />
                          {user.entitlement === 'trial' ? 'Trial' : 'Pro'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">
                          Free
                        </Badge>
                      )}

                      <Button
                        variant={user.entitlement === 'paid' || user.entitlement === 'trial' ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleToggleEntitlement(user)}
                        disabled={updatingUserId === user.id}
                        className={`cursor-pointer text-xs h-8 px-3 ${
                          user.entitlement === 'free'
                            ? 'bg-violet-600 hover:bg-violet-700 text-white'
                            : 'hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                        }`}
                      >
                        {updatingUserId === user.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : user.entitlement === 'paid' || user.entitlement === 'trial' ? (
                          'Revoke'
                        ) : (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Set Paid
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.variant === 'destructive' ? 'Revoke Access' : 'Upgrade to Pro'}
        onConfirm={confirmDialog.handleConfirm}
        onCancel={confirmDialog.handleCancel}
      />
    </>
  );
};
