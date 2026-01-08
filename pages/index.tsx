import React from 'react';
import Head from 'next/head';
import axios from 'axios';
import MediaUpload from '../components/MediaUpload';
import SubredditFlairPicker from '../components/SubredditFlairPicker';
import PostComposer from '../components/PostComposer';
import PostingQueue from '../components/PostingQueue';
import { Button } from '@/components/ui/button';
import { AppLoader } from '@/components/ui/loader';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChevronDown, User, Settings, LogOut } from 'lucide-react';

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
  const [titleSuffixes, setTitleSuffixes] = React.useState<Record<string, string | undefined>>({});
  const [postToProfile, setPostToProfile] = React.useState(false);
  const [hasFlairErrors, setHasFlairErrors] = React.useState(false);
  const [showValidationErrors, setShowValidationErrors] = React.useState(false);

  const handleValidationChange = (hasErrors: boolean) => {
    setHasFlairErrors(hasErrors);
  };

  const handlePostAttempt = () => {
    setShowValidationErrors(true);
  };

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
    
    const destinations = [...selectedSubs];
    if (postToProfile && auth.me?.name) {
      destinations.push(`u_${auth.me.name}`);
    }
    
    if (mediaFiles.length > 0) {
      destinations.forEach((sr) => {
        let kind: 'image' | 'video' | 'gallery';
        if (mediaFiles.length > 1) {
          kind = 'gallery';
        } else {
          kind = mediaFiles[0].type.startsWith('video/') ? 'video' : 'image';
        }
        
        allItems.push({
          subreddit: sr,
          flairId: flairs[sr],
          titleSuffix: titleSuffixes[sr],
          kind,
          files: mediaFiles,
          url: undefined,
          text: undefined,
        });
      });
    } else if (mediaUrl) {
      destinations.forEach((sr) => {
        allItems.push({
          subreddit: sr,
          flairId: flairs[sr],
          titleSuffix: titleSuffixes[sr],
          kind: 'link',
          url: mediaUrl,
          file: undefined,
          text: undefined,
        });
      });
    } else {
      destinations.forEach((sr) => {
        allItems.push({
          subreddit: sr,
          flairId: flairs[sr],
          titleSuffix: titleSuffixes[sr],
          kind: 'self',
          url: undefined,
          file: undefined,
          text: caption,
        });
      });
    }
    
    return allItems;
  }, [selectedSubs, flairs, titleSuffixes, mediaUrl, mediaFiles, caption, postToProfile, auth.me?.name]);

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
          <header className="sticky top-0 z-50 border-b border-border bg-background">
            <div className="container mx-auto px-4">
              <div className="flex h-14 items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-white font-bold text-sm">R</span>
                  </div>
                  <span className="font-semibold">Multi Poster</span>
                </div>
                
                {/* User Menu */}
                {auth.authenticated ? (
                  <DropdownMenu
                    trigger={
                      <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-secondary transition-colors">
                        <Avatar
                          src={auth.me?.icon_img}
                          alt={auth.me?.name || 'User'}
                          fallback={auth.me?.name || 'U'}
                          size="sm"
                        />
                        <span className="text-sm font-medium hidden sm:inline">
                          u/{auth.me?.name}
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </button>
                    }
                  >
                    <DropdownMenuItem onClick={() => window.open(`https://reddit.com/user/${auth.me?.name}`, '_blank')}>
                      <User className="h-4 w-4 mr-2" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout} className="text-red-400">
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenu>
                ) : (
                  <Button onClick={login}>
                    Login with Reddit
                  </Button>
                )}
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 py-6 max-w-2xl">
            <div className="space-y-6">
              
              {/* Media Section */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Media</CardTitle>
                    <div className="flex rounded-md border border-border overflow-hidden">
                      <button
                        onClick={() => setMediaMode('file')}
                        className={`px-3 py-1 text-sm font-medium transition-colors ${
                          mediaMode === 'file' 
                            ? 'bg-primary text-white' 
                            : 'bg-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Upload
                      </button>
                      <button
                        onClick={() => setMediaMode('url')}
                        className={`px-3 py-1 text-sm font-medium transition-colors ${
                          mediaMode === 'url' 
                            ? 'bg-primary text-white' 
                            : 'bg-transparent text-muted-foreground hover:text-foreground'
                        }`}
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

              {/* Communities Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Communities & Flairs</CardTitle>
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
                      <label htmlFor="post-to-profile" className="text-sm cursor-pointer">
                        Also post to my profile (u/{auth.me.name})
                      </label>
                    </div>
                  )}
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
                    prefixes={prefixes} 
                    onPrefixesChange={setPrefixes} 
                  />
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
                  />
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      )}
    </>
  );
}
