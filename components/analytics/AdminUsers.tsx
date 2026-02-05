import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, Loader2, RefreshCw, Check } from 'lucide-react';

interface User {
  id: string;
  reddit_username: string;
  reddit_avatar_url: string | null;
  entitlement: 'free' | 'paid';
  paid_at: string | null;
  created_at: string;
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleEntitlement = async (user: User) => {
    const newEntitlement = user.entitlement === 'paid' ? 'free' : 'paid';
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
      setUsers(prev => prev.map(u => 
        u.id === user.id 
          ? { ...u, entitlement: data.user.entitlement, paid_at: data.user.paid_at }
          : u
      ));
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchUsers} className="cursor-pointer">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const paidCount = users.filter(u => u.entitlement === 'paid').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            User Management
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {users.length} users total, {paidCount} paid
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={fetchUsers}
          className="cursor-pointer"
          aria-label="Refresh users"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {users.map(user => (
            <div 
              key={user.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  src={user.reddit_avatar_url || undefined}
                  alt={user.reddit_username}
                  fallback={user.reddit_username}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">u/{user.reddit_username}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {formatDate(user.created_at)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {user.entitlement === 'paid' ? (
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 gap-1">
                    <Crown className="w-3 h-3" />
                    Pro
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-muted-foreground">
                    Free
                  </Badge>
                )}
                
                <Button
                  variant={user.entitlement === 'paid' ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => handleToggleEntitlement(user)}
                  disabled={updatingUserId === user.id}
                  className={`cursor-pointer text-xs h-8 px-3 ${
                    user.entitlement === 'free' 
                      ? 'bg-violet-600 hover:bg-violet-700 text-white' 
                      : ''
                  }`}
                >
                  {updatingUserId === user.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : user.entitlement === 'paid' ? (
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
          
          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No users found
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
