import React from 'react'

// Skeleton for table rows
export function TableSkeleton({ rows = 5, columns = 6 }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          {[...Array(columns)].map((_, j) => (
            <div
              key={j}
              className="h-12 bg-gray-200 rounded-lg"
              style={{ width: j === 0 ? '5%' : j === 1 ? '25%' : j === 2 ? '20%' : j === 3 ? '15%' : j === 4 ? '20%' : '15%' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// Skeleton for cards
export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-6 shadow-lg animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gray-200 rounded-full" />
            <div className="w-16 h-8 bg-gray-200 rounded-lg" />
          </div>
          <div className="w-24 h-4 bg-gray-200 rounded mb-2" />
          <div className="w-32 h-6 bg-gray-300 rounded" />
        </div>
      ))}
    </div>
  )
}

// Skeleton for list items
export function ListSkeleton({ items = 5 }) {
  return (
    <div className="space-y-4">
      {[...Array(items)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-4 shadow animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-gray-300 rounded" />
              <div className="w-1/2 h-3 bg-gray-200 rounded" />
            </div>
            <div className="w-20 h-8 bg-gray-200 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Skeleton for form
export function FormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i}>
          <div className="w-32 h-4 bg-gray-200 rounded mb-2" />
          <div className="w-full h-10 bg-gray-200 rounded-lg" />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1 h-10 bg-gray-300 rounded-lg" />
      </div>
    </div>
  )
}

// Skeleton for detailed view
export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="w-48 h-8 bg-gray-300 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="w-24 h-4 bg-gray-200 rounded" />
            <div className="w-full h-6 bg-gray-300 rounded" />
          </div>
        ))}
      </div>
      <div className="w-full h-64 bg-gray-200 rounded-xl" />
    </div>
  )
}
