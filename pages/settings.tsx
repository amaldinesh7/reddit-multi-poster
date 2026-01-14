import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Plus, Trash2, GripVertical, Edit2, X, Loader2, Search, Users, ExternalLink, FolderPlus, Sparkles, RefreshCw } from 'lucide-react';
import { useSubreddits, Category, SubredditItem } from '../hooks/useSubreddits';
import { useSubredditCache } from '../hooks/useSubredditCache';
import { useAuth } from '../hooks/useAuth';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  useDroppable,
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

// Create context for data sharing
const SettingsContext = React.createContext<{
  addSubreddit: (categoryId: string, name: string) => Promise<SubredditItem | null>;
  updateCategory: (categoryId: string, updates: { name?: string; collapsed?: boolean }) => Promise<boolean>;
  deleteCategory: (categoryId: string) => Promise<boolean>;
  updateSubreddit: (subredditId: string, updates: { subreddit_name?: string; category_id?: string }) => Promise<boolean>;
  deleteSubreddit: (subredditId: string) => Promise<boolean>;
  fetchAndCache: (name: string) => Promise<unknown>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  dragOverCategoryId: string | null;
}>({
  addSubreddit: async () => null,
  updateCategory: async () => false,
  deleteCategory: async () => false,
  updateSubreddit: async () => false,
  deleteSubreddit: async () => false,
  fetchAndCache: async () => {},
  loading: {},
  errors: {},
  dragOverCategoryId: null,
});

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
  } = useSortable({ 
    id: subreddit.id,
    data: { 
      type: 'subreddit', 
      subreddit, 
      categoryId: category.id 
    }
  });

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
  dragHandleProps: Record<string, unknown>;
  isDragging: boolean;
}) {
  const [editingCategory, setEditingCategory] = React.useState(false);
  const [newSubredditName, setNewSubredditName] = React.useState('');
  const [isAddingSubreddit, setIsAddingSubreddit] = React.useState(false);
  const { addSubreddit, updateCategory, deleteCategory, fetchAndCache, dragOverCategoryId } = React.useContext(SettingsContext);
  
  // Make category a drop zone for subreddits
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `category-drop-${category.id}`,
    data: { type: 'category', categoryId: category.id }
  });
  
  const isDropTarget = dragOverCategoryId === category.id || isOver;

  const handleUpdateCategoryName = async (newName: string) => {
    if (newName.trim() && newName !== category.name) {
      await updateCategory(category.id, { name: newName.trim() });
    }
    setEditingCategory(false);
  };

  const handleDeleteCategory = async () => {
    if (confirm(`Delete category "${category.name}" and all its subreddits?`)) {
      await deleteCategory(category.id);
    }
  };

  const handleToggleCategory = async () => {
    await updateCategory(category.id, { collapsed: !category.collapsed });
  };

  const handleAddSubreddit = async () => {
    if (!newSubredditName.trim()) return;
    
    setIsAddingSubreddit(true);
    const subredditName = newSubredditName.trim().replace(/^r\//, '');
    
    const result = await addSubreddit(category.id, subredditName);
    if (result) {
      setNewSubredditName('');
      // Pre-fetch cache for the new subreddit
      try {
        await fetchAndCache(subredditName);
      } catch (error) {
        console.error(`Failed to cache data for r/${subredditName}:`, error);
      }
    }
    setIsAddingSubreddit(false);
  };

  return (
    <Card 
      ref={setDroppableRef}
      className={`glass-card rounded-xl overflow-hidden transition-all duration-200 ${
        isDragging ? 'opacity-50 ring-2 ring-primary/50' : ''
      } ${isDropTarget ? 'ring-2 ring-primary bg-primary/5' : ''}`}
    >
      <CardHeader className="p-4 bg-secondary/20 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div 
            {...dragHandleProps}
            className="cursor-grab hover:text-primary transition-colors"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          
          {editingCategory ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                defaultValue={category.name}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateCategoryName((e.target as HTMLInputElement).value);
                  }
                }}
                onBlur={(e) => handleUpdateCategoryName(e.target.value)}
                autoFocus
                className="h-8 bg-secondary/50 border-border/50"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingCategory(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <h3
                className="font-medium flex-1 cursor-pointer hover:text-primary transition-colors"
                onClick={handleToggleCategory}
              >
                {category.name}
                <span className="text-muted-foreground ml-2 text-sm">
                  ({category.user_subreddits?.length || 0})
                </span>
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingCategory(true)}
                  className="h-8 w-8 p-0 hover:bg-secondary"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDeleteCategory}
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
              onKeyPress={(e) => e.key === 'Enter' && handleAddSubreddit()}
              className="h-9 bg-secondary/30 border-border/50"
              disabled={isAddingSubreddit}
            />
            <Button
              size="sm"
              onClick={handleAddSubreddit}
              disabled={!newSubredditName.trim() || isAddingSubreddit}
              className="h-9 px-3"
            >
              {isAddingSubreddit ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Subreddits List */}
          <SortableContext 
            items={category.user_subreddits?.map(s => s.id) || []}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {category.user_subreddits?.map((subreddit) => (
                <SortableSubreddit
                  key={subreddit.id}
                  subreddit={subreddit}
                  category={category}
                  isActive={false}
                />
              ))}
              
              {(!category.user_subreddits || category.user_subreddits.length === 0) && (
                <div className={`text-center py-6 border-2 border-dashed rounded-lg transition-colors ${
                  isDropTarget ? 'border-primary bg-primary/5' : 'border-border/30'
                }`}>
                  <p className="text-xs text-muted-foreground">
                    {isDropTarget ? 'Drop here to move' : 'No subreddits yet. Add one above or drag here.'}
                  </p>
                </div>
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
  dragHandleProps: Record<string, unknown>;
  isDragging: boolean;
}) {
  const [editingSubreddit, setEditingSubreddit] = React.useState(false);
  const { updateSubreddit, deleteSubreddit, loading, errors } = React.useContext(SettingsContext);

  const handleUpdateSubredditName = async (newName: string) => {
    if (newName.trim() && newName !== subreddit.subreddit_name) {
      await updateSubreddit(subreddit.id, { subreddit_name: newName.trim() });
    }
    setEditingSubreddit(false);
  };

  const handleDeleteSubreddit = async () => {
    await deleteSubreddit(subreddit.id);
  };

  const isLoading = loading[subreddit.subreddit_name.toLowerCase()];
  const error = errors[subreddit.subreddit_name.toLowerCase()];

  return (
    <div className={`
      flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/20 border border-border/30 
      transition-all duration-200 hover:bg-secondary/30
      ${isDragging ? 'opacity-50 ring-2 ring-primary/50' : ''}
    `}>
      <div {...dragHandleProps} className="cursor-grab">
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </div>
      
      {editingSubreddit ? (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-muted-foreground">r/</span>
          <Input
            defaultValue={subreddit.subreddit_name}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleUpdateSubredditName((e.target as HTMLInputElement).value);
              }
            }}
            onBlur={(e) => handleUpdateSubredditName(e.target.value)}
            autoFocus
            className="h-7 text-xs bg-secondary/50 border-border/50"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingSubreddit(false)}
            className="h-7 w-7 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm">r/{subreddit.subreddit_name}</span>
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
            onClick={() => setEditingSubreddit(true)}
            className="h-7 w-7 p-0 hover:bg-secondary"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeleteSubreddit}
            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </>
      )}
    </div>
  );
}

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
  
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeDragData, setActiveDragData] = React.useState<{ type: string; subreddit?: SubredditItem; categoryId?: string } | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = React.useState<string | null>(null);
  
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

  // Handle drag
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveDragData(event.active.data.current as typeof activeDragData);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    
    if (!over) {
      setDragOverCategoryId(null);
      return;
    }

    // Check if we're over a category drop zone
    const overId = over.id as string;
    if (overId.startsWith('category-drop-')) {
      const categoryId = overId.replace('category-drop-', '');
      setDragOverCategoryId(categoryId);
    } else {
      // Check if we're over a subreddit in a different category
      const overData = over.data.current;
      if (overData?.type === 'subreddit' && overData?.categoryId) {
        setDragOverCategoryId(overData.categoryId);
      } else {
        setDragOverCategoryId(null);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);
    setDragOverCategoryId(null);

    if (!over) return;

    const activeData = active.data.current;
    const overId = over.id as string;

    // Handle category reordering
    const activeCategory = data.categories.find(cat => cat.id === active.id);
    if (activeCategory) {
      const overCategory = data.categories.find(cat => cat.id === over.id);
      if (overCategory && active.id !== over.id) {
        const oldIndex = data.categories.findIndex(cat => cat.id === active.id);
        const newIndex = data.categories.findIndex(cat => cat.id === over.id);
        const newOrder = arrayMove(data.categories, oldIndex, newIndex);
        const items = newOrder.map((cat, idx) => ({ id: cat.id, position: idx }));
        await reorderCategories(items);
      }
      return;
    }

    // Handle subreddit drag
    if (activeData?.type === 'subreddit') {
      const sourceCategoryId = activeData.categoryId;
      let targetCategoryId: string | null = null;
      let targetSubredditId: string | null = null;

      // Check if dropped on a category drop zone
      if (overId.startsWith('category-drop-')) {
        targetCategoryId = overId.replace('category-drop-', '');
      } else {
        // Check if dropped on another subreddit
        const overData = over.data.current;
        if (overData?.type === 'subreddit') {
          targetCategoryId = overData.categoryId;
          targetSubredditId = over.id as string;
        }
      }

      if (!targetCategoryId) return;

      // Moving to a different category
      if (sourceCategoryId !== targetCategoryId) {
        // Update subreddit's category - local state is updated in the hook
        await updateSubreddit(active.id as string, { category_id: targetCategoryId });
      } else if (targetSubredditId && active.id !== over.id) {
        // Reordering within the same category
        const category = data.categories.find(cat => cat.id === sourceCategoryId);
        if (category?.user_subreddits) {
          const oldIndex = category.user_subreddits.findIndex(sub => sub.id === active.id);
          const newIndex = category.user_subreddits.findIndex(sub => sub.id === over.id);
          if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = arrayMove(category.user_subreddits, oldIndex, newIndex);
            const items = newOrder.map((sub, idx) => ({ id: sub.id, position: idx }));
            await reorderSubreddits(sourceCategoryId, items);
          }
        }
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

  const formatSubscribers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

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
                
                {/* Refresh button */}
                <div className="ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refresh()}
                    disabled={isLoading}
                    className="p-2"
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
