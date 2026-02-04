import React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ChevronDown, User, Settings, LogOut, BarChart3, Sun, Moon, Monitor } from 'lucide-react';
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
  const { setTheme, resolvedTheme } = useTheme();
  const showUpgrade = entitlement !== 'paid' && onUpgrade;

  const handleThemeSelect = (next: Theme) => () => setTheme(next);

  const ThemeIcon = resolvedTheme === 'dark' ? Moon : Sun;
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
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md hover:bg-secondary transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                  aria-label="Theme"
                >
                  <ThemeIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              }
            >
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
            </DropdownMenu>
            {showUpgrade && (
              <button
                type="button"
                onClick={onUpgrade}
                disabled={upgradeLoading}
                className="shrink-0 text-xs sm:text-sm text-violet-500 hover:text-violet-400 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-2 py-2 sm:py-1 font-medium border border-violet-500/30 hover:border-violet-400/50 transition-colors min-h-[44px] sm:min-h-0"
                aria-label="Get lifetime access"
              >
                <span className="hidden sm:inline">{upgradeLoading ? 'Opening checkout…' : 'Get lifetime access'}</span>
                <span className="sm:hidden">{upgradeLoading ? '…' : 'Upgrade'}</span>
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
