/**
 * SaveToCategoryDropdown Component
 * 
 * An inline dropdown for saving a subreddit to a category list.
 * Replaces the modal-based flow with a more streamlined dropdown experience.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenuRoot, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItemPrimitive,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Save, ChevronDown, Loader2, FolderPlus, Check } from 'lucide-react';
import { useSubreddits } from '@/hooks/useSubreddits';
import { cn } from '@/lib/utils';

interface SaveToCategoryDropdownProps {
  subredditName: string;
  onSave: (categoryId: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

const SaveToCategoryDropdown: React.FC<SaveToCategoryDropdownProps> = ({
  subredditName,
  onSave,
  disabled = false,
  className,
}) => {
  const { data, isLoaded } = useSubreddits();
  const [isSaving, setIsSaving] = useState(false);
  const [savedToCategoryId, setSavedToCategoryId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = async (categoryId: string) => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave(categoryId);
      setSavedToCategoryId(categoryId);
      // Keep dropdown open briefly to show success, then close
      setTimeout(() => {
        setIsOpen(false);
        setSavedToCategoryId(null);
      }, 600);
    } catch (error) {
      console.error('Failed to save to category', error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasCategories = isLoaded && data.categories.length > 0;

  return (
    <DropdownMenuRoot open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || isSaving}
          className={cn("h-8 text-xs whitespace-nowrap cursor-pointer group", className)}
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Save className="w-3 h-3 mr-1" />
          )}
          Save
          <ChevronDown className="w-3 h-3 ml-1 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {/* Header */}
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Save r/{subredditName} to:
        </div>
        <DropdownMenuSeparator />
        
        {/* Loading state */}
        {!isLoaded && (
          <div className="px-2 py-3 text-center">
            <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
          </div>
        )}

        {/* No categories state */}
        {isLoaded && !hasCategories && (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">
            <FolderPlus className="w-4 h-4 mx-auto mb-1.5 opacity-50" />
            <p>No lists yet</p>
            <p className="text-xs mt-0.5">Create one in Settings</p>
          </div>
        )}

        {/* Categories list */}
        {hasCategories && data.categories.map((category) => {
          const isJustSaved = savedToCategoryId === category.id;
          return (
            <DropdownMenuItemPrimitive
              key={category.id}
              onClick={() => handleSave(category.id)}
              disabled={isSaving}
              className={cn(
                "flex items-center justify-between gap-2",
                isJustSaved && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              <span className="truncate">{category.name}</span>
              {isJustSaved && (
                <Check className="w-3.5 h-3.5 shrink-0" />
              )}
            </DropdownMenuItemPrimitive>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};

export default SaveToCategoryDropdown;
