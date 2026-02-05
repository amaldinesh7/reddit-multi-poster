import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Loader2, Search, FolderPlus, RefreshCw, GripVertical, FlaskConical, Crown } from 'lucide-react';
import { useSubreddits } from '../hooks/useSubreddits';
import { useSubredditCache } from '../hooks/useSubredditCache';
import { useAuth } from '../hooks/useAuth';
import { useSettingsDnd } from '../hooks/useSettingsDnd';
import { searchSubreddits as searchSubredditsAPI } from '../lib/api/reddit';
import UpgradeModal from '../components/UpgradeModal';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {
  SettingsContext,
  SortableCategory,
  SearchResults,
} from '../components/settings';

export default function Settings() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, entitlement, limits } = useAuth();
  const {
    data,
    isLoaded,
    isLoading,
    refresh,
    createCategory,
    updateCategory,
    deleteCategory,
    addSubreddit,
    updateSubreddit,
    deleteSubreddit,
    reorderCategories,
    reorderSubreddits,
  } = useSubreddits();
  const { fetchAndCache, loading: cacheLoading, errors: cacheErrors } = useSubredditCache();

  // Search functionality
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<Array<{
    name: string;
    subscribers: number;
    over18: boolean;
    url: string;
  }>>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const [upgradeLoading, setUpgradeLoading] = React.useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const [upgradeModalContext, setUpgradeModalContext] = React.useState<{ title?: string; message: string } | undefined>(undefined);

  // Use limits from auth (for paid users, maxSubreddits is MAX_SAFE_INTEGER)
  const maxSubreddits = limits.maxSubreddits;

  const handleUpgrade = React.useCallback(async () => {
    if (upgradeLoading) return;
    setUpgradeLoading(true);
    try {
      const { data } = await axios.post<{ checkout_url: string }>('/api/checkout/create-session');
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        console.error('Checkout session creation failed: no URL returned');
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      // Keep user on page; they can retry via the modal
    } finally {
      setUpgradeLoading(false);
    }
  }, [upgradeLoading]);

  // DnD handling
  const {
    activeId,
    activeDragData,
    dragOverCategoryId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useSettingsDnd({
    categories: data.categories,
    reorderCategories,
    reorderSubreddits,
    updateSubreddit,
  });

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Calculate current subreddit count
  const currentSubredditCount = data.categories.reduce((sum, c) => sum + c.user_subreddits.length, 0);
  const isAtFreeLimit = entitlement === 'free' && currentSubredditCount >= maxSubreddits;

  // Wrapper for addSubreddit that checks free user limit
  const addSubredditWithLimitCheck = React.useCallback(async (categoryId: string, subredditName: string) => {
    // Check if free user is at limit
    if (entitlement === 'free' && currentSubredditCount >= maxSubreddits) {
      setUpgradeModalContext({
        title: 'Free limit reached',
        message: `Free: save up to ${maxSubreddits} communities. Go Pro to save unlimited.`,
      });
      setShowUpgradeModal(true);
      return null;
    }
    // Otherwise proceed with normal add
    return addSubreddit(categoryId, subredditName);
  }, [entitlement, currentSubredditCount, maxSubreddits, addSubreddit]);

  // DnD Kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddCategory = async () => {
    const categoryNames = ['General', 'Entertainment', 'Technology', 'Sports', 'News', 'Lifestyle', 'Gaming', 'Science', 'Art', 'Music'];
    const existingNames = data.categories.map(cat => cat.name.toLowerCase());
    const availableNames = categoryNames.filter(name => !existingNames.includes(name.toLowerCase()));

    const categoryName = availableNames.length > 0
      ? availableNames[0]
      : `Category ${data.categories.length + 1}`;

    await createCategory(categoryName);
  };

  // Search subreddits
  const searchSubreddits = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    setIsSearching(true);
    try {
      const subreddits = await searchSubredditsAPI(searchQuery.trim(), 5);
      setSearchResults(subreddits);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Add subreddit from search
  const addSubredditFromSearch = async (categoryId: string, subredditName: string) => {
    const result = await addSubredditWithLimitCheck(categoryId, subredditName);
    if (result) {
      try {
        await fetchAndCache(subredditName);
      } catch (error) {
        console.error(`Failed to cache data for r/${subredditName}:`, error);
      }
    }
  };

  // Debounced search
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setShowSearchResults(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchSubreddits();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Dev mode: Load NSFW subreddits
  const [isLoadingDev, setIsLoadingDev] = React.useState(false);
  const isDev = process.env.NODE_ENV === 'development';

  const DEV_NSFW_SUBREDDITS = [
    'indiansgetlaid',
    'DesiNSFWSubs',
    'Bangaloresluts',
    'DesiStree',
    'DesiSlutGW',
    'KeralaGW',
    'Bangalorecouples',
    'DelhiGone_Wild',
    'KochiNSFW',
    'Malayali_GoneWild',
    'IndianHornypeople',
    'mumbaiGWild',
    'BengalisGoneWild',
    'desiSlimnStacked',
    'TamilGW',
    'PuneGW',
    'BangaloreGWild',
    'DesiWhoreWife',
    'DesiExhibitionistGW',
    'hotwifeindia',
  ];

  const handleLoadDevSubreddits = async () => {
    if (!isDev || isLoadingDev) return;

    setIsLoadingDev(true);
    try {
      // Find or create "Dev NSFW" category
      let categoryId = data.categories.find(c => c.name === 'Dev NSFW')?.id;

      if (!categoryId) {
        const newCategory = await createCategory('Dev NSFW');
        if (newCategory) {
          categoryId = newCategory.id;
        }
      }

      if (!categoryId) {
        console.error('Failed to create/find Dev NSFW category');
        return;
      }

      // Get existing subreddits to avoid duplicates
      const existingSubreddits = new Set(
        data.categories.flatMap(c => c.user_subreddits.map(s => s.subreddit_name.toLowerCase()))
      );

      // Add subreddits one by one
      for (const subreddit of DEV_NSFW_SUBREDDITS) {
        if (!existingSubreddits.has(subreddit.toLowerCase())) {
          const result = await addSubreddit(categoryId, subreddit);
          if (result) {
            try {
              await fetchAndCache(subreddit);
            } catch {
              // Ignore cache errors
            }
          }
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Refresh to show all added subreddits
      await refresh();
    } catch (error) {
      console.error('Failed to load dev subreddits:', error);
    } finally {
      setIsLoadingDev(false);
    }
  };

  // Show loading state
  if (authLoading || !isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsContext.Provider value={{
      addSubreddit: addSubredditWithLimitCheck,
      updateCategory,
      deleteCategory,
      updateSubreddit,
      deleteSubreddit,
      fetchAndCache,
      loading: cacheLoading,
      errors: cacheErrors,
      dragOverCategoryId,
    }}>
      <>
        <Head>
          <title>Settings - Reddit Multi Poster</title>
          <meta name="description" content="Manage your subreddit categories and settings" />
          <meta name="robots" content="noindex, nofollow" />
        </Head>

        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="flex h-14 items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/')}
                  className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-secondary cursor-pointer"
                  aria-label="Go back to home"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-semibold">Settings</h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">Your communities and lists</p>
                </div>

                {/* Refresh button */}
                <div className="ml-auto flex items-center gap-3">
                  {/* Only show limit counter for FREE users - paid users have no limit */}
                  {entitlement === 'free' && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {currentSubredditCount} of {maxSubreddits} communities
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refresh()}
                    disabled={isLoading}
                    className="min-h-[44px] min-w-[44px] p-2 cursor-pointer"
                    aria-label="Refresh lists"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-3xl">
            <div className="space-y-6">
              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleAddCategory}
                  className="flex-1 sm:flex-none rounded-xl h-10 cursor-pointer"
                  aria-label="Add new list"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  New list
                </Button>
                {/* Dev-only: Load NSFW subreddits */}
                {isDev && (
                  <Button
                    onClick={handleLoadDevSubreddits}
                    disabled={isLoadingDev}
                    variant="outline"
                    className="flex-1 sm:flex-none rounded-xl h-10 cursor-pointer border-amber-600/50 text-amber-500 hover:bg-amber-600/10"
                    aria-label="Load 20 NSFW subreddits for testing"
                  >
                    {isLoadingDev ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FlaskConical className="w-4 h-4 mr-2" />
                    )}
                    {isLoadingDev ? 'Loading...' : 'Load 20 NSFW (Dev)'}
                  </Button>
                )}
              </div>

              {/* Search */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                  <Input
                    placeholder="Search and add communities"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 h-11 rounded-xl bg-secondary/30 border-border/50"
                    aria-label="Search subreddits"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                    {isSearching && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Searching" />
                    )}
                  </div>
                </div>

                {/* Search Results */}
                {showSearchResults && (
                  <SearchResults
                    searchResults={searchResults}
                    searchQuery={searchQuery}
                    categories={data.categories}
                    onClose={() => setShowSearchResults(false)}
                    onAddSubreddit={addSubredditFromSearch}
                  />
                )}
              </div>

              {/* Subtle upgrade banner when at free limit */}
              {isAtFreeLimit && (
                <button
                  onClick={() => {
                    setUpgradeModalContext(undefined);
                    setShowUpgradeModal(true);
                  }}
                  className="w-full rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 flex items-center justify-between gap-3 hover:bg-violet-500/10 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Crown className="w-4 h-4 text-violet-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">You&apos;ve hit the free limit</p>
                      <p className="text-xs text-muted-foreground">Upgrade to add more</p>
                    </div>
                  </div>
                  <span className="text-xs text-violet-500 font-medium group-hover:underline">
                    Get unlimited lifetime access
                  </span>
                </button>
              )}

              {/* Categories */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={data.categories.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {data.categories.map((category) => (
                      <SortableCategory
                        key={category.id}
                        category={category}
                        isActive={activeId === category.id}
                        canDelete={data.categories.length > 1}
                      />
                    ))}

                    {data.categories.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <FolderPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-sm">No lists yet.</p>
                        <p className="text-xs mt-1">Tap &apos;New list&apos; above to start.</p>
                      </div>
                    )}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activeId && activeDragData?.type === 'subreddit' && activeDragData.subreddit ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 border-2 border-primary shadow-lg">
                      <GripVertical className="w-3 h-3 text-primary" />
                      <span className="text-sm font-medium">r/{activeDragData.subreddit.subreddit_name}</span>
                    </div>
                  ) : activeId ? (
                    <div className="p-4 bg-primary/10 border-2 border-primary border-dashed rounded-xl">
                      Dragging...
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </main>
        </div>

        {/* Upgrade Modal */}
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          onUpgrade={handleUpgrade}
          upgradeLoading={upgradeLoading}
          context={upgradeModalContext}
        />
      </>
    </SettingsContext.Provider>
  );
}
