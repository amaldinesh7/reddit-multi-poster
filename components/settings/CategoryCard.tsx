import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmDialog, { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { GripVertical, Edit2, X, Trash2, Plus, Loader2 } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSettingsContext } from './SettingsContext';
import { Category } from './types';
import SortableSubreddit from './SortableSubreddit';

interface CategoryCardProps {
  category: Category;
  dragHandleProps: Record<string, unknown>;
  isDragging: boolean;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  dragHandleProps,
  isDragging
}) => {
  const [editingCategory, setEditingCategory] = React.useState(false);
  const [newSubredditName, setNewSubredditName] = React.useState('');
  const [isAddingSubreddit, setIsAddingSubreddit] = React.useState(false);
  const { addSubreddit, updateCategory, deleteCategory, fetchAndCache, dragOverCategoryId } = useSettingsContext();
  const confirmDialog = useConfirmDialog();
  
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
    const confirmed = await confirmDialog.openDialog({
      title: 'Delete Category',
      message: `Are you sure you want to delete "${category.name}" and all its subreddits? This action cannot be undone.`,
      variant: 'destructive',
    });
    
    if (confirmed) {
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleUpdateCategoryName((e.target as HTMLInputElement).value);
    }
  };

  const handleSubredditKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddSubreddit();
    }
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
            <GripVertical className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </div>
          
          {editingCategory ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                defaultValue={category.name}
                onKeyPress={handleKeyPress}
                onBlur={(e) => handleUpdateCategoryName(e.target.value)}
                autoFocus
                className="h-8 bg-secondary/50 border-border/50"
                aria-label="Edit category name"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingCategory(false)}
                className="h-8 w-8 p-0 cursor-pointer"
                aria-label="Cancel editing"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <h3
                className="font-medium flex-1 cursor-pointer hover:text-primary transition-colors"
                onClick={handleToggleCategory}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggleCategory();
                  }
                }}
                aria-expanded={!category.collapsed}
                aria-label={`${category.name} category, ${category.user_subreddits?.length || 0} subreddits`}
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
                  className="h-8 w-8 p-0 hover:bg-secondary cursor-pointer"
                  aria-label={`Edit ${category.name} category`}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDeleteCategory}
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                  aria-label={`Delete ${category.name} category`}
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
              onKeyPress={handleSubredditKeyPress}
              className="h-9 bg-secondary/30 border-border/50"
              disabled={isAddingSubreddit}
              aria-label="Add new subreddit"
            />
            <Button
              size="sm"
              onClick={handleAddSubreddit}
              disabled={!newSubredditName.trim() || isAddingSubreddit}
              className="h-9 px-3 cursor-pointer"
              aria-label="Add subreddit"
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
      
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel="Delete"
        onConfirm={confirmDialog.handleConfirm}
        onCancel={confirmDialog.handleCancel}
      />
    </Card>
  );
};

export default CategoryCard;
