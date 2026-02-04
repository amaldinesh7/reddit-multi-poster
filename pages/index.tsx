import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import * as Sentry from '@sentry/nextjs';
import MediaUpload from '../components/MediaUpload';
import SubredditFlairPicker from '../components/SubredditFlairPicker';
import PostComposer from '../components/PostComposer';
import PostingQueue from '../components/PostingQueue';
import { AppLoader } from '@/components/ui/loader';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/layout';
import { useHomePageState } from '@/hooks/useHomePageState';

interface MeResponse {
  authenticated: boolean;
  me?: { name: string; icon_img?: string; id?: string };
  subs?: string[];
  userId?: string;
}

import { PwaOnboarding } from '@/components/PwaOnboarding';


export default function Home() {
  const router = useRouter();
  const [auth, setAuth] = React.useState<MeResponse>({ authenticated: false });
  const [loading, setLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);

  const {
    selectedSubs,
    setSelectedSubs,
    caption,
    setCaption,
    body,
    setBody,
    prefixes,
    setPrefixes,
    mediaUrl,
    setMediaUrl,
    mediaFiles,
    setMediaFiles,
    mediaMode,
    setMediaMode,
    flairs,
    setFlairs,
    titleSuffixes,
    setTitleSuffixes,
    postToProfile,
    setPostToProfile,
    hasFlairErrors,
    showValidationErrors,
    items,
    handleValidationChange,
    handlePostAttempt,
    handleUnselectSuccessItems,
  } = useHomePageState({ authMe: auth.me });

  React.useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get<MeResponse>('/api/me');
        setAuth(data);

        // Redirect to login if not authenticated
        if (!data.authenticated) {
          router.replace('/login');
          return;
        }

        // Set Sentry user context for better error tracking
        if (data.me) {
          Sentry.setUser({
            id: data.me.id || data.userId,
            username: data.me.name,
          });
        }
        
        // Check admin status (non-blocking)
        try {
          const adminRes = await axios.get<{ isAdmin: boolean }>('/api/admin-check');
          setIsAdmin(adminRes.data.isAdmin);
        } catch {
          // Ignore admin check failures
        }
      } catch {
        setAuth({ authenticated: false });
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const handleLogout = async () => {
    await axios.post('/api/auth/logout');
    // Clear Sentry user context on logout
    Sentry.setUser(null);
    router.replace('/login');
  };

  return (
    <>
      <Head>
        <title>Reddit Multi Poster - Post to Multiple Subreddits</title>
        <meta name="description" content="Effortlessly post content to multiple subreddits at once. Manage your Reddit marketing, schedule posts, and save time with Reddit Multi Poster." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://reddit-multi-poster.vercel.app/" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://reddit-multi-poster.vercel.app/" />
        <meta property="og:title" content="Reddit Multi Poster - Post to Multiple Subreddits" />
        <meta property="og:description" content="Effortlessly post content to multiple subreddits at once. Manage your Reddit marketing, schedule posts, and save time with Reddit Multi Poster." />
        <meta property="og:image" content="https://reddit-multi-poster.vercel.app/og-image.png" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://reddit-multi-poster.vercel.app/" />
        <meta property="twitter:title" content="Reddit Multi Poster - Post to Multiple Subreddits" />
        <meta property="twitter:description" content="Effortlessly post content to multiple subreddits at once. Manage your Reddit marketing, schedule posts, and save time with Reddit Multi Poster." />
        <meta property="twitter:image" content="https://reddit-multi-poster.vercel.app/og-image.png" />
      </Head>

      {loading ? (
        <AppLoader />
      ) : (
        <div className="min-h-screen bg-background">
          {/* Header */}
          <AppHeader
            userName={auth.me?.name}
            userAvatar={auth.me?.icon_img}
            onLogout={handleLogout}
            isAdmin={isAdmin}
          />

          <PwaOnboarding />

          {/* Main Content */}
          <main className="container mx-auto px-4 py-4 lg:py-6 max-w-2xl lg:max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-x-6 items-start">

              {/* Left Column: Create Post */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold hidden lg:block lg:mb-2">Create Post</h2>

                {/* Media Section */}
                <section>
                  {/* Desktop: Card wrapper */}
                  <div className="hidden lg:block rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Media</h3>
                      <div className="flex rounded-md border border-border overflow-hidden">
                        <button
                          onClick={() => setMediaMode('file')}
                          className={`px-3 py-1 text-sm font-medium transition-colors cursor-pointer ${mediaMode === 'file'
                            ? 'bg-primary text-white'
                            : 'bg-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          aria-pressed={mediaMode === 'file'}
                          aria-label="Upload file"
                        >
                          Upload
                        </button>
                        <button
                          onClick={() => setMediaMode('url')}
                          className={`px-3 py-1 text-sm font-medium transition-colors cursor-pointer ${mediaMode === 'url'
                            ? 'bg-primary text-white'
                            : 'bg-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          aria-pressed={mediaMode === 'url'}
                          aria-label="Enter URL"
                        >
                          URL
                        </button>
                      </div>
                    </div>
                    <MediaUpload onUrl={setMediaUrl} onFile={setMediaFiles} mode={mediaMode} />
                  </div>

                  {/* Mobile: No card wrapper */}
                  <div className="lg:hidden">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold">Media</h3>
                      <div className="flex rounded-md border border-border overflow-hidden">
                        <button
                          onClick={() => setMediaMode('file')}
                          className={`px-3 py-1 text-sm font-medium transition-colors cursor-pointer ${mediaMode === 'file'
                            ? 'bg-primary text-white'
                            : 'bg-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          aria-pressed={mediaMode === 'file'}
                          aria-label="Upload file"
                        >
                          Upload
                        </button>
                        <button
                          onClick={() => setMediaMode('url')}
                          className={`px-3 py-1 text-sm font-medium transition-colors cursor-pointer ${mediaMode === 'url'
                            ? 'bg-primary text-white'
                            : 'bg-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          aria-pressed={mediaMode === 'url'}
                          aria-label="Enter URL"
                        >
                          URL
                        </button>
                      </div>
                    </div>
                    <MediaUpload onUrl={setMediaUrl} onFile={setMediaFiles} mode={mediaMode} />
                  </div>
                </section>

                {/* Title Section */}
                <section>
                  {/* Desktop: Card wrapper */}
                  <div className="hidden lg:block rounded-lg border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Title</h3>
                    <PostComposer
                      value={caption}
                      onChange={setCaption}
                      body={body}
                      onBodyChange={setBody}
                      prefixes={prefixes}
                      onPrefixesChange={setPrefixes}
                    />
                  </div>

                  {/* Mobile: No card wrapper */}
                  <div className="lg:hidden">
                    <h3 className="text-base font-semibold mb-3">Title</h3>
                    <PostComposer
                      value={caption}
                      onChange={setCaption}
                      body={body}
                      onBodyChange={setBody}
                      prefixes={prefixes}
                      onPrefixesChange={setPrefixes}
                    />
                  </div>
                </section>
              </div>

              {/* Right Column: Communities & Queue */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold hidden lg:block lg:mb-2">Subreddits & Queue</h2>

                {/* Communities Section */}
                <section>
                  {/* Desktop: Card wrapper */}
                  <div className="hidden lg:block rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-semibold">Subreddits</h3>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => router.push('/settings')}
                        className="h-8 px-2 text-xs font-medium cursor-pointer"
                        aria-label="Manage communities and flairs"
                      >
                        Manage
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <SubredditFlairPicker
                        selected={selectedSubs}
                        onSelectedChange={setSelectedSubs}
                        flairValue={flairs}
                        onFlairChange={setFlairs}
                        titleSuffixValue={titleSuffixes}
                        onTitleSuffixChange={setTitleSuffixes}
                        onValidationChange={handleValidationChange}
                        showValidationErrors={showValidationErrors}
                      />

                      {/* Post to Profile */}
                      {auth.authenticated && auth.me?.name && (
                        <div className="flex items-center gap-2 pt-3 border-t border-border">
                          <Checkbox
                            id="post-to-profile-desktop"
                            checked={postToProfile}
                            onCheckedChange={(checked) => setPostToProfile(checked === true)}
                          />
                          <label
                            htmlFor="post-to-profile-desktop"
                            className="text-sm cursor-pointer"
                          >
                            Also post to my profile (u/{auth.me.name})
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile: No card wrapper */}
                  <div className="lg:hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-base font-semibold">Subreddits</h3>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => router.push('/settings')}
                        className="h-8 px-2 text-xs font-medium cursor-pointer"
                        aria-label="Manage communities and flairs"
                      >
                        Manage
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <SubredditFlairPicker
                        selected={selectedSubs}
                        onSelectedChange={setSelectedSubs}
                        flairValue={flairs}
                        onFlairChange={setFlairs}
                        titleSuffixValue={titleSuffixes}
                        onTitleSuffixChange={setTitleSuffixes}
                        onValidationChange={handleValidationChange}
                        showValidationErrors={showValidationErrors}
                      />

                      {/* Post to Profile */}
                      {auth.authenticated && auth.me?.name && (
                        <div className="flex items-center gap-2 pt-3 border-t border-border">
                          <Checkbox
                            id="post-to-profile-mobile"
                            checked={postToProfile}
                            onCheckedChange={(checked) => setPostToProfile(checked === true)}
                          />
                          <label
                            htmlFor="post-to-profile-mobile"
                            className="text-sm cursor-pointer"
                          >
                            Also post to my profile (u/{auth.me.name})
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Queue Section */}
                <section>
                  {/* Desktop: Card wrapper */}
                  <div className="hidden lg:block rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-semibold">Posting Queue</h3>
                      {items.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                          {items.length}
                        </span>
                      )}
                    </div>
                    <PostingQueue
                      items={items}
                      caption={caption}
                      prefixes={prefixes}
                      hasFlairErrors={hasFlairErrors}
                      onPostAttempt={handlePostAttempt}
                      onUnselectSuccessItems={handleUnselectSuccessItems}
                    />
                  </div>

                  {/* Mobile: No card wrapper */}
                  <div className="lg:hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-base font-semibold">Posting Queue</h3>
                      {items.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                          {items.length}
                        </span>
                      )}
                    </div>
                    <PostingQueue
                      items={items}
                      caption={caption}
                      prefixes={prefixes}
                      hasFlairErrors={hasFlairErrors}
                      onPostAttempt={handlePostAttempt}
                      onUnselectSuccessItems={handleUnselectSuccessItems}
                    />
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
      )}
    </>
  );
}
