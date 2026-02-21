import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SubredditItemComponent from './SubredditItem';
import { SubredditItem, Category } from './types';

interface SortableSubredditProps {
  subreddit: SubredditItem;
  category: Category;
  isActive: boolean;
}

const SortableSubreddit: React.FC<SortableSubredditProps> = ({
  subreddit,
  category,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ 
    id: subreddit.id,
    data: { 
      type: 'subreddit', 
      subreddit, 
      categoryId: category.id 
    }
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    position: 'relative' as const,
  };

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style}>
        <div className="h-[3px] rounded-full bg-primary/30 my-1" />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      {isOver && (
        <div
          className="absolute -top-[3px] left-2 right-2 h-[3px] rounded-full bg-primary z-10 pointer-events-none"
          style={{ boxShadow: '0 0 6px hsl(var(--primary) / 0.5)' }}
        />
      )}
      <SubredditItemComponent 
        subreddit={subreddit}
        category={category}
        dragHandleProps={{ ...attributes, ...listeners }}
        dragContainerProps={{ ...attributes, ...listeners }}
        isDragging={false}
      />
    </div>
  );
};

export default SortableSubreddit;
