import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Bug } from 'lucide-react';
import { AppHeader } from '@/components/layout';

/**
 * Help & Feedback page — placeholder for now.
 * Only accessible to admin users.
 */
const HelpPage: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading, me, logout, entitlement } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!me?.name) return;
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/admin-check');
        if (res.ok) {
          const data: unknown = await res.json();
          // Runtime type validation
          if (
            typeof data === 'object' &&
            data !== null &&
            'isAdmin' in data &&
            typeof (data as { isAdmin: unknown }).isAdmin === 'boolean'
          ) {
            setIsAdmin((data as { isAdmin: boolean }).isAdmin);
          } else {
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setAdminCheckDone(true);
      }
    };
    checkAdmin();
  }, [me?.name]);

  // Redirect non-admins away
  useEffect(() => {
    if (adminCheckDone && !isAdmin) {
      router.replace('/');
    }
  }, [adminCheckDone, isAdmin, router]);

  if (isLoading || !adminCheckDone || !isAdmin) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Help & Feedback | Poststation</title>
      </Head>
      <div className="min-h-viewport bg-background safe-bottom flex flex-col">
        {isAuthenticated && (
          <AppHeader
            userName={me?.name}
            userAvatar={me?.icon_img}
            onLogout={logout}
            entitlement={entitlement}
            isAdmin={isAdmin}
            pageTitle="Help & Feedback"
            showBackButton
          />
        )}
        <div className="app-container max-w-2xl py-8">

          <div className="space-y-4">
            {/* Placeholder cards */}
            <div className="rounded-xl border border-border/50 bg-card p-5">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold">Send Feedback</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Have a suggestion or general feedback? This feature is coming soon.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card p-5">
              <div className="flex items-start gap-3">
                <Bug className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold">Report a Bug</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Found something broken? Bug reporting is coming soon.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HelpPage;
