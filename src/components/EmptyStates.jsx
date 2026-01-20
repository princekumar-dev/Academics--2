import React from 'react'
import { FileX, Search, AlertCircle, Inbox, CheckCircle } from 'lucide-react'

export function EmptyState({ 
  icon: Icon = Inbox, 
  title, 
  description, 
  actionLabel, 
  onAction,
  illustration = 'inbox'
}) {
  const illustrations = {
    inbox: <Inbox className="w-24 h-24 text-gray-300" />,
    search: <Search className="w-24 h-24 text-gray-300" />,
    error: <AlertCircle className="w-24 h-24 text-gray-300" />,
    success: <CheckCircle className="w-24 h-24 text-green-300" />,
    empty: <FileX className="w-24 h-24 text-gray-300" />
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mb-6 opacity-50">
        {Icon ? <Icon className="w-24 h-24 text-gray-300" /> : illustrations[illustration]}
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
        {title}
      </h3>
      
      {description && (
        <p className="text-gray-600 text-center max-w-md mb-6">
          {description}
        </p>
      )}
      
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 active:bg-yellow-700 font-semibold transition-colors shadow-md hover:shadow-lg"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// Specific empty states for common scenarios
export function NoMarksheets({ onImport }) {
  return (
    <EmptyState
      illustration="empty"
      title="No Marksheets Found"
      description="You haven't created any marksheets yet. Import marks from Excel to get started."
      actionLabel="Import Marks"
      onAction={onImport}
    />
  )
}

export function NoSearchResults({ query, onClear }) {
  return (
    <EmptyState
      illustration="search"
      title="No Results Found"
      description={`We couldn't find any results for "${query}". Try adjusting your search terms.`}
      actionLabel="Clear Search"
      onAction={onClear}
    />
  )
}

export function NoPendingRequests() {
  return (
    <EmptyState
      illustration="success"
      title="All Caught Up!"
      description="There are no pending approval requests at the moment. Great job!"
    />
  )
}

export function NoDispatchRequests() {
  return (
    <EmptyState
      illustration="inbox"
      title="No Dispatch Requests"
      description="You haven't requested any marksheet dispatches yet. Verify your marksheets first."
    />
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <EmptyState
      illustration="error"
      title="Something Went Wrong"
      description={message || "We encountered an error loading this data. Please try again."}
      actionLabel="Retry"
      onAction={onRetry}
    />
  )
}
