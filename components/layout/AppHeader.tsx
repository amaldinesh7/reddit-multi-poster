import React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ChevronDown, User, Settings, LogOut } from 'lucide-react';

interface AppHeaderProps {
  userName?: string;
  userAvatar?: string;
  onLogout: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  userName,
  userAvatar,
  onLogout,
}) => {
  const handleViewProfile = () => {
    window.open(`https://reddit.com/user/${userName}`, '_blank');
  };

  const handleSettings = () => {
    window.location.href = '/settings';
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background safe-area-inset-top">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-12 sm:h-14 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden flex items-center justify-center">
              <img src="/logo.png" alt="Reddit Multi Poster" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-sm sm:text-base">Multi Poster</span>
          </div>

          {/* User Menu */}
          <DropdownMenu
            trigger={
              <button
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-md hover:bg-secondary active:bg-secondary transition-colors cursor-pointer tap-highlight-none"
                aria-label="User menu"
              >
                <Avatar
                  src={userAvatar}
                  alt={userName || 'User'}
                  fallback={userName || 'U'}
                  size="sm"
                />
                <span className="text-xs sm:text-sm font-medium hidden sm:inline max-w-[100px] truncate">
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
            <DropdownMenuItem onClick={onLogout} className="text-red-400">
              <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
              Logout
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
