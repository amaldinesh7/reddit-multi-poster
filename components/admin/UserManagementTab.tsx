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
  ChevronDown,
  Timer,
  Clock,
} from 'lucide-react';
import {
  DropdownMenuRoot,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface User {
  id: string;
  reddit_username: string;
  reddit_avatar_url: string | null;
  entitlement: 'free' | 'trial' | 'paid';
  paid_at: string | null;
  created_at: string;
  post_count: number;
  trial_ends_at: string | null;
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

  // Handle entitlement change with confirmation
  const handleSetEntitlement = async (user: User, newEntitlement: 'free' | 'trial' | 'paid') => {
    if (user.entitlement === newEntitlement) return;

    const actionLabels: Record<string, { title: string; message: string; variant: 'default' | 'destructive' }> = {
      'free': {
        title: 'Revoke Pro Access',
        message: `Are you sure you want to revoke Pro access for u/${user.reddit_username}? They will be downgraded to the free tier.`,
        variant: 'destructive',
      },
      'trial': {
        title: 'Start 7-Day Trial',
        message: `Are you sure you want to start a 7-day Pro trial for u/${user.reddit_username}? They will get full Pro access for 7 days.`,
        variant: 'default',
      },
      'paid': {
        title: 'Upgrade to Pro',
        message: `Are you sure you want to upgrade u/${user.reddit_username} to Pro? This will grant them lifetime access to all premium features.`,
        variant: 'default',
      },
    };

    const { title, message, variant } = actionLabels[newEntitlement];
    
    const confirmed = await confirmDialog.openDialog({ title, message, variant });
    if (!confirmed) return;

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
            ? { ...u, entitlement: data.user.entitlement, paid_at: data.user.paid_at, trial_ends_at: data.user.trial_ends_at }
            : u
        )
      );
    } catch (err) {
      console.error('Failed to update user:', err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Handle expire trial for testing
  const handleExpireTrial = async (user: User) => {
    const confirmed = await confirmDialog.openDialog({
      title: 'Expire Trial Now',
      message: `This will immediately expire the trial for u/${user.reddit_username}. They will be downgraded to free on their next page load. Use this for testing only.`,
      variant: 'destructive',
    });

    if (!confirmed) return;

    setUpdatingUserId(user.id);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'expireTrial' }),
      });

      if (!res.ok) throw new Error('Failed to expire trial');

      // Refresh the user list to show updated state
      await fetchUsers();
    } catch (err) {
      console.error('Failed to expire trial:', err);
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

  const getTrialTimeRemaining = (trialEndsAt: string | null): string | null => {
    if (!trialEndsAt) return null;
    const endsAt = new Date(trialEndsAt).getTime();
    const now = Date.now();
    if (endsAt <= now) return 'Expired';

    const diffMs = endsAt - now;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins}m left`;
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

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Status Dropdown - Shows current status and allows changing */}
                      <DropdownMenuRoot>
                        <DropdownMenuTrigger asChild disabled={updatingUserId === user.id}>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`cursor-pointer text-xs h-8 px-3 min-w-[100px] justify-between ${
                              user.entitlement === 'paid'
                                ? 'border-violet-500/50 text-violet-400 bg-violet-500/10'
                                : user.entitlement === 'trial'
                                ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                                : 'border-border/50 text-muted-foreground'
                            }`}
                          >
                            {updatingUserId === user.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                {user.entitlement === 'paid' && <Crown className="w-3 h-3 mr-1.5" />}
                                {user.entitlement === 'trial' && <Timer className="w-3 h-3 mr-1.5" />}
                                {user.entitlement === 'paid' ? 'Pro' : user.entitlement === 'trial' ? (
                                  <span className="flex items-center gap-1">
                                    Trial
                                    <span className="text-[10px] opacity-80">
                                      ({getTrialTimeRemaining(user.trial_ends_at)})
                                    </span>
                                  </span>
                                ) : 'Free'}
                                <ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[160px]">
                          <DropdownMenuItem
                            onClick={() => handleSetEntitlement(user, 'paid')}
                            className={`cursor-pointer ${user.entitlement === 'paid' ? 'bg-violet-500/10' : ''}`}
                          >
                            <Crown className="w-4 h-4 mr-2 text-violet-500" />
                            Pro (Lifetime)
                            {user.entitlement === 'paid' && <Check className="w-3 h-3 ml-auto text-violet-500" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSetEntitlement(user, 'trial')}
                            className={`cursor-pointer ${user.entitlement === 'trial' ? 'bg-amber-500/10' : ''}`}
                          >
                            <Timer className="w-4 h-4 mr-2 text-amber-500" />
                            Trial (7 days)
                            {user.entitlement === 'trial' && <Check className="w-3 h-3 ml-auto text-amber-500" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSetEntitlement(user, 'free')}
                            className={`cursor-pointer ${user.entitlement === 'free' ? 'bg-secondary' : ''}`}
                          >
                            <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                            Free
                            {user.entitlement === 'free' && <Check className="w-3 h-3 ml-auto" />}
                          </DropdownMenuItem>
                          {/* Expire Trial option - only for trial users */}
                          {user.entitlement === 'trial' && (
                            <>
                              <div className="h-px bg-border/50 my-1" />
                              <DropdownMenuItem
                                onClick={() => handleExpireTrial(user)}
                                className="cursor-pointer text-amber-500"
                              >
                                <Clock className="w-4 h-4 mr-2" />
                                Expire Trial (Test)
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenuRoot>
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
        confirmLabel={confirmDialog.variant === 'destructive' ? 'Confirm' : 'Confirm'}
        onConfirm={confirmDialog.handleConfirm}
        onCancel={confirmDialog.handleCancel}
      />
    </>
  );
};
