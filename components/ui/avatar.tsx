import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface AvatarProps {
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap: Record<NonNullable<AvatarProps['size']>, { cls: string; px: number }> = {
  sm: { cls: 'w-7 h-7 text-xs', px: 28 },
  md: { cls: 'w-9 h-9 text-sm', px: 36 },
  lg: { cls: 'w-11 h-11 text-base', px: 44 },
};

function Avatar({ src, alt, fallback, size = 'md', className }: AvatarProps) {
  const [error, setError] = React.useState(false)
  const { cls, px } = sizeMap[size]
  
  // Reddit CDN blocks Next.js image optimization, use unoptimized for these URLs
  const isRedditCdn = src?.includes('redditmedia.com') || src?.includes('redditstatic.com')
  
  const initials = fallback 
    ? fallback.slice(0, 2).toUpperCase() 
    : alt?.slice(0, 2).toUpperCase() || '?'

  return (
    <div 
      className={cn(
        "rounded-full overflow-hidden bg-secondary flex items-center justify-center",
        cls,
        className
      )}
    >
      {src && !error ? (
        <Image
          src={src}
          alt={alt || 'Avatar'}
          width={px}
          height={px}
          sizes={`${px}px`}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
          unoptimized={isRedditCdn}
        />
      ) : (
        <span className="font-medium text-muted-foreground">{initials}</span>
      )}
    </div>
  )
}

export { Avatar }
