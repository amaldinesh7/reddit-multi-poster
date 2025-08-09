import React from 'react';
import Head from 'next/head';
import axios from 'axios';
import MediaUpload from '../components/MediaUpload';
import SubredditFlairPicker from '../components/SubredditFlairPicker';
import PostComposer from '../components/PostComposer';
import PostingQueue from '../components/PostingQueue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLoader } from '@/components/ui/loader';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { QueueItem } from '@/types';

interface MeResponse {
  authenticated: boolean;
  me?: { name: string; icon_img?: string };
  subs?: string[];
}



export default function Home() {
  const [auth, setAuth] = React.useState<MeResponse>({ authenticated: false });
  const [loading, setLoading] = React.useState(true);
  const [selectedSubs, setSelectedSubs] = React.useState<string[]>([]);
  const [caption, setCaption] = React.useState('');
  const [prefixes, setPrefixes] = React.useState({ f: false, c: false });
  const [mediaUrl, setMediaUrl] = React.useState<string>('');
  const [mediaFiles, setMediaFiles] = React.useState<File[]>([]);
  const [mediaMode, setMediaMode] = React.useState<'file' | 'url'>('file');
  const [flairs, setFlairs] = React.useState<Record<string, string | undefined>>({});


  React.useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get<MeResponse>('/api/me');
        setAuth(data);
      } catch {
        setAuth({ authenticated: false });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);





  const login = () => { window.location.href = '/api/auth/login'; };
  const logout = async () => { await axios.post('/api/auth/logout'); location.reload(); };

  const items = React.useMemo(() => {
    const allItems: QueueItem[] = [];
    
    if (mediaFiles.length > 0) {
      // File uploads - create one post per subreddit with all files
      selectedSubs.forEach((sr) => {
        // Determine post type based on number of files and file type
        let kind: 'image' | 'video' | 'gallery';
        if (mediaFiles.length > 1) {
          // Multiple files = gallery post
          kind = 'gallery';
        } else {
          // Single file = image or video
          kind = mediaFiles[0].type.startsWith('video/') ? 'video' : 'image';
        }
        
        allItems.push({
          subreddit: sr,
          flairId: flairs[sr],
          kind,
          files: mediaFiles, // Use files array for all cases
          url: undefined,
          text: undefined,
        });
      });
    } else if (mediaUrl) {
      // URL post - single post to each subreddit
      selectedSubs.forEach((sr) => {
        allItems.push({
          subreddit: sr,
          flairId: flairs[sr],
          kind: 'link',
          url: mediaUrl,
          file: undefined,
          text: undefined,
        });
      });
    } else {
      // Text post - single post to each subreddit
      selectedSubs.forEach((sr) => {
        allItems.push({
          subreddit: sr,
          flairId: flairs[sr],
          kind: 'self',
          url: undefined,
          file: undefined,
          text: caption,
        });
      });
    }
    
    return allItems;
  }, [selectedSubs, flairs, mediaUrl, mediaFiles, caption]);

  return (
    <>
      <Head>
        <title>Reddit Multi-Poster</title>
        <meta name="description" content="Post to multiple Reddit communities at once with smart scheduling" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {loading ? (
        <AppLoader />
      ) : (
        <div className="min-h-screen">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg sm:text-xl font-semibold">Reddit Multi-Poster</h1>
              {auth.authenticated ? (
                <DropdownMenu
                  trigger={
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded-md p-1 transition-colors">
                      <Avatar
                        src={auth.me?.icon_img}
                        alt={auth.me?.name || 'User'}
                        fallback={auth.me?.name || 'U'}
                        size="sm"
                      />
                      <span className="text-sm text-muted-foreground hidden sm:inline">u/{auth.me?.name}</span>
                    </div>
                  }
                >
                  <div className="px-4 py-2 border-b sm:hidden">
                    <p className="text-sm font-medium">u/{auth.me?.name}</p>
                  </div>
                  <DropdownMenuItem onClick={() => window.open(`https://reddit.com/user/${auth.me?.name}`, '_blank')}>
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    Logout
                  </DropdownMenuItem>
                </DropdownMenu>
              ) : (
                <Button onClick={login}>Login with Reddit</Button>
              )}
            </div>
          </div>
        </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-8 max-w-4xl">
        {/* Media */}
        <Card className="border-0 sm:border shadow-sm sm:shadow-md">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle>Media</CardTitle>
              <div className="flex rounded-lg border">
                <Button
                  variant={mediaMode === 'file' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMediaMode('file')}
                  className="rounded-r-none text-xs px-3 py-1 h-8"
                >
                  Upload File
                </Button>
                <Button
                  variant={mediaMode === 'url' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMediaMode('url')}
                  className="rounded-l-none border-l text-xs px-3 py-1 h-8"
                >
                  URL Link
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6">
                            <MediaUpload onUrl={setMediaUrl} onFile={setMediaFiles} mode={mediaMode} />
          </CardContent>
        </Card>

        {/* Subreddits + Flair */}
        <Card className="border-0 sm:border shadow-sm sm:shadow-md">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle>Subreddits & Flairs</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6">
                            <SubredditFlairPicker
                  selected={selectedSubs}
                  onSelectedChange={setSelectedSubs}
                  flairValue={flairs}
                  onFlairChange={setFlairs}
                />
          </CardContent>
        </Card>

        {/* Caption */}
        <Card className="border-0 sm:border shadow-sm sm:shadow-md">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle>Caption</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6">
            <PostComposer value={caption} onChange={setCaption} prefixes={prefixes} onPrefixesChange={setPrefixes} />
          </CardContent>
        </Card>

        {/* Queue */}
        <Card className="border-0 sm:border shadow-sm sm:shadow-md">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle>Queue</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6">
            <PostingQueue items={items} caption={caption} prefixes={prefixes} />
            <p className="text-sm text-muted-foreground mt-4">Posts will be submitted immediately.</p>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t py-6 sm:py-8 mt-auto">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-muted-foreground">Built with ❤️ by developers who love automation</p>
        </div>
      </footer>
        </div>
      )}
    </>
  );
}
