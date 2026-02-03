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

          {/* User Menu */}
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
