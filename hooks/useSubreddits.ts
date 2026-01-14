import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

import { 
  fetchCategories as fetchCategoriesAPI, 
  createCategory as createCategoryAPI, 
  updateCategoryAPI, 
  deleteCategoryAPI, 
  addSubredditAPI, 
  updateSubredditAPI, 
  deleteSubredditAPI, 
  reorderItems 
} from '../lib/api/settings';
import { SubredditItem, Category, SubredditData, ApiResponse } from '../types/api';

const DEFAULT_DATA: SubredditData = {
  categories: []
};

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
      const fetchedCategories = await fetchCategoriesAPI();
      setData({ categories: fetchedCategories });
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
      const newCategory = await createCategoryAPI(name);
      
      setData(prev => ({
        categories: [...prev.categories, newCategory]
      }));
      return newCategory;
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
      const updatedCategory = await updateCategoryAPI(categoryId, updates);
      
      setData(prev => ({
        categories: prev.categories.map(cat =>
          cat.id === categoryId ? { ...cat, ...updatedCategory } : cat
        )
      }));
      return true;
    } catch (err) {
      console.error('Failed to update category:', err);
      return false;
    }
  }, []);

  // Delete a category
  const deleteCategory = useCallback(async (categoryId: string): Promise<boolean> => {
    try {
      await deleteCategoryAPI(categoryId);
      
      setData(prev => ({
        categories: prev.categories.filter(cat => cat.id !== categoryId)
      }));
      return true;
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
      const newSubreddit = await addSubredditAPI(categoryId, subredditName);
      
      setData(prev => ({
        categories: prev.categories.map(cat =>
          cat.id === categoryId
            ? { ...cat, user_subreddits: [...cat.user_subreddits, newSubreddit] }
            : cat
        )
      }));
      return newSubreddit;
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
      const updatedSubreddit = await updateSubredditAPI(subredditId, updates);
      
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
    } catch (err) {
      console.error('Failed to update subreddit:', err);
      return false;
    }
  }, []);

  // Delete a subreddit
  const deleteSubreddit = useCallback(async (subredditId: string): Promise<boolean> => {
    try {
      await deleteSubredditAPI(subredditId);
      
      setData(prev => ({
        categories: prev.categories.map(cat => ({
          ...cat,
          user_subreddits: cat.user_subreddits.filter(sub => sub.id !== subredditId)
        }))
      }));
      return true;
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
      const success = await reorderItems('categories', items);
      
      if (!success) {
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
      const success = await reorderItems('subreddits', items);
      
      if (!success) {
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
