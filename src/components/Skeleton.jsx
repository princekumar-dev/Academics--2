function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
  )
}

export function PageSkeleton() {
  return (
    <div className="p-4">
      <Skeleton className="h-8 w-1/3 mb-4" />
      <Skeleton className="h-4 w-1/2 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  )
}

export default Skeleton


