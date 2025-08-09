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

// Curated list from user
const CURATED_SUBS = [
  'IndianHotwife',
  'indiansgetlaid',
  'DesiNSFWSubs',
  'Bangaloresluts', // normalized from BangaloreSluts
  'DesiStree', // normalized from Desistree
  'DesiSlutGW',
  'DesiGW',
  'KeralaGW', // normalized from Kerala GW
  'Bangalorecouples',
  'DelhiGone_Wild',
  'KochiNSFW',
  'MalayaliGoneWild', // kept as provided
  'IndianHornyPeople', // normalized case
  'mumbaiGWild',
  'bengali_gone_wild', // kept as provided
  'desiSlimnStacked', // normalized from desi slimnstacked
  'TamilGW', // normalized case
  'PuneGW',
  'BangaloreGWild', // corrected from BangalorGWild
  'DesiWhoreWife',
  'DesiExhibitionistGW',
  'ExhibitionistHotWife',
  'ExhibitionistFun',
  'HotwifeIndia',
  'indian_exhibitionism',
  'blouseless_saree',
];

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
  const [customSubs, setCustomSubs] = React.useState<string[]>([]);
  const [newSub, setNewSub] = React.useState('');
  const [source, setSource] = React.useState<'curated' | 'all'>('curated');

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

  const options = React.useMemo(() => {
    // Preserve curated order first, then append custom, then Reddit subs not in curated/custom
    const base = source === 'curated' ? CURATED_SUBS : CURATED_SUBS;
    const custom = customSubs.filter(s => !base.includes(s));
    const rest = (auth.subs || []).filter(s => !base.includes(s) && !custom.includes(s));
    return [...base, ...custom, ...(source === 'all' ? rest : [])];
  }, [auth.subs, customSubs, source]);

  const addCustomSub = () => {
    const name = newSub.trim().replace(/^r\//i, '');
    if (!name) return;
    setCustomSubs((prev) => prev.includes(name) ? prev : [...prev, name]);
    setNewSub('');
  };

  const login = () => { window.location.href = '/api/auth/login'; };
  const logout = async () => { await axios.post('/api/auth/logout'); location.reload(); };

  const items = React.useMemo(() => {
    const allItems: QueueItem[] = [];
    
    if (mediaFiles.length > 0) {
      // File uploads - create separate posts for each file to each subreddit
      mediaFiles.forEach((file) => {
        const kind: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
        selectedSubs.forEach((sr) => {
          allItems.push({
            subreddit: sr,
            flairId: flairs[sr],
            kind,
            file,
            url: undefined,
            text: undefined,
          });
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

  if (loading) {
    return (
      <>
        <Head>
          <title>Reddit Multi-Poster</title>
          <meta name="description" content="Post to multiple Reddit communities at once with smart scheduling" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <AppLoader />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Reddit Multi-Poster</title>
        <meta name="description" content="Post to multiple Reddit communities at once with smart scheduling" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">Reddit Multi-Poster</h1>
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
                      <span className="text-sm text-muted-foreground">u/{auth.me?.name}</span>
                    </div>
                  }
                >
                  <DropdownMenuItem onClick={() => window.open(`https://reddit.com/user/${auth.me?.name}`, '_blank')}>
                    View Profile
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

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Media */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
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
          <CardContent>
                            <MediaUpload onUrl={setMediaUrl} onFile={setMediaFiles} mode={mediaMode} />
          </CardContent>
        </Card>

        {/* Subreddits + Flair */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Subreddits & Flairs</CardTitle>
              <div className="flex rounded-lg border">
                <Button
                  variant={source === 'curated' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSource('curated')}
                  className="rounded-r-none"
                >
                  My List
                </Button>
                <Button
                  variant={source === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSource('all')}
                  className="rounded-l-none border-l"
                >
                  All (+ Reddit)
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SubredditFlairPicker
              options={options}
              selected={selectedSubs}
              onSelectedChange={setSelectedSubs}
              flairValue={flairs}
              onFlairChange={setFlairs}
              newSub={newSub}
              setNewSub={setNewSub}
              addCustomSub={addCustomSub}
            />
          </CardContent>
        </Card>

        {/* Caption */}
        <Card>
          <CardHeader>
            <CardTitle>Caption</CardTitle>
          </CardHeader>
          <CardContent>
            <PostComposer value={caption} onChange={setCaption} prefixes={prefixes} onPrefixesChange={setPrefixes} />
          </CardContent>
        </Card>

        {/* Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <PostingQueue items={items} caption={caption} prefixes={prefixes} />
            <p className="text-sm text-muted-foreground mt-4">Posts will be submitted immediately.</p>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">Built with ❤️ by developers who love automation</p>
        </div>
      </footer>
      </div>
    </>
  );
}
