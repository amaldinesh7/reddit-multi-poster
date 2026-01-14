import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import MediaUpload from '../components/MediaUpload';
import SubredditFlairPicker from '../components/SubredditFlairPicker';
import PostComposer from '../components/PostComposer';
import PostingQueue from '../components/PostingQueue';
import { AppLoader } from '@/components/ui/loader';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
    router.replace('/login');
  };

  return (
    <>
      <Head>
        <title>Reddit Multi Poster</title>
        <meta name="description" content="Post to multiple subreddits simultaneously" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
          />

          <PwaOnboarding />

          {/* Main Content */}
          <main className="container mx-auto px-4 py-6 max-w-2xl lg:max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

              {/* Left Column: Create Post */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold hidden lg:block mb-2">Create Post</h2>

                {/* Media Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle>Media</CardTitle>
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
                  </CardHeader>
                  <CardContent>
                    <MediaUpload onUrl={setMediaUrl} onFile={setMediaFiles} mode={mediaMode} />
                  </CardContent>
                </Card>

                {/* Title Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Title</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PostComposer
                      value={caption}
                      onChange={setCaption}
                      body={body}
                      onBodyChange={setBody}
                      prefixes={prefixes}
                      onPrefixesChange={setPrefixes}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Communities & Queue */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold hidden lg:block mb-2">Subreddits & Queue</h2>

                {/* Communities Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle>Subreddits</CardTitle>
                      {/* 
                          NOTE: The "Manage" button is required to allow users to navigate to the 
                          Settings page where they can organize their subreddits into categories,
                          reorder them, and fetch the latest flair data from Reddit.
                          Without this, users would have to manually find the settings link in the 
                          user menu, which is less discoverable.
                      */}
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
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                          id="post-to-profile"
                          checked={postToProfile}
                          onCheckedChange={(checked) => setPostToProfile(checked === true)}
                        />
                        <label
                          htmlFor="post-to-profile"
                          className="text-sm cursor-pointer"
                        >
                          Also post to my profile (u/{auth.me.name})
                        </label>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Queue Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle>Posting Queue</CardTitle>
                      {items.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                          {items.length}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <PostingQueue
                      items={items}
                      caption={caption}
                      prefixes={prefixes}
                      hasFlairErrors={hasFlairErrors}
                      onPostAttempt={handlePostAttempt}
                      onUnselectSuccessItems={handleUnselectSuccessItems}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      )}
    </>
  );
}
