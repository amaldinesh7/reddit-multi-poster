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
import { Info, ChevronDown, User, Settings, LogOut } from 'lucide-react';

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
        <title>Reddit Multi Poster - Post to Multiple Subreddits Simultaneously | Content Creator Tool</title>
        <meta name="description" content="Streamline your Reddit marketing with our powerful multi-posting tool. Post to multiple subreddits simultaneously with custom flairs, smart scheduling, and rule compliance. Perfect for content creators, marketers, and Reddit power users." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* SEO Keywords */}
        <meta name="keywords" content="reddit multi poster, post to multiple subreddits, reddit automation, reddit marketing tool, subreddit posting, reddit content creator, reddit bulk posting, reddit scheduler, reddit flair management, reddit communities, social media automation, reddit growth tool, content distribution, reddit cross-posting, subreddit manager" />
        <meta name="author" content="Reddit Multi Poster Team" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="language" content="English" />
        <meta name="revisit-after" content="7 days" />
        
        {/* Canonical URL */}
        <link rel="canonical" href="https://reddit-multi-poster.vercel.app/" />
        
        {/* Open Graph Meta Tags */}
        <meta property="og:title" content="Reddit Multi Poster - Post to Multiple Subreddits Simultaneously" />
        <meta property="og:description" content="Streamline your Reddit marketing with our powerful multi-posting tool. Post to multiple subreddits with custom flairs, smart scheduling, and automatic rule compliance." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://reddit-multi-poster.vercel.app/" />
        <meta property="og:image" content="https://reddit-multi-poster.vercel.app/android-chrome-512x512.png" />
        <meta property="og:image:alt" content="Reddit Multi Poster - Bulk posting tool for Reddit communities" />
        <meta property="og:site_name" content="Reddit Multi Poster" />
        <meta property="og:locale" content="en_US" />
        
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Reddit Multi Poster - Post to Multiple Subreddits Simultaneously" />
        <meta name="twitter:description" content="Streamline your Reddit marketing with smart multi-posting, custom flairs, and rule compliance. Perfect for content creators and marketers." />
        <meta name="twitter:image" content="https://reddit-multi-poster.vercel.app/android-chrome-512x512.png" />
        <meta name="twitter:image:alt" content="Reddit Multi Poster tool interface" />
        <meta name="twitter:creator" content="@reddit_multi_poster" />
        <meta name="twitter:site" content="@reddit_multi_poster" />
        
        {/* Additional SEO Meta Tags */}
        <meta name="application-name" content="Reddit Multi Poster" />
        <meta name="apple-mobile-web-app-title" content="Reddit Multi Poster" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#FF4500" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Schema.org JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Reddit Multi Poster",
              "description": "A powerful tool for content creators to post to multiple Reddit communities simultaneously with smart scheduling and flair management.",
              "url": "https://reddit-multi-poster.vercel.app/",
              "applicationCategory": "Social Media Management",
              "operatingSystem": "Web Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "creator": {
                "@type": "Organization",
                "name": "Reddit Multi Poster Team"
              },
              "featureList": [
                "Multi-subreddit posting",
                "Custom flair management",
                "Smart scheduling",
                "Rule compliance checking",
                "Bulk content distribution",
                "Reddit OAuth integration"
              ],
              "screenshot": "https://reddit-multi-poster.vercel.app/android-chrome-512x512.png"
            })
          }}
        />
      </Head>
      {loading ? (
        <AppLoader />
      ) : (
        <div className="min-h-screen bg-background">
        <header className="border-b bg-card/95 backdrop-blur sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#FF4500"/>
                  <circle cx="12" cy="12" r="8" fill="#FFFFFF"/>
                  <circle cx="9" cy="10" r="1.5" fill="#FF4500"/>
                  <circle cx="15" cy="10" r="1.5" fill="#FF4500"/>
                  <path d="M8 14c0 2.21 1.79 4 4 4s4-1.79 4-4" stroke="#FF4500" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <h1 className="text-lg sm:text-xl font-medium">Multi Poster</h1>
              </div>
              {auth.authenticated ? (
                <DropdownMenu
                  trigger={
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded-full px-3 py-1.5 transition-colors">
                      <Avatar
                        src={auth.me?.icon_img}
                        alt={auth.me?.name || 'User'}
                        fallback={auth.me?.name || 'U'}
                        size="sm"
                      />
                      <span className="text-sm font-medium hidden sm:inline">u/{auth.me?.name}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:inline" />
                    </div>
                  }
                >
                  <div className="px-4 py-2 border-b sm:hidden">
                    <p className="text-sm font-medium">u/{auth.me?.name}</p>
                  </div>
                  <DropdownMenuItem onClick={() => window.open(`https://reddit.com/user/${auth.me?.name}`, '_blank')} className="hover:bg-orange-50 hover:text-orange-700">
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      View Profile
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = '/settings'} className="hover:bg-orange-50 hover:text-orange-700">
                    <div className="flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-destructive hover:bg-red-50 hover:text-red-700">
                    <div className="flex items-center">
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </div>
                  </DropdownMenuItem>
                </DropdownMenu>
              ) : (
                <Button onClick={login} className="rounded-full">Login with Reddit</Button>
              )}
            </div>
          </div>
        </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-8 max-w-4xl">
        {/* Media */}
        <Card className="rounded-lg border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="pb-4 px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-lg font-medium">📎 Media</CardTitle>
              <div className="flex rounded-lg border bg-muted p-1 w-full sm:w-auto">
                <Button
                  variant={mediaMode === 'file' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMediaMode('file')}
                  className={`rounded-md text-xs px-3 sm:px-4 py-1.5 h-7 flex-1 sm:flex-none ${mediaMode === 'file' ? 'bg-primary hover:bg-primary/90' : 'hover:bg-secondary hover:text-secondary-foreground'}`}
                >
                  Upload File
                </Button>
                <Button
                  variant={mediaMode === 'url' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMediaMode('url')}
                  className={`rounded-md text-xs px-3 sm:px-4 py-1.5 h-7 flex-1 sm:flex-none ${mediaMode === 'url' ? 'bg-primary hover:bg-primary/90' : 'hover:bg-secondary hover:text-secondary-foreground'}`}
                >
                  URL Link
                </Button>
              </div>
            </div>
          </CardHeader>
          {/* <CardContent className="px-6 pb-6"> */}
          {/* <div className="px-6 pb-6"> */}
          <MediaUpload onUrl={setMediaUrl} onFile={setMediaFiles} mode={mediaMode} />
          {/* </div> */}
            
          {/* </CardContent> */}
        </Card>

        {/* Subreddits + Flair */}
        <Card className="rounded-lg border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="pb-4 px-6">
            <CardTitle className="text-lg font-medium">🎯 Communities & Flairs</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <SubredditFlairPicker
              selected={selectedSubs}
              onSelectedChange={setSelectedSubs}
              flairValue={flairs}
              onFlairChange={setFlairs}
            />
          </CardContent>
        </Card>

        {/* Caption */}
        <Card className="rounded-lg border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="pb-4 px-6">
            <CardTitle className="text-lg font-medium">✏️ Caption</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <PostComposer value={caption} onChange={setCaption} prefixes={prefixes} onPrefixesChange={setPrefixes} />
          </CardContent>
        </Card>

        {/* Queue */}
        <Card className="rounded-lg border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="pb-4 px-6">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-medium">🚀 Posting Queue</CardTitle>
              <div className="relative group">
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-sm rounded-lg border shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  Posts will be submitted with random delays between 1-10 seconds
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <PostingQueue items={items} caption={caption} prefixes={prefixes} />
          </CardContent>
        </Card>
              </main>

        <footer className="py-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-muted/20 rounded-full text-xs text-muted-foreground hover:bg-muted/30 transition-all duration-300 hover:scale-105 group">
              <span className="text-red-500 animate-pulse" style={{animationDuration: '2s'}}>♥</span>
              <span className="font-medium group-hover:text-red-600 transition-colors duration-300">Crafted with Love</span>
              
              <span className="w-1 h-1 bg-muted-foreground/40 rounded-full animate-pulse"></span>
              
              <span className="text-muted-foreground/60">Built using</span>
              <div className="inline-flex items-center gap-1 ml-1 text-xs">
                <a 
                  href="https://cursor.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                >
                  Cursor
                </a>
                <span className="text-muted-foreground/40">+</span>
                <a 
                  href="https://openai.com/chatgpt" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                >
                  ChatGPT
                </a>
                <span className="text-muted-foreground/40">+</span>
                <a 
                  href="https://claude.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                >
                  Claude
                </a>
              </div>
            </div>
          </div>
        </footer>
        
          </div>
        )}
    </>
  );
}
