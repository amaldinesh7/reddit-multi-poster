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
};

export default SortableSubreddit;
