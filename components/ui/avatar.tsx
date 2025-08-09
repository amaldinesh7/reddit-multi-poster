import React from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  fallback: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ src, alt, fallback, size = 'md', className = '' }: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  const shouldShowImage = src && !imageError && src.startsWith('http');

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-muted flex items-center justify-center font-medium ${className}`}>
      {shouldShowImage ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="text-muted-foreground">
          {fallback.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
} 