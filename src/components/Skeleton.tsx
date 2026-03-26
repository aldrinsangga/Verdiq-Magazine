import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

/**
 * Reusable Skeleton loader for content placeholders
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className={`animate-pulse bg-slate-800/50 rounded-lg ${className}`} 
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </>
  );
};

/**
 * Pre-defined skeleton layouts for common views
 */
export const MagazineSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    <Skeleton className="h-[400px] rounded-3xl" count={6} />
  </div>
);

export const StudioSkeleton = () => (
  <div className="space-y-8">
    <div className="flex justify-between items-center">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Skeleton className="h-[500px] rounded-[40px]" />
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" count={3} />
      </div>
    </div>
  </div>
);

export const PodcastSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
    <Skeleton className="h-[300px] rounded-3xl" count={4} />
  </div>
);
