import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Loader2, Search, FolderPlus, Sparkles, RefreshCw, GripVertical } from 'lucide-react';
import { useSubreddits } from '../hooks/useSubreddits';
import { useSubredditCache } from '../hooks/useSubredditCache';
import { useAuth } from '../hooks/useAuth';
import { useSettingsDnd } from '../hooks/useSettingsDnd';

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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
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
      const response = await axios.get('/api/search-subreddits', {
        params: { q: searchQuery.trim(), limit: 5 }
      });
      setSearchResults(response.data.subreddits || []);
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
    const result = await addSubreddit(categoryId, subredditName);
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

  // Show loading state
  if (authLoading || !isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsContext.Provider value={{ 
      addSubreddit, 
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
          <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="flex h-16 items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/')}
                  className="p-2 rounded-lg hover:bg-secondary cursor-pointer"
                  aria-label="Go back to home"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold">Settings</h1>
                    <p className="text-xs text-muted-foreground hidden sm:block">Manage your subreddits</p>
                  </div>
                </div>
                
                {/* Refresh button */}
                <div className="ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refresh()}
                    disabled={isLoading}
                    className="p-2 cursor-pointer"
                    aria-label="Refresh categories"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 sm:px-6 py-6 max-w-3xl">
            <div className="space-y-6">
              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleAddCategory}
                  className="flex-1 sm:flex-none rounded-xl h-10 cursor-pointer"
                  aria-label="Add new category"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              </div>

              {/* Search */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    placeholder="Search Reddit for subreddits..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-secondary/30 border-border/50"
                    aria-label="Search subreddits"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" aria-label="Searching" />
                  )}
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
                      />
                    ))}
                    
                    {data.categories.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <FolderPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-sm">No categories yet.</p>
                        <p className="text-xs mt-1">Create your first category above.</p>
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
      </>
    </SettingsContext.Provider>
  );
}
