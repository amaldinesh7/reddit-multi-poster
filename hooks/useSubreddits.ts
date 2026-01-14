import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export interface SubredditItem {
  id: string;
  subreddit_name: string;
  display_name?: string | null;
  position: number;
  created_at: string;
  category_id: string;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
  user_subreddits: SubredditItem[];
}

export interface SubredditData {
  categories: Category[];
}

const DEFAULT_DATA: SubredditData = {
  categories: []
};

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export function useSubreddits() {
  const [data, setData] = useState<SubredditData>(DEFAULT_DATA);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories from API
  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: response } = await axios.get<ApiResponse<Category[]>>('/api/settings/categories');
      
      if (response.success && response.data) {
        setData({ categories: response.data });
      } else {
        throw new Error(response.error?.message || 'Failed to fetch categories');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch categories';
      setError(message);
      console.error('Failed to fetch categories:', err);
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Create a new category
  const createCategory = useCallback(async (name: string): Promise<Category | null> => {
    try {
      const { data: response } = await axios.post<ApiResponse<Category>>('/api/settings/categories', { name });
      
      if (response.success && response.data) {
        const newCategory = { ...response.data, user_subreddits: [] };
        setData(prev => ({
          categories: [...prev.categories, newCategory]
        }));
        return newCategory;
      }
      throw new Error(response.error?.message || 'Failed to create category');
    } catch (err) {
      console.error('Failed to create category:', err);
      return null;
    }
  }, []);

  // Update a category
  const updateCategory = useCallback(async (
    categoryId: string, 
    updates: { name?: string; collapsed?: boolean; position?: number }
  ): Promise<boolean> => {
    try {
      const { data: response } = await axios.put<ApiResponse<Category>>(
        `/api/settings/categories/${categoryId}`,
        updates
      );
      
      if (response.success && response.data) {
        setData(prev => ({
          categories: prev.categories.map(cat =>
            cat.id === categoryId ? { ...cat, ...response.data } : cat
          )
        }));
        return true;
      }
      throw new Error(response.error?.message || 'Failed to update category');
    } catch (err) {
      console.error('Failed to update category:', err);
      return false;
    }
  }, []);

  // Delete a category
  const deleteCategory = useCallback(async (categoryId: string): Promise<boolean> => {
    try {
      const { data: response } = await axios.delete<ApiResponse<{ deleted: boolean }>>(
        `/api/settings/categories/${categoryId}`
      );
      
      if (response.success) {
        setData(prev => ({
          categories: prev.categories.filter(cat => cat.id !== categoryId)
        }));
        return true;
      }
      throw new Error(response.error?.message || 'Failed to delete category');
    } catch (err) {
      console.error('Failed to delete category:', err);
      return false;
    }
  }, []);

  // Add a subreddit to a category
  const addSubreddit = useCallback(async (
    categoryId: string, 
    subredditName: string
  ): Promise<SubredditItem | null> => {
    try {
      const { data: response } = await axios.post<ApiResponse<SubredditItem>>(
        '/api/settings/subreddits',
        { category_id: categoryId, subreddit_name: subredditName }
      );
      
      if (response.success && response.data) {
        setData(prev => ({
          categories: prev.categories.map(cat =>
            cat.id === categoryId
              ? { ...cat, user_subreddits: [...cat.user_subreddits, response.data!] }
              : cat
          )
        }));
        return response.data;
      }
      throw new Error(response.error?.message || 'Failed to add subreddit');
    } catch (err) {
      console.error('Failed to add subreddit:', err);
      return null;
    }
  }, []);

  // Update a subreddit
  const updateSubreddit = useCallback(async (
    subredditId: string,
    updates: { subreddit_name?: string; display_name?: string; position?: number; category_id?: string }
  ): Promise<boolean> => {
    try {
      const { data: response } = await axios.put<ApiResponse<SubredditItem>>(
        `/api/settings/subreddits/${subredditId}`,
        updates
      );
      
      if (response.success && response.data) {
        const updatedSubreddit = response.data;
        
        // Handle moving to a different category
        if (updates.category_id) {
          setData(prev => {
            // Find and remove from old category, add to new category
            let movedSubreddit: SubredditItem | null = null;
            
            const categoriesWithRemoved = prev.categories.map(cat => {
              const foundSub = cat.user_subreddits.find(sub => sub.id === subredditId);
              if (foundSub) {
                movedSubreddit = { ...foundSub, ...updatedSubreddit };
                return {
                  ...cat,
                  user_subreddits: cat.user_subreddits.filter(sub => sub.id !== subredditId)
                };
              }
              return cat;
            });
            
            // Add to new category
            if (movedSubreddit) {
              return {
                categories: categoriesWithRemoved.map(cat => {
                  if (cat.id === updates.category_id) {
                    return {
                      ...cat,
                      user_subreddits: [...cat.user_subreddits, movedSubreddit!]
                    };
                  }
                  return cat;
                })
              };
            }
            
            return { categories: categoriesWithRemoved };
          });
        } else {
          // Normal update within same category
          setData(prev => ({
            categories: prev.categories.map(cat => ({
              ...cat,
              user_subreddits: cat.user_subreddits.map(sub =>
                sub.id === subredditId ? { ...sub, ...updatedSubreddit } : sub
              )
            }))
          }));
        }
        return true;
      }
      throw new Error(response.error?.message || 'Failed to update subreddit');
    } catch (err) {
      console.error('Failed to update subreddit:', err);
      return false;
    }
  }, []);

  // Delete a subreddit
  const deleteSubreddit = useCallback(async (subredditId: string): Promise<boolean> => {
    try {
      const { data: response } = await axios.delete<ApiResponse<{ deleted: boolean }>>(
        `/api/settings/subreddits/${subredditId}`
      );
      
      if (response.success) {
        setData(prev => ({
          categories: prev.categories.map(cat => ({
            ...cat,
            user_subreddits: cat.user_subreddits.filter(sub => sub.id !== subredditId)
          }))
        }));
        return true;
      }
      throw new Error(response.error?.message || 'Failed to delete subreddit');
    } catch (err) {
      console.error('Failed to delete subreddit:', err);
      return false;
    }
  }, []);

  // Reorder categories
  const reorderCategories = useCallback(async (
    items: Array<{ id: string; position: number }>
  ): Promise<boolean> => {
    // Optimistic update
    setData(prev => {
      const positionMap = new Map(items.map(i => [i.id, i.position]));
      const newCategories = [...prev.categories].sort((a, b) => {
        const posA = positionMap.get(a.id) ?? a.position;
        const posB = positionMap.get(b.id) ?? b.position;
        return posA - posB;
      });
      return { categories: newCategories };
    });

    try {
      const { data: response } = await axios.put<ApiResponse<{ updated: number }>>(
        '/api/settings/reorder',
        { type: 'categories', items }
      );
      
      if (!response.success) {
        // Revert on failure
        await fetchCategories();
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to reorder categories:', err);
      await fetchCategories();
      return false;
    }
  }, [fetchCategories]);

  // Reorder subreddits within a category
  const reorderSubreddits = useCallback(async (
    categoryId: string,
    items: Array<{ id: string; position: number }>
  ): Promise<boolean> => {
    // Optimistic update
    setData(prev => ({
      categories: prev.categories.map(cat => {
        if (cat.id !== categoryId) return cat;
        const positionMap = new Map(items.map(i => [i.id, i.position]));
        const newSubreddits = [...cat.user_subreddits].sort((a, b) => {
          const posA = positionMap.get(a.id) ?? a.position;
          const posB = positionMap.get(b.id) ?? b.position;
          return posA - posB;
        });
        return { ...cat, user_subreddits: newSubreddits };
      })
    }));

    try {
      const { data: response } = await axios.put<ApiResponse<{ updated: number }>>(
        '/api/settings/reorder',
        { type: 'subreddits', items }
      );
      
      if (!response.success) {
        await fetchCategories();
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to reorder subreddits:', err);
      await fetchCategories();
      return false;
    }
  }, [fetchCategories]);

  // Get flattened list of all subreddits in order
  const getAllSubreddits = useCallback((): string[] => {
    const subreddits: string[] = [];
    data.categories.forEach(category => {
      category.user_subreddits.forEach(subreddit => {
        subreddits.push(subreddit.subreddit_name);
      });
    });
    return subreddits;
  }, [data]);

  // Get subreddits grouped by category
  const getSubredditsByCategory = useCallback((): { categoryName: string; subreddits: string[] }[] => {
    return data.categories.map(category => ({
      categoryName: category.name,
      subreddits: category.user_subreddits.map(sub => sub.subreddit_name)
    }));
  }, [data]);

  return {
    data,
    isLoaded,
    isLoading,
    error,
    refresh: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    addSubreddit,
    updateSubreddit,
    deleteSubreddit,
    reorderCategories,
    reorderSubreddits,
    getAllSubreddits,
    getSubredditsByCategory,
  };
}
