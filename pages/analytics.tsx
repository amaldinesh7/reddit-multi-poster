import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Redirect from /analytics to /admin for backward compatibility.
 * The analytics functionality has been moved to the Admin Panel.
 */
export default function AnalyticsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin#analytics');
  }, [router]);

  return (
    <div className="min-h-viewport bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to Admin Panel...</p>
    </div>
  );
}
