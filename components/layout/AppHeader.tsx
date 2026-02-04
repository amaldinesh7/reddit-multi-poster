import React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ChevronDown, User, Settings, LogOut, BarChart3 } from 'lucide-react';

interface AppHeaderProps {
  userName?: string;
  userAvatar?: string;
  onLogout: () => void;
  isAdmin?: boolean;
  entitlement?: 'free' | 'paid';
  onUpgrade?: () => void;
  upgradeLoading?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  userName,
  userAvatar,
  onLogout,
  isAdmin = false,
  entitlement,
  onUpgrade,
  upgradeLoading = false,
}) => {
  const showUpgrade = entitlement !== 'paid' && onUpgrade;
  const handleViewProfile = () => {
    window.open(`https://reddit.com/user/${userName}`, '_blank');
  };

  const handleSettings = () => {
    window.location.href = '/settings';
  };

  const handleAnalytics = () => {
    window.location.href = '/analytics';
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
              <img src="/logo.png" alt="Reddit Multi Poster" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold">Multi Poster</span>
          </div>


          <div className="flex items-center gap-2">
            {showUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                disabled={upgradeLoading}
                className="text-sm text-violet-500 hover:text-violet-400 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-2 py-1 font-medium border border-violet-500/30 hover:border-violet-400/50 transition-colors"
                aria-label="Get lifetime access"
              >
                {upgradeLoading ? 'Taking you to checkout…' : 'Get lifetime access'}
              </button>
            )}
            <DropdownMenu
            trigger={
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-secondary transition-colors cursor-pointer"
                aria-label="User menu"
              >
                <Avatar
                  src={userAvatar}
                  alt={userName || 'User'}
                  fallback={userName || 'U'}
                  size="sm"
                />
                <span className="text-sm font-medium hidden sm:inline">
                  u/{userName}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
            }
          >
            <DropdownMenuItem onClick={handleViewProfile}>
              <User className="h-4 w-4 mr-2" aria-hidden="true" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSettings}>
              <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
              Settings
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={handleAnalytics}>
                <BarChart3 className="h-4 w-4 mr-2" aria-hidden="true" />
                Analytics
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onLogout} className="text-red-400">
              <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
              Logout
            </DropdownMenuItem>
          </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
