import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Plus, Trash2, GripVertical, Edit2, Save, X, Loader2 } from 'lucide-react';
import { useSubredditCache } from '../hooks/useSubredditCache';

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
  categories: [
    {
      id: 'indian',
      name: 'Indian',
      subreddits: [
        { id: 'indianhotwife', name: 'IndianHotwife' },
        { id: 'keralagw', name: 'KeralaGW' },
        { id: 'desigw', name: 'Desi_GW' },
        { id: 'bengalisgonewild', name: 'BengalisGoneWild' },
        { id: 'blouselesssaree', name: 'BlouselessSaree' },
        { id: 'malayaligonewild', name: 'Malayali_GoneWild' },
      ]
    }
  ]
};

export default function Settings() {
  const router = useRouter();
  const [data, setData] = React.useState<SubredditData>(DEFAULT_DATA);
  const [editingCategory, setEditingCategory] = React.useState<string | null>(null);
  const [editingSubreddit, setEditingSubreddit] = React.useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [newSubredditName, setNewSubredditName] = React.useState('');
  const [draggedItem, setDraggedItem] = React.useState<{ type: 'category' | 'subreddit'; id: string; categoryId?: string } | null>(null);
  
  // Cache management
  const { fetchAndCache, removeFromCache, loading, errors } = useSubredditCache();

  // Load data from localStorage on mount
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
  }, []);

  // Save data to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('reddit-multi-poster-subreddits', JSON.stringify(data));
  }, [data]);

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const newCategory: Category = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      subreddits: []
    };
    
    setData(prev => ({
      categories: [...prev.categories, newCategory]
    }));
    setNewCategoryName('');
  };

  const deleteCategory = (categoryId: string) => {
    setData(prev => ({
      categories: prev.categories.filter(cat => cat.id !== categoryId)
    }));
  };

  const updateCategoryName = (categoryId: string, newName: string) => {
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId ? { ...cat, name: newName } : cat
      )
    }));
    setEditingCategory(null);
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
      // Don't remove the subreddit from the list if caching fails
      // The user can still use it, and we'll try to fetch data when needed
    }
  };

  const deleteSubreddit = (categoryId: string, subredditId: string) => {
    // Find the subreddit name before removing it
    const category = data.categories.find(cat => cat.id === categoryId);
    const subreddit = category?.subreddits.find(sub => sub.id === subredditId);
    
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, subreddits: cat.subreddits.filter(sub => sub.id !== subredditId) }
          : cat
      )
    }));
    
    // Remove from cache if it exists
    if (subreddit) {
      removeFromCache(subreddit.name);
    }
  };

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

  const handleDragStart = (e: React.DragEvent, type: 'category' | 'subreddit', id: string, categoryId?: string) => {
    setDraggedItem({ type, id, categoryId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetType: 'category' | 'subreddit', targetId: string, targetCategoryId?: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (draggedItem.type === 'category' && targetType === 'category') {
      // Reorder categories
      setData(prev => {
        const categories = [...prev.categories];
        const draggedIndex = categories.findIndex(cat => cat.id === draggedItem.id);
        const targetIndex = categories.findIndex(cat => cat.id === targetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          const [draggedCategory] = categories.splice(draggedIndex, 1);
          categories.splice(targetIndex, 0, draggedCategory);
        }
        
        return { categories };
      });
    } else if (draggedItem.type === 'subreddit' && targetType === 'subreddit' && draggedItem.categoryId === targetCategoryId) {
      // Reorder subreddits within same category
      setData(prev => ({
        categories: prev.categories.map(cat => {
          if (cat.id === targetCategoryId) {
            const subreddits = [...cat.subreddits];
            const draggedIndex = subreddits.findIndex(sub => sub.id === draggedItem.id);
            const targetIndex = subreddits.findIndex(sub => sub.id === targetId);
            
            if (draggedIndex !== -1 && targetIndex !== -1) {
              const [draggedSubreddit] = subreddits.splice(draggedIndex, 1);
              subreddits.splice(targetIndex, 0, draggedSubreddit);
            }
            
            return { ...cat, subreddits };
          }
          return cat;
        })
      }));
    }
    
    setDraggedItem(null);
  };

  const toggleCategory = (categoryId: string) => {
    setData(prev => ({
      categories: prev.categories.map(cat =>
        cat.id === categoryId ? { ...cat, collapsed: !cat.collapsed } : cat
      )
    }));
  };

  return (
    <>
      <Head>
        <title>Settings - Reddit Multi-Poster</title>
      </Head>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <h1 className="text-lg sm:text-xl font-semibold">Settings</h1>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Card className="border-0 sm:border shadow-sm sm:shadow-md">
            <CardHeader className="pb-3 px-4 sm:px-6">
              <CardTitle>Manage Subreddits</CardTitle>
              <p className="text-sm text-muted-foreground">
                Organize your subreddits into categories and reorder them as needed.
              </p>
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 space-y-6">
              
              {/* Add New Category */}
              <div className="flex gap-2">
                <Input
                  placeholder="Category name (e.g., Indian, Asian, etc.)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                />
                <Button onClick={addCategory} disabled={!newCategoryName.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              </div>

              {/* Categories List */}
              <div className="space-y-4">
                {data.categories.map((category, categoryIndex) => (
                  <Card
                    key={category.id}
                    className="border border-border"
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'category', category.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'category', category.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                        
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
                              className="text-lg font-semibold"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingCategory(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <h3
                              className="text-lg font-semibold flex-1 cursor-pointer"
                              onClick={() => toggleCategory(category.id)}
                            >
                              {category.name} ({category.subreddits.length})
                            </h3>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingCategory(category.id)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteCategory(category.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardHeader>

                    {!category.collapsed && (
                      <CardContent className="pt-0">
                        {/* Add Subreddit */}
                        <div className="flex gap-2 mb-4">
                          <Input
                            placeholder="Subreddit name (e.g., IndianHotwife)"
                            value={newSubredditName}
                            onChange={(e) => setNewSubredditName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addSubreddit(category.id)}
                          />
                          <Button
                            size="sm"
                            onClick={() => addSubreddit(category.id)}
                            disabled={!newSubredditName.trim()}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Subreddits List */}
                        <div className="space-y-2">
                          {category.subreddits.map((subreddit) => {
                            const isLoading = loading[subreddit.name.toLowerCase()];
                            const error = errors[subreddit.name.toLowerCase()];
                            
                            return (
                              <div
                                key={subreddit.id}
                                className="flex items-center gap-3 p-2 border border-border rounded bg-muted/30"
                                draggable
                                onDragStart={(e) => handleDragStart(e, 'subreddit', subreddit.id, category.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, 'subreddit', subreddit.id, category.id)}
                              >
                                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                                
                                {editingSubreddit === subreddit.id ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="text-sm text-muted-foreground">r/</span>
                                    <Input
                                      defaultValue={subreddit.name}
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          updateSubredditName(category.id, subreddit.id, (e.target as HTMLInputElement).value);
                                        }
                                      }}
                                      onBlur={(e) => updateSubredditName(category.id, subreddit.id, e.target.value)}
                                      autoFocus
                                      className="text-sm"
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingSubreddit(null)}
                                    >
                                      <X className="w-4 h-4" />
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
                                        <span className="text-xs text-red-500" title={error}>
                                          ⚠️
                                        </span>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingSubreddit(subreddit.id)}
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => deleteSubreddit(category.id, subreddit.id)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                          
                          {category.subreddits.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No subreddits in this category yet. Add one above.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
                
                {data.categories.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No categories yet. Create your first category above.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
} 