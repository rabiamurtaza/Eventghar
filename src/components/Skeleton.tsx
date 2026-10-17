"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-neutral-200/80 dark:bg-neutral-800/80 ${className}`}
    />
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800/60 animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-md w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm animate-pulse">
      <div className="flex justify-between items-center mb-4">
        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-md w-1/3" />
        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-md w-1/6" />
      </div>
      <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-1/2 mb-4" />
      <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded-md w-2/3" />
    </div>
  );
}
