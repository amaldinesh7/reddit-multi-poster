import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CategoryCard from './CategoryCard';
import { Category } from './types';

interface SortableCategoryProps {
  category: Category;
  isActive: boolean;
  canDelete: boolean;
}

const SortableCategory: React.FC<SortableCategoryProps> = ({ category, canDelete }) => {
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
        dragContainerProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        canDelete={canDelete}
      />
    </div>
  );
};

export default SortableCategory;
