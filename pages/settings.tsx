import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Plus, Trash2, GripVertical, Edit2, Save, X, Loader2, Search, Users, ExternalLink } from 'lucide-react';
import { useSubredditCache } from '../hooks/useSubredditCache';

// DnD Kit imports
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
  Active,
  Over,
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
      <SubredditItem 
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
  const { fetchAndCache, removeFromCache, loading, errors } = useSubredditCache();

  // Get data and setData from parent context
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
    
    // Add to state first
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, subreddits: [...cat.subreddits, newSubreddit] }
          : cat
      )
    }));
    setNewSubredditName('');
    
    // Fetch and cache subreddit data in the background
    try {
      await fetchAndCache(subredditName);
      console.log(`Cached data for r/${subredditName}`);
    } catch (error) {
      console.error(`Failed to cache data for r/${subredditName}:`, error);
    }
  };

  return (
    <Card
      className={`border transition-all duration-200 ${
        isDragging 
          ? 'opacity-50 border-dashed border-muted-foreground dragging' 
          : 'border-border'
      }`}
    >
      <CardHeader className="pb-2 px-3 pt-3">
        <div className="flex items-center gap-2">
          <GripVertical 
            {...dragHandleProps}
            className={`w-4 h-4 cursor-grab hover:text-foreground transition-colors ${
              isDragging ? 'text-primary' : 'text-muted-foreground'
            }`}
          />
          
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
                className="text-sm sm:text-base font-medium h-8"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingCategory(null)}
                className="h-8 w-8 p-0 shrink-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <>
              <h3
                className="text-sm sm:text-base font-medium flex-1 cursor-pointer min-w-0"
                onClick={() => toggleCategory(category.id)}
              >
                <span className="truncate block">
                  {category.name} <span className="text-muted-foreground">({category.subreddits.length})</span>
                </span>
              </h3>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingCategory(category.id)}
                  className="h-7 w-7 p-0"
                  title="Edit category"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteCategory(category.id)}
                  className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                  title="Delete category"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </>
          )}
        </div>
      </CardHeader>

      {!category.collapsed && (
        <CardContent className="pt-0 px-3 pb-3">
          {/* Add Subreddit */}
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Add subreddit..."
              value={newSubredditName}
              onChange={(e) => setNewSubredditName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addSubreddit(category.id)}
              className="text-xs sm:text-sm h-8"
            />
            <Button
              size="sm"
              onClick={() => addSubreddit(category.id)}
              disabled={!newSubredditName.trim()}
              className="h-8 px-3 shrink-0 font-normal"
            >
              <Plus className="size-3" />
            </Button>
          </div>

          {/* Sortable Subreddits List */}
          <SortableContext 
            items={category.subreddits.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {category.subreddits.map((subreddit) => (
                <SortableSubreddit
                  key={subreddit.id}
                  subreddit={subreddit}
                  category={category}
                  isActive={false}
                />
              ))}
              
              {category.subreddits.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No subreddits in this category yet. Add one above.
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
function SubredditItem({ 
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
  const { data, setData } = React.useContext(SettingsContext);

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
    
    // Remove from cache
    removeFromCache(subreddit.name);
  };

  const isLoading = loading[subreddit.name.toLowerCase()];
  const error = errors[subreddit.name.toLowerCase()];

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 border rounded bg-muted/30 transition-all duration-200 ${
        isDragging 
          ? 'opacity-50 border-dashed border-muted-foreground dragging' 
          : 'border-border'
      }`}
    >
      <GripVertical 
        {...dragHandleProps}
        className={`w-3 h-3 cursor-grab hover:text-foreground transition-colors ${
          isDragging ? 'text-primary' : 'text-muted-foreground'
        }`}
      />
      
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
              className="text-xs h-7"
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
            <span className="text-xs">r/{subreddit.name}</span>
            {isLoading && (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            )}
            {error && (
              <span className="text-xs text-red-500" title={error}>
                ⚠️
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingSubreddit(subreddit.id)}
            className="h-6 w-6 p-0"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => deleteSubreddit(category.id, subreddit.id)}
            className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
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
  
  // Cache management
  const { fetchAndCache, removeFromCache, loading, errors } = useSubredditCache();

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

  // Load data from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem('reddit-multi-poster-subreddits');
    console.log('Settings: Loading from localStorage:', stored);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('Settings: Parsed data:', parsed);
        setData(parsed);
      } catch (e) {
        console.error('Failed to parse stored subreddit data:', e);
      }
    } else {
      console.log('Settings: No stored data found, using default:', DEFAULT_DATA);
    }
    setIsLoaded(true);
  }, []);

  // Save data to localStorage whenever it changes (but only after initial load)
  React.useEffect(() => {
    if (isLoaded) {
      console.log('Settings: Saving to localStorage:', data);
      localStorage.setItem('reddit-multi-poster-subreddits', JSON.stringify(data));
    }
  }, [data, isLoaded]);

  const addCategory = () => {
    // Generate a sample category name
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

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    console.log('🚀 Drag started:', active.id);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    console.log('💧 Drag ended:', { activeId: active.id, overId: over.id });

    // Find which type of item is being dragged
    const activeCategory = data.categories.find(cat => cat.id === active.id);
    const activeSubreddit = data.categories.find(cat => 
      cat.subreddits.some(sub => sub.id === active.id)
    )?.subreddits.find(sub => sub.id === active.id);

    if (activeCategory) {
      // Dragging a category
      const overCategory = data.categories.find(cat => cat.id === over.id);
      if (overCategory) {
        setData(prev => {
          const oldIndex = prev.categories.findIndex(cat => cat.id === active.id);
          const newIndex = prev.categories.findIndex(cat => cat.id === over.id);
          
          console.log('Reordering categories:', { oldIndex, newIndex });
          return {
            categories: arrayMove(prev.categories, oldIndex, newIndex)
          };
        });
      }
    } else if (activeSubreddit) {
      // Dragging a subreddit
      const sourceCategoryId = data.categories.find(cat => 
        cat.subreddits.some(sub => sub.id === active.id)
      )?.id;
      
      const targetCategoryId = data.categories.find(cat => 
        cat.subreddits.some(sub => sub.id === over.id)
      )?.id;

      if (sourceCategoryId && targetCategoryId && sourceCategoryId === targetCategoryId) {
        // Reordering within same category
        setData(prev => ({
          categories: prev.categories.map(cat => {
            if (cat.id === sourceCategoryId) {
              const oldIndex = cat.subreddits.findIndex(sub => sub.id === active.id);
              const newIndex = cat.subreddits.findIndex(sub => sub.id === over.id);
              
              console.log('Reordering subreddits:', { oldIndex, newIndex });
              return {
                ...cat,
                subreddits: arrayMove(cat.subreddits, oldIndex, newIndex)
              };
            }
            return cat;
          })
        }));
      }
    }
  };

  // Search subreddits on Reddit
  const searchSubreddits = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    
    setIsSearching(true);
    try {
      const response = await axios.get('/api/search-subreddits', {
        params: { q: searchQuery.trim(), limit: 4 }
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

  // Add subreddit from search results
  const addSubredditFromSearch = async (categoryId: string, subredditName: string) => {
    const newSubreddit: SubredditItem = {
      id: Date.now().toString(),
      name: subredditName
    };
    
    // Add to state first
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, subreddits: [...cat.subreddits, newSubreddit] }
          : cat
      )
    }));
    
    // Fetch and cache subreddit data in the background
    try {
      await fetchAndCache(subredditName);
      console.log(`Cached data for r/${subredditName}`);
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

  // Format subscriber count
  const formatSubscribers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <SettingsContext.Provider value={{ data, setData }}>
      <>
        <Head>
          <title>Settings - Reddit Multi Poster | Manage Subreddit Categories & Communities</title>
          <meta name="description" content="Customize your Reddit Multi Poster experience. Add, organize, and manage subreddit categories. Search and discover new communities for your content distribution strategy." />
          <meta name="keywords" content="reddit settings, subreddit management, reddit categories, community organization, subreddit search, reddit content strategy" />
          <meta name="robots" content="noindex, nofollow" />
          
          {/* Open Graph */}
          <meta property="og:title" content="Settings - Reddit Multi Poster" />
          <meta property="og:description" content="Customize your Reddit Multi Poster settings and manage subreddit categories." />
          <meta property="og:url" content="https://reddit-multi-poster.vercel.app/settings" />
        </Head>
        
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="sticky top-0 z-50 bg-background border-b border-border">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
                              <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/')}
                    className="p-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <h1 className="text-lg sm:text-xl font-semibold">Settings</h1>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
            <div className="mb-3 sm:mb-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <h2 className="text-base sm:text-lg font-semibold">Manage Subreddits</h2>
                <Button 
                  onClick={addCategory} 
                  size="sm"
                  className="h-7 sm:h-8 px-2 sm:px-3 shrink-0 font-normal"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                  <span className="text-xs sm:text-sm">Add Category</span>
                </Button>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Organize your subreddits into categories and reorder them by dragging.
              </p>
            </div>
            <div className="space-y-3 sm:space-y-4">
                
                {/* Search Subreddits */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search and add subreddits"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 sm:pl-10 text-xs sm:text-sm h-8 sm:h-10"
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-2.5 sm:right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  {/* Search Results */}
                  {showSearchResults && (
                    <Card className="border border-border">
                      <CardHeader className="pb-2 px-3 pt-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs sm:text-sm font-medium">Search Results</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSearchResults(false)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 px-3 pb-3 max-h-48 sm:max-h-56 overflow-y-auto">
                        {searchResults.length > 0 ? (
                                                      <div className="space-y-2">
                              {searchResults.map((subreddit) => (
                                                                <div
                                  key={subreddit.name}
                                  className="flex items-center justify-between p-2 border border-border rounded bg-muted/30"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-xs sm:text-sm">r/{subreddit.name}</span>
                                      {subreddit.over18 && (
                                        <span className="text-xs bg-red-100 text-red-700 px-1 rounded">18+</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs text-muted-foreground">
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
                                    {subreddit.description && (
                                      <p className="text-xs text-muted-foreground mt-1 truncate hidden sm:block">
                                        {subreddit.description}
                                      </p>
                                    )}
                                  </div>
                                  
                                  {/* Add to Category Dropdown */}
                                  {data.categories.length > 0 && (
                                    <div className="ml-2 shrink-0">
                                      <select
                                        className="text-xs px-1.5 sm:px-2 py-1 border border-border rounded bg-background"
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
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-3">
                            {searchQuery ? 'No subreddits found' : 'Enter a search term'}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
                
                {/* Drag and Drop Context */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  {/* Categories List */}
                  <SortableContext 
                    items={data.categories.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3 sm:space-y-4">
                      {data.categories.map((category) => (
                        <SortableCategory
                          key={category.id}
                          category={category}
                          isActive={activeId === category.id}
                        />
                      ))}
                      
                                             {data.categories.length === 0 && (
                        <p className="text-center text-muted-foreground py-6">
                          No categories yet. Create your first category above.
                        </p>
                      )}
                    </div>
                  </SortableContext>

                  {/* Drag Overlay */}
                  <DragOverlay>
                    {activeId ? (
                      <div className="opacity-50">
                        {/* Render dragged item preview here if needed */}
                        <div className="p-4 bg-primary/10 border-2 border-primary border-dashed rounded">
                          Dragging...
                        </div>
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