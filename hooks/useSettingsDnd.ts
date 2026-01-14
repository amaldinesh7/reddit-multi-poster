import { useState, useCallback } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Category, SubredditItem } from '../hooks/useSubreddits';

interface DragData {
  type: string;
  subreddit?: SubredditItem;
  categoryId?: string;
}

interface UseSettingsDndProps {
  categories: Category[];
  reorderCategories: (items: Array<{ id: string; position: number }>) => Promise<boolean>;
  reorderSubreddits: (categoryId: string, items: Array<{ id: string; position: number }>) => Promise<boolean>;
  updateSubreddit: (subredditId: string, updates: { category_id?: string }) => Promise<boolean>;
}

interface UseSettingsDndReturn {
  activeId: string | null;
  activeDragData: DragData | null;
  dragOverCategoryId: string | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

export const useSettingsDnd = ({
  categories,
  reorderCategories,
  reorderSubreddits,
  updateSubreddit,
}: UseSettingsDndProps): UseSettingsDndReturn => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveDragData(event.active.data.current as DragData);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
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
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);
    setDragOverCategoryId(null);

    if (!over) return;

    const activeData = active.data.current as DragData | undefined;
    const overId = over.id as string;

    // Handle category reordering
    const activeCategory = categories.find(cat => cat.id === active.id);
    if (activeCategory) {
      const overCategory = categories.find(cat => cat.id === over.id);
      if (overCategory && active.id !== over.id) {
        const oldIndex = categories.findIndex(cat => cat.id === active.id);
        const newIndex = categories.findIndex(cat => cat.id === over.id);
        const newOrder = arrayMove(categories, oldIndex, newIndex);
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

      if (!targetCategoryId || !sourceCategoryId) return;

      // Moving to a different category
      if (sourceCategoryId !== targetCategoryId) {
        // Update subreddit's category - local state is updated in the hook
        await updateSubreddit(active.id as string, { category_id: targetCategoryId });
      } else if (targetSubredditId && active.id !== over.id) {
        // Reordering within the same category
        const category = categories.find(cat => cat.id === sourceCategoryId);
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
  }, [categories, reorderCategories, reorderSubreddits, updateSubreddit]);

  return {
    activeId,
    activeDragData,
    dragOverCategoryId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
};
