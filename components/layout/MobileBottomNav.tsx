import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { LogOut, ExternalLink, Shield } from 'lucide-react';
import { House, GearSix, Question, UserCircle } from 'phosphor-react';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

/** Pages where the bottom nav should NOT appear */
const HIDDEN_ROUTES = ['/login', '/privacy', '/terms', '/checkout/success'];

/** Check if a route should hide the bottom nav */
const shouldHideNav = (pathname: string): boolean =>
  HIDDEN_ROUTES.includes(pathname) || pathname.startsWith('/api/');

interface NavTab {
  id: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  href?: string;
  action?: () => void;
  /** Match these pathnames to mark tab as active */
  matchPaths: string[];
  /** If true, only shown for admins */
  adminOnly?: boolean;
}

/**
 * Mobile bottom navigation bar.
 * Shown only below the `md` breakpoint. Provides native app-like tab navigation.
 */
const MobileBottomNav: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading, me, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  // Determine admin status from a simple check (matches index.tsx pattern)
  const [isAdmin, setIsAdmin] = useState(false);
  React.useEffect(() => {
    if (!me?.name) return;
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/admin-check');
        if (res.ok) {
          const data: unknown = await res.json();
          // Only show admin menu if user is admin by Reddit username (not password)
          if (
            typeof data === 'object' &&
            data !== null &&
            'isAdminByUsername' in data &&
            (data as { isAdminByUsername: unknown }).isAdminByUsername === true
          ) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } catch {
        // silently fail
      }
    };
    checkAdmin();
  }, [me?.name]);

  // Don't render on unauthenticated or loading states, or on excluded routes
  if (!isAuthenticated || isLoading || shouldHideNav(router.pathname)) {
    return null;
  }

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
  };

  const handleViewProfile = () => {
    setProfileOpen(false);
    if (!me?.name) return;
    window.open(
      `https://reddit.com/user/${me.name}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const tabs: NavTab[] = [
    {
      id: 'post',
      label: 'Post',
      icon: (active) => (
        <House
          size={20}
          weight={active ? "fill" : "regular"}
          className={cn(active ? "text-foreground" : "text-muted-foreground")}
        />
      ),
      href: '/',
      matchPaths: ['/'],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (active) => (
        <GearSix
          size={20}
          weight={active ? "fill" : "regular"}
          className={cn(active ? "text-foreground" : "text-muted-foreground")}
        />
      ),
      href: '/settings',
      matchPaths: ['/settings'],
    },
    {
      id: 'help',
      label: 'Help',
      icon: (active) => (
        <Question
          size={20}
          weight={active ? "fill" : "regular"}
          className={cn(active ? "text-foreground" : "text-muted-foreground")}
        />
      ),
      href: '/help',
      matchPaths: ['/help'],
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (active) =>
        me?.icon_img ? (
          <Avatar
            src={me.icon_img}
            alt={me.name}
            fallback={me.name || 'U'}
            className={cn(
              "w-5 h-5 transition-colors duration-200",
              active ? "ring-2 ring-foreground/60" : "ring-0"
            )}
          />
        ) : (
          <UserCircle
            size={20}
            weight={active ? "fill" : "regular"}
            className={cn(active ? "text-foreground" : "text-muted-foreground")}
          />
        ),
      action: () => setProfileOpen((prev) => !prev),
      matchPaths: [],
    },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  const isActive = (tab: NavTab): boolean =>
    tab.matchPaths.includes(router.pathname);

  const railClassName =
    "bg-background shadow-[0_-8px_30px_-24px_rgba(0,0,0,0.45)]";
  const rowClassName = "flex items-stretch justify-around h-14";
  const getButtonClassName = (active: boolean) =>
    cn(
      "flex-1 flex flex-col items-center justify-center gap-0.5 relative",
      "cursor-pointer select-none transition-all duration-200",
      "active:scale-95 active:opacity-80",
      active ? "text-foreground" : "text-muted-foreground"
    );
  const getIconWrapClassName = (active: boolean) =>
    cn(
      "rounded-lg p-1.5 transition-colors duration-200"
    );
  const getLabelClassName = (active: boolean) =>
    cn(
      "text-[10px] font-medium leading-none",
      active ? "text-foreground" : "text-muted-foreground"
    );

  return (
    <>
      {/* Bottom navigation bar */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden mobile-bottom-nav",
          "bg-background",
          "pb-[env(safe-area-inset-bottom)]"
        )}
        aria-label="Main navigation"
      >
        <div className={cn(railClassName, "px-1")}>
          <div className={rowClassName}>
          {visibleTabs.map((tab) => {
            const active = isActive(tab) || (tab.id === 'profile' && profileOpen);

            // Action-only tabs (e.g. profile toggle) stay as buttons
            if (tab.action) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={tab.action}
                  className={getButtonClassName(active)}
                  aria-label={tab.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={getIconWrapClassName(active)}>{tab.icon(active)}</span>
                  <span className={getLabelClassName(active)}>{tab.label}</span>
                </button>
              );
            }

            // Navigation tabs use anchor tags for full page loads
            // (avoiding client-side routing issues with stale service worker caches)
            return (
              <a
                key={tab.id}
                href={tab.href ?? '/'}
                className={getButtonClassName(active)}
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
              >
                <span className={getIconWrapClassName(active)}>{tab.icon(active)}</span>
                <span className={getLabelClassName(active)}>{tab.label}</span>
              </a>
            );
          })}
          </div>
        </div>
      </nav>

      {/* Profile bottom sheet */}
      {profileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-[2px] md:hidden animate-in fade-in duration-200 cursor-pointer"
            onClick={() => setProfileOpen(false)}
            aria-hidden="true"
          />
          {/* Sheet */}
          <div
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[120] md:hidden",
              "bg-background rounded-t-2xl",
              "border-t border-border/50",
              "pb-[env(safe-area-inset-bottom)]",
              "animate-in slide-in-from-bottom duration-200"
            )}
            role="dialog"
            aria-label="Profile menu"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="px-5 pb-5 space-y-1">
              {/* User info */}
              <div className="flex items-center gap-3 py-3">
                <Avatar
                  src={me?.icon_img}
                  alt={me?.name || 'User'}
                  fallback={me?.name || 'U'}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">u/{me?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(me?.total_karma ?? 0).toLocaleString()} karma
                  </p>
                </div>
              </div>

              <div className="h-px bg-border/50 my-1" />

              {/* View Reddit Profile */}
              <button
                type="button"
                onClick={handleViewProfile}
                className="flex items-center gap-3 w-full py-3 px-1 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer active:opacity-70"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                View Reddit Profile
              </button>

              {/* Admin Panel - Only for admins */}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 w-full py-3 px-1 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer active:opacity-70"
                >
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  Admin Panel
                </Link>
              )}

              {/* Logout */}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 w-full py-3 px-1 rounded-lg text-sm font-medium text-red-400 hover:bg-secondary transition-colors cursor-pointer active:opacity-70"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="flex items-center justify-center w-full py-3 mt-1 rounded-lg text-sm font-medium text-muted-foreground bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer active:opacity-70"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileBottomNav;
