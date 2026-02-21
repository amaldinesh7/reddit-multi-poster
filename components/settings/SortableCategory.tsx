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
    isOver,
  } = useSortable({ id: category.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    position: 'relative' as const,
  };

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style}>
        <div className="h-[3px] rounded-full bg-primary/30 my-2" />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      {isOver && (
        <div
          className="absolute -top-[5px] left-3 right-3 h-[3px] rounded-full bg-primary z-10 pointer-events-none"
          style={{ boxShadow: '0 0 8px hsl(var(--primary) / 0.5)' }}
        />
      )}
      <CategoryCard
        category={category}
        dragHandleProps={{ ...attributes, ...listeners }}
        dragContainerProps={{ ...attributes, ...listeners }}
        isDragging={false}
        canDelete={canDelete}
      />
    </div>
  );
};

export default SortableCategory;
