import React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ChevronDown, User, Settings, LogOut, Shield, Sun, Moon, Monitor, Infinity } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/contexts/ThemeContext';

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
  const { setTheme } = useTheme();
  const showUpgrade = entitlement !== 'paid' && onUpgrade;

  const handleThemeSelect = (next: Theme) => () => setTheme(next);

  const handleViewProfile = () => {
    window.open(`https://reddit.com/user/${userName}`, '_blank');
  };

  const handleSettings = () => {
    window.location.href = '/settings';
  };

  const handleAdminPanel = () => {
    window.location.href = '/admin';
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-14 min-h-[44px] items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg flex items-center justify-center">
              <img src="/logo.png" alt="Reddit Multi Poster" className="h-full w-full object-contain" />
            </div>
            <span className="truncate font-semibold">Multi Poster</span>
          </div>

          <div className="flex min-w-0 shrink items-center gap-1.5 sm:gap-2">
            {showUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                disabled={upgradeLoading}
                className="shrink-0 flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-3 py-1.5 sm:py-1 font-semibold transition-all bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/25 hover:shadow-violet-500/40 hover:from-violet-500 hover:to-purple-500 sm:bg-none sm:from-transparent sm:to-transparent sm:shadow-none sm:text-violet-500 sm:hover:text-violet-400 sm:border sm:border-violet-500/30 sm:hover:border-violet-400/50 sm:font-medium"
                aria-label="Get lifetime access"
              >
                <Infinity className="h-4 w-4 sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">{upgradeLoading ? 'Opening checkout…' : 'Get lifetime access'}</span>
                <span className="sm:hidden">{upgradeLoading ? '…' : 'Go Unlimited'}</span>
              </button>
            )}
            <DropdownMenu
            trigger={
              <button
                className="flex min-h-[44px] min-w-[44px] sm:min-w-0 items-center justify-center gap-2 rounded-md px-3 py-1.5 hover:bg-secondary transition-colors cursor-pointer"
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
            {/* Theme options */}
            <DropdownMenuItem onClick={handleThemeSelect('light')}>
              <Sun className="h-4 w-4 mr-2" aria-hidden="true" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleThemeSelect('dark')}>
              <Moon className="h-4 w-4 mr-2" aria-hidden="true" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleThemeSelect('system')}>
              <Monitor className="h-4 w-4 mr-2" aria-hidden="true" />
              System
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* User actions */}
            <DropdownMenuItem onClick={handleViewProfile}>
              <User className="h-4 w-4 mr-2" aria-hidden="true" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSettings}>
              <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
              Settings
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={handleAdminPanel}>
                <Shield className="h-4 w-4 mr-2" aria-hidden="true" />
                Admin Panel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
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
