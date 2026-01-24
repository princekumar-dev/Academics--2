import React from 'react'

// Shared Refresh button used across pages to keep label, spinner, spacing and disabled behavior consistent
export default function RefreshButton({ isLoading = false, onClick = () => {}, className = '', label = 'Refresh', ariaLabel = 'Refresh' }) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      aria-label={ariaLabel}
      className={`glass-button flex items-center gap-2 px-3 sm:px-4 py-2 text-theme-gold rounded-lg text-sm font-medium transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-theme-gold/10 active:scale-95 ${className}`}
    >
      <svg 
        className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-500 ${isLoading ? 'animate-spin' : 'hover:rotate-180'}`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span className="hidden sm:inline transition-opacity duration-200">{isLoading ? 'Refreshing...' : label}</span>
    </button>
  )
}
