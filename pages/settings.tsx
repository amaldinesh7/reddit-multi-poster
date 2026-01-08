import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Plus, Trash2, GripVertical, Edit2, X, Loader2, Search, Users, ExternalLink, Download, FolderPlus, Sparkles } from 'lucide-react';
import { useSubredditCache } from '../hooks/useSubredditCache';
import { VERIFIED_INDIAN_NSFW_SUBREDDITS, mergeWithExistingSubreddits } from '../constants/subreddits-verified';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SubredditItem {
  id: string;
  name: string;
  displayName?: string;
}

interface Category {
  id: string;
  name: string;
  subreddits: SubredditItem[];
  collapsed?: boolean;
}

interface SubredditData {
  categories: Category[];
}

const DEFAULT_DATA: SubredditData = {
  categories: []
};

// Sortable Category Component
function SortableCategory({ category, isActive }: { category: Category; isActive: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CategoryCard 
        category={category} 
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

// Sortable Subreddit Component
function SortableSubreddit({ 
  subreddit, 
  category, 
  isActive 
}: { 
  subreddit: SubredditItem; 
  category: Category; 
  isActive: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subreddit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SubredditItemComponent 
        subreddit={subreddit}
        category={category}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

// Category Card Component
function CategoryCard({ 
  category, 
  dragHandleProps, 
  isDragging 
}: { 
  category: Category; 
  dragHandleProps: any;
  isDragging: boolean;
}) {
  const [editingCategory, setEditingCategory] = React.useState<string | null>(null);
  const [newSubredditName, setNewSubredditName] = React.useState('');
  const { fetchAndCache } = useSubredditCache();
  const { data, setData } = React.useContext(SettingsContext);

  const updateCategoryName = (categoryId: string, newName: string) => {
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId ? { ...cat, name: newName } : cat
      )
    }));
    setEditingCategory(null);
  };

  const deleteCategory = (categoryId: string) => {
    setData(prev => ({
      categories: prev.categories.filter(cat => cat.id !== categoryId)
    }));
  };

  const toggleCategory = (categoryId: string) => {
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId ? { ...cat, collapsed: !cat.collapsed } : cat
      )
    }));
  };

  const addSubreddit = async (categoryId: string) => {
    if (!newSubredditName.trim()) return;
    
    const subredditName = newSubredditName.trim().replace(/^r\//, '');
    const newSubreddit: SubredditItem = {
      id: Date.now().toString(),
      name: subredditName
    };
    
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, subreddits: [...cat.subreddits, newSubreddit] }
          : cat
      )
    }));
    setNewSubredditName('');
    
    try {
      await fetchAndCache(subredditName);
      console.log(`Cached data for r/${subredditName}`);
    } catch (error) {
      console.error(`Failed to cache data for r/${subredditName}:`, error);
    }
  };

  return (
    <Card className={`glass-card rounded-xl overflow-hidden transition-all duration-200 ${
      isDragging ? 'opacity-50 ring-2 ring-primary/50' : ''
    }`}>
      <CardHeader className="p-4 bg-secondary/20 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div 
            {...dragHandleProps}
            className="cursor-grab hover:text-primary transition-colors"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          
          {editingCategory === category.id ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                defaultValue={category.name}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    updateCategoryName(category.id, (e.target as HTMLInputElement).value);
                  }
                }}
                onBlur={(e) => updateCategoryName(category.id, e.target.value)}
                autoFocus
                className="h-8 bg-secondary/50 border-border/50"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingCategory(null)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <h3
                className="font-medium flex-1 cursor-pointer hover:text-primary transition-colors"
                onClick={() => toggleCategory(category.id)}
              >
                {category.name}
                <span className="text-muted-foreground ml-2 text-sm">
                  ({category.subreddits.length})
                </span>
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingCategory(category.id)}
                  className="h-8 w-8 p-0 hover:bg-secondary"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteCategory(category.id)}
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </CardHeader>

      {!category.collapsed && (
        <CardContent className="p-4 space-y-3">
          {/* Add Subreddit */}
          <div className="flex gap-2">
            <Input
              placeholder="Add subreddit..."
              value={newSubredditName}
              onChange={(e) => setNewSubredditName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addSubreddit(category.id)}
              className="h-9 bg-secondary/30 border-border/50"
            />
            <Button
              size="sm"
              onClick={() => addSubreddit(category.id)}
              disabled={!newSubredditName.trim()}
              className="h-9 px-3"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Subreddits List */}
          <SortableContext 
            items={category.subreddits.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {category.subreddits.map((subreddit) => (
                <SortableSubreddit
                  key={subreddit.id}
                  subreddit={subreddit}
                  category={category}
                  isActive={false}
                />
              ))}
              
              {category.subreddits.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No subreddits yet. Add one above.
                </p>
              )}
            </div>
          </SortableContext>
        </CardContent>
      )}
    </Card>
  );
}

// Subreddit Item Component
function SubredditItemComponent({ 
  subreddit, 
  category, 
  dragHandleProps, 
  isDragging 
}: { 
  subreddit: SubredditItem; 
  category: Category; 
  dragHandleProps: any;
  isDragging: boolean;
}) {
  const [editingSubreddit, setEditingSubreddit] = React.useState<string | null>(null);
  const { loading, errors, removeFromCache } = useSubredditCache();
  const { setData } = React.useContext(SettingsContext);

  const updateSubredditName = (categoryId: string, subredditId: string, newName: string) => {
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? {
              ...cat,
              subreddits: cat.subreddits.map(sub =>
                sub.id === subredditId ? { ...sub, name: newName.replace(/^r\//, '') } : sub
              )
            }
          : cat
      )
    }));
    setEditingSubreddit(null);
  };

  const deleteSubreddit = (categoryId: string, subredditId: string) => {
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, subreddits: cat.subreddits.filter(sub => sub.id !== subredditId) }
          : cat
      )
    }));
    removeFromCache(subreddit.name);
  };

  const isLoading = loading[subreddit.name.toLowerCase()];
  const error = errors[subreddit.name.toLowerCase()];

  return (
    <div className={`
      flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/20 border border-border/30 
      transition-all duration-200 hover:bg-secondary/30
      ${isDragging ? 'opacity-50 ring-2 ring-primary/50' : ''}
    `}>
      <div {...dragHandleProps} className="cursor-grab">
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </div>
      
      {editingSubreddit === subreddit.id ? (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-muted-foreground">r/</span>
          <Input
            defaultValue={subreddit.name}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                updateSubredditName(category.id, subreddit.id, (e.target as HTMLInputElement).value);
              }
            }}
            onBlur={(e) => updateSubredditName(category.id, subreddit.id, e.target.value)}
            autoFocus
            className="h-7 text-xs bg-secondary/50 border-border/50"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingSubreddit(null)}
            className="h-7 w-7 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm">r/{subreddit.name}</span>
            {isLoading && (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            )}
            {error && (
              <span className="text-xs text-red-400" title={error}>⚠️</span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingSubreddit(subreddit.id)}
            className="h-7 w-7 p-0 hover:bg-secondary"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => deleteSubreddit(category.id, subreddit.id)}
            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </>
      )}
    </div>
  );
}

// Create context for data sharing
const SettingsContext = React.createContext<{
  data: SubredditData;
  setData: React.Dispatch<React.SetStateAction<SubredditData>>;
}>({
  data: DEFAULT_DATA,
  setData: () => {},
});

export default function Settings() {
  const router = useRouter();
  const [data, setData] = React.useState<SubredditData>(DEFAULT_DATA);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  
  // Search functionality
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  
  const { fetchAndCache } = useSubredditCache();

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

  // Load data from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem('reddit-multi-poster-subreddits');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData(parsed);
      } catch (e) {
        console.error('Failed to parse stored subreddit data:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save data to localStorage
  React.useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('reddit-multi-poster-subreddits', JSON.stringify(data));
    }
  }, [data, isLoaded]);

  const addCategory = () => {
    const categoryNames = ['General', 'Entertainment', 'Technology', 'Sports', 'News', 'Lifestyle', 'Gaming', 'Science', 'Art', 'Music'];
    const existingNames = data.categories.map(cat => cat.name.toLowerCase());
    const availableNames = categoryNames.filter(name => !existingNames.includes(name.toLowerCase()));
    
    const categoryName = availableNames.length > 0 
      ? availableNames[0] 
      : `Category ${data.categories.length + 1}`;
    
    const newCategory: Category = {
      id: Date.now().toString(),
      name: categoryName,
      subreddits: []
    };
    
    setData(prev => ({
      categories: [...prev.categories, newCategory]
    }));
  };

  const loadVerifiedSubreddits = () => {
    const mergedData = mergeWithExistingSubreddits(data, VERIFIED_INDIAN_NSFW_SUBREDDITS);
    setData(mergedData);
    alert('Successfully loaded verified subreddits!');
  };

  // Handle drag
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeCategory = data.categories.find(cat => cat.id === active.id);
    const activeSubreddit = data.categories.find(cat => 
      cat.subreddits.some(sub => sub.id === active.id)
    )?.subreddits.find(sub => sub.id === active.id);

    if (activeCategory) {
      const overCategory = data.categories.find(cat => cat.id === over.id);
      if (overCategory) {
        setData(prev => {
          const oldIndex = prev.categories.findIndex(cat => cat.id === active.id);
          const newIndex = prev.categories.findIndex(cat => cat.id === over.id);
          return { categories: arrayMove(prev.categories, oldIndex, newIndex) };
        });
      }
    } else if (activeSubreddit) {
      const sourceCategoryId = data.categories.find(cat => 
        cat.subreddits.some(sub => sub.id === active.id)
      )?.id;
      
      const targetCategoryId = data.categories.find(cat => 
        cat.subreddits.some(sub => sub.id === over.id)
      )?.id;

      if (sourceCategoryId && targetCategoryId && sourceCategoryId === targetCategoryId) {
        setData(prev => ({
          categories: prev.categories.map(cat => {
            if (cat.id === sourceCategoryId) {
              const oldIndex = cat.subreddits.findIndex(sub => sub.id === active.id);
              const newIndex = cat.subreddits.findIndex(sub => sub.id === over.id);
              return { ...cat, subreddits: arrayMove(cat.subreddits, oldIndex, newIndex) };
            }
            return cat;
          })
        }));
      }
    }
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
    const newSubreddit: SubredditItem = {
      id: Date.now().toString(),
      name: subredditName
    };
    
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, subreddits: [...cat.subreddits, newSubreddit] }
          : cat
      )
    }));
    
    try {
      await fetchAndCache(subredditName);
    } catch (error) {
      console.error(`Failed to cache data for r/${subredditName}:`, error);
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

  const formatSubscribers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <SettingsContext.Provider value={{ data, setData }}>
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
                  className="p-2 rounded-lg hover:bg-secondary"
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
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 sm:px-6 py-6 max-w-3xl">
            <div className="space-y-6">
              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={loadVerifiedSubreddits} 
                  variant="outline"
                  className="flex-1 sm:flex-none rounded-xl h-10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Load Verified
                </Button>
                <Button 
                  onClick={addCategory}
                  className="flex-1 sm:flex-none rounded-xl h-10"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              </div>

              {/* Search */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Reddit for subreddits..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-secondary/30 border-border/50"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                
                {/* Search Results */}
                {showSearchResults && (
                  <Card className="glass-card rounded-xl overflow-hidden animate-fadeIn">
                    <CardHeader className="p-4 border-b border-border/30 bg-secondary/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Search Results</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowSearchResults(false)}
                          className="h-7 w-7 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 max-h-64 overflow-y-auto">
                      {searchResults.length > 0 ? (
                        <div className="divide-y divide-border/30">
                          {searchResults.map((subreddit) => (
                            <div
                              key={subreddit.name}
                              className="flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">r/{subreddit.name}</span>
                                  {subreddit.over18 && (
                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">18+</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {formatSubscribers(subreddit.subscribers)}
                                  </div>
                                  <a
                                    href={subreddit.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 hover:text-primary hidden sm:flex"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View
                                  </a>
                                </div>
                              </div>
                              
                              {data.categories.length > 0 && (
                                <select
                                  className="text-xs px-2 py-1.5 rounded-lg border border-border/50 bg-secondary/30"
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      addSubredditFromSearch(e.target.value, subreddit.name);
                                      e.target.value = '';
                                    }
                                  }}
                                >
                                  <option value="">Add to...</option>
                                  {data.categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8 text-sm">
                          {searchQuery ? 'No subreddits found' : 'Enter a search term'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* Categories */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
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
                  {activeId ? (
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
