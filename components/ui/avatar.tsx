import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarProps {
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base'
}

function Avatar({ src, alt, fallback, size = 'md', className }: AvatarProps) {
  const [error, setError] = React.useState(false)
  
  const initials = fallback 
    ? fallback.slice(0, 2).toUpperCase() 
    : alt?.slice(0, 2).toUpperCase() || '?'

  return (
    <div 
      className={cn(
        "rounded-full overflow-hidden bg-secondary flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      {src && !error ? (
        <img
          src={src}
          alt={alt || 'Avatar'}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span className="font-medium text-muted-foreground">{initials}</span>
      )}
    </div>
  )
}

export { Avatar }
