import axios from 'axios';
import { Category, SubredditItem, ApiResponse } from '../../types/api';

export async function fetchCategories(): Promise<Category[]> {
  const { data: response } = await axios.get<ApiResponse<Category[]>>('/api/settings/categories');
  
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error?.message || 'Failed to fetch categories');
}

export async function createCategory(name: string): Promise<Category> {
  const { data: response } = await axios.post<ApiResponse<Category>>('/api/settings/categories', { name });
  
  if (response.success && response.data) {
    return { ...response.data, user_subreddits: [] };
  }
  throw new Error(response.error?.message || 'Failed to create category');
}

export async function updateCategoryAPI(categoryId: string, updates: { name?: string; collapsed?: boolean; position?: number }): Promise<Category> {
  const { data: response } = await axios.put<ApiResponse<Category>>(
    `/api/settings/categories/${categoryId}`,
    updates
  );
  
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error?.message || 'Failed to update category');
}

export async function deleteCategoryAPI(categoryId: string): Promise<boolean> {
  const { data: response } = await axios.delete<ApiResponse<{ deleted: boolean }>>(
    `/api/settings/categories/${categoryId}`
  );
  
  if (response.success) {
    return true;
  }
  throw new Error(response.error?.message || 'Failed to delete category');
}

export async function addSubredditAPI(categoryId: string, subredditName: string): Promise<SubredditItem> {
  const { data: response } = await axios.post<ApiResponse<SubredditItem>>(
    '/api/settings/subreddits',
    { category_id: categoryId, subreddit_name: subredditName }
  );
  
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error?.message || 'Failed to add subreddit');
}

export async function updateSubredditAPI(subredditId: string, updates: { subreddit_name?: string; display_name?: string; position?: number; category_id?: string }): Promise<SubredditItem> {
  const { data: response } = await axios.put<ApiResponse<SubredditItem>>(
    `/api/settings/subreddits/${subredditId}`,
    updates
  );
  
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error?.message || 'Failed to update subreddit');
}

export async function deleteSubredditAPI(subredditId: string): Promise<boolean> {
  const { data: response } = await axios.delete<ApiResponse<{ deleted: boolean }>>(
    `/api/settings/subreddits/${subredditId}`
  );
  
  if (response.success) {
    return true;
  }
  throw new Error(response.error?.message || 'Failed to delete subreddit');
}

export async function reorderItems(type: 'categories' | 'subreddits', items: Array<{ id: string; position: number }>): Promise<boolean> {
  const { data: response } = await axios.put<ApiResponse<{ updated: number }>>(
    '/api/settings/reorder',
    { type, items }
  );
  
  return response.success;
}
