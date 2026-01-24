/**
 * Page-Specific Skeleton Loaders for MSEC Academics
 * 
 * Each page has its own custom skeleton that matches its actual layout:
 * 
 * - DashboardSkeleton → Home, DepartmentOverview
 * - ListSkeleton → Marksheets
 * - DetailSkeleton → MarksheetDetails
 * - FormSkeleton → ImportMarks
 * - DispatchRequestsSkeleton → DispatchRequests (Staff)
 * - ApprovalRequestsSkeleton → ApprovalRequests (HOD)
 * - RecordsSkeleton → Records
 * - TableSkeleton → Reports
 * - FAQSkeleton → FAQ
 * - PrivacySkeleton → Privacy Policy
 * - TermsSkeleton → Terms of Service
 * - ContactSkeleton → Contact
 * - SimpleSkeleton → NotFound, 404 errors
 */

// Dashboard skeleton for Home and DepartmentOverview
export function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-gray-100 rounded w-1/2"></div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
            <div className="h-8 bg-gray-300 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
          </div>
        ))}
      </div>
      
      {/* Recent Activity Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// List skeleton for Marksheets page only
export function ListSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4 animate-pulse">
      {/* Header with search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div>
          <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-100 rounded w-64"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
      
      {/* Filter/Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 h-12 bg-gray-200 rounded-xl"></div>
        <div className="h-12 bg-gray-200 rounded-xl w-32"></div>
      </div>
      
      {/* List items */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="h-6 bg-gray-300 rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-gray-100 rounded w-1/3"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded-full w-24"></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((j) => (
                <div key={j}>
                  <div className="h-3 bg-gray-100 rounded w-16 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Detail skeleton for MarksheetDetails
export function DetailSkeleton() {
  return (
    <div className="p-4 md:p-6 animate-pulse">
      {/* Back button */}
      <div className="h-10 bg-gray-200 rounded w-32 mb-6"></div>
      
      {/* Main card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="h-8 bg-gray-300 rounded w-2/3 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
            <div className="h-10 bg-gray-300 rounded-full w-32"></div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-5 bg-gray-300 rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Student info */}
          <div>
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i}>
                  <div className="h-3 bg-gray-100 rounded w-20 mb-2"></div>
                  <div className="h-5 bg-gray-200 rounded w-32"></div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Subjects table */}
          <div>
            <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 p-4 border-b">
                <div className="flex gap-4">
                  <div className="h-4 bg-gray-300 rounded w-32"></div>
                  <div className="h-4 bg-gray-300 rounded w-24"></div>
                  <div className="h-4 bg-gray-300 rounded w-24"></div>
                </div>
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 border-b last:border-b-0">
                  <div className="flex gap-4">
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <div className="h-12 bg-gray-200 rounded-xl w-32"></div>
            <div className="h-12 bg-gray-200 rounded-xl w-32"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Form skeleton for ImportMarks page only
export function FormSkeleton() {
  return (
    <div className="p-4 md:p-6 animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-gray-100 rounded w-1/2"></div>
      </div>
      
      {/* Form card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-2xl">
        <div className="space-y-6">
          {/* Form fields */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-4 bg-gray-200 rounded w-32 mb-3"></div>
              <div className="h-12 bg-gray-100 rounded-xl"></div>
            </div>
          ))}
          
          {/* File upload area */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4"></div>
              <div className="h-5 bg-gray-200 rounded w-48 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-64 mx-auto"></div>
            </div>
          </div>
          
          {/* Submit button */}
          <div className="flex gap-3 pt-4">
            <div className="h-12 bg-gray-300 rounded-xl flex-1"></div>
            <div className="h-12 bg-gray-200 rounded-xl w-32"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Dispatch Requests skeleton with tabs, filters, and action buttons
export function DispatchRequestsSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="h-12 bg-gray-300 rounded w-96 mx-auto mb-4"></div>
            <div className="h-5 bg-gray-200 rounded w-[500px] mx-auto mb-2"></div>
            <div className="h-5 bg-gray-200 rounded w-[450px] mx-auto"></div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6">
            <div className="h-10 bg-gray-300 rounded-lg w-32"></div>
            <div className="h-10 bg-gray-200 rounded-lg w-32"></div>
          </div>

          {/* Action Bar with Bulk Actions */}
          <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              <div className="h-10 bg-gray-300 rounded-lg w-28"></div>
              <div className="h-10 bg-gray-200 rounded-lg w-28"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 bg-blue-200 rounded-lg w-36"></div>
              <div className="h-10 bg-green-200 rounded-lg w-32"></div>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-gray-200 rounded-lg w-24"></div>
            ))}
          </div>

          {/* Marksheet Cards */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Card Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="h-6 bg-gray-300 rounded w-48 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-64"></div>
                    </div>
                    <div className="h-8 bg-yellow-100 rounded-full w-32"></div>
                  </div>
                  
                  {/* Info Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j}>
                        <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
                        <div className="h-5 bg-gray-300 rounded w-20"></div>
                      </div>
                    ))}
                  </div>

                  {/* HOD Response Section (if rescheduled/rejected) */}
                  {i === 2 && (
                    <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="h-4 bg-orange-200 rounded w-32 mb-2"></div>
                      <div className="h-4 bg-orange-100 rounded w-full"></div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100"></div>

                {/* Action Buttons */}
                <div className="p-6 pt-4 bg-gray-50">
                  <div className="flex flex-wrap gap-2">
                    <div className="h-10 bg-blue-200 rounded-lg w-32"></div>
                    <div className="h-10 bg-green-200 rounded-lg w-28"></div>
                    <div className="h-10 bg-gray-200 rounded-lg w-24"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Approval Requests skeleton with bulk actions and swipeable cards
export function ApprovalRequestsSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="h-12 bg-gray-300 rounded w-96 mx-auto mb-4"></div>
            <div className="h-5 bg-gray-200 rounded w-[450px] mx-auto"></div>
          </div>

          {/* Main Card */}
          <div className="bg-white/60 backdrop-blur-sm p-6 md:p-8 rounded-3xl shadow-sm">
            {/* Filter Buttons and Bulk Actions */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex gap-2 flex-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded-lg w-24"></div>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="h-10 bg-green-200 rounded-lg w-28"></div>
                <div className="h-10 bg-orange-200 rounded-lg w-32"></div>
                <div className="h-10 bg-red-200 rounded-lg w-28"></div>
              </div>
            </div>

            {/* Request Cards */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Header Section */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div className="flex-1">
                        <div className="h-6 bg-gray-300 rounded w-48 mb-2"></div>
                        <div className="flex items-center gap-2">
                          <div className="h-4 bg-gray-200 rounded w-40"></div>
                          <div className="h-5 bg-blue-100 rounded-full w-16"></div>
                        </div>
                      </div>
                      <div className="h-8 bg-yellow-100 rounded-full w-28"></div>
                    </div>
                    
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j}>
                          <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
                          <div className="h-5 bg-gray-300 rounded w-24"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100"></div>
                  
                  {/* Action Buttons Section */}
                  <div className="p-6 pt-4 bg-gray-50">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="h-10 bg-green-200 rounded-lg"></div>
                      <div className="h-10 bg-red-200 rounded-lg"></div>
                      <div className="h-10 bg-yellow-200 rounded-lg"></div>
                      <div className="h-10 bg-gray-200 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Records page skeleton with stats, search, filters, and examination cards
export function RecordsSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-6 md:py-8 animate-pulse">
        <div className="max-w-7xl mx-auto">
          {/* Header Section with Stats */}
          <div className="mb-6 md:mb-8">
            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="h-10 bg-gray-300 rounded w-80 mb-2"></div>
                  <div className="h-5 bg-gray-200 rounded w-96"></div>
                </div>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:flex gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white/80 px-3 py-2 rounded-xl">
                      <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
                      <div className="h-7 bg-gray-300 rounded w-12"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Card */}
          <div className="bg-white/60 backdrop-blur-sm p-6 md:p-8 rounded-3xl shadow-sm space-y-8">
            {/* Search Bar */}
            <div>
              <div className="relative max-w-2xl">
                <div className="h-12 bg-gray-200 rounded-xl"></div>
              </div>
            </div>

            {/* Examination Filter */}
            <div>
              <div className="h-6 bg-gray-300 rounded w-48 mb-4"></div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded-lg w-32"></div>
                ))}
              </div>
            </div>

            {/* Examination Overview Cards */}
            <div>
              <div className="h-6 bg-gray-300 rounded w-56 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 bg-gray-300 rounded w-32"></div>
                        <div className="h-4 w-4 bg-gray-200 rounded"></div>
                      </div>
                      <div className="h-8 bg-gray-300 rounded w-16 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-28"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Marksheet List */}
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/80 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="h-6 bg-gray-300 rounded w-48 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-64"></div>
                    </div>
                    <div className="h-8 bg-gray-200 rounded-full w-24"></div>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j}>
                        <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
                        <div className="h-5 bg-gray-300 rounded w-20"></div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <div className="h-10 bg-gray-200 rounded-lg w-24"></div>
                    <div className="h-10 bg-gray-200 rounded-lg w-32"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Table skeleton for Reports page only
export function TableSkeleton() {
  return (
    <div className="p-4 md:p-6 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-100 rounded w-64"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-10 bg-gray-100 rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table header */}
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-6 gap-4 p-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-4 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
        
        {/* Table rows */}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="border-b border-gray-100 last:border-b-0">
            <div className="grid grid-cols-6 gap-4 p-4">
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <div key={j} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Pagination */}
      <div className="flex justify-between items-center mt-6">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-10 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

// FAQ skeleton with accordion categories
export function FAQSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-6"></div>
            <div className="h-12 bg-gray-300 rounded w-96 mx-auto mb-4"></div>
            <div className="h-5 bg-gray-200 rounded w-64 mx-auto mb-2"></div>
            <div className="h-5 bg-gray-200 rounded w-80 mx-auto"></div>
          </div>

          {/* FAQ Categories */}
          <div className="space-y-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden">
                {/* Category Header */}
                <div className={`bg-gradient-to-r ${i % 4 === 0 ? 'from-blue-600 to-blue-700' : i % 4 === 1 ? 'from-green-600 to-green-700' : i % 4 === 2 ? 'from-purple-600 to-purple-700' : 'from-orange-600 to-orange-700'} px-6 py-6`}>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-white/30 rounded"></div>
                    <div className="h-7 bg-white/30 rounded w-48"></div>
                  </div>
                </div>

                {/* Questions */}
                <div className="divide-y divide-gray-200">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-5 bg-gray-300 rounded w-3/4"></div>
                        <div className="w-5 h-5 bg-gray-200 rounded"></div>
                      </div>
                      <div className="h-4 bg-gray-100 rounded w-full mt-3"></div>
                      <div className="h-4 bg-gray-100 rounded w-5/6 mt-2"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Privacy Policy skeleton with colored sections
export function PrivacySkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-6"></div>
            <div className="h-12 bg-gray-300 rounded w-80 mx-auto mb-4"></div>
            <div className="h-5 bg-gray-200 rounded w-64 mx-auto"></div>
          </div>

          {/* Content Card */}
          <div className="bg-white/60 backdrop-blur-sm p-8 rounded-3xl shadow-2xl space-y-8">
            {/* Sections with colored borders */}
            {[
              { color: 'blue' },
              { color: 'green' },
              { color: 'purple' },
              { color: 'orange' },
              { color: 'red' },
              { color: 'indigo' }
            ].map((section, i) => (
              <div key={i} className={`border-l-4 border-${section.color}-500 pl-6`}>
                <div className="h-7 bg-gray-300 rounded w-64 mb-4"></div>
                
                {i === 1 || i === 2 ? (
                  /* Info boxes for certain sections */
                  <div className="space-y-4">
                    <div className={`bg-${section.color}-50 p-5 rounded-xl`}>
                      <div className="h-5 bg-gray-300 rounded w-48 mb-3"></div>
                      <div className="space-y-2">
                        {[1, 2, 3, 4].map((j) => (
                          <div key={j} className="h-4 bg-gray-200 rounded w-full"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Regular text content */
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-11/12"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Terms of Service skeleton
export function TermsSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-indigo-100 rounded-full mx-auto mb-6"></div>
            <div className="h-12 bg-gray-300 rounded w-96 mx-auto mb-4"></div>
            <div className="h-5 bg-gray-200 rounded w-64 mx-auto mb-2"></div>
            <div className="h-5 bg-gray-200 rounded w-48 mx-auto"></div>
          </div>

          {/* Content Card */}
          <div className="bg-white/60 backdrop-blur-sm p-8 rounded-3xl shadow-2xl space-y-8">
            {/* Sections */}
            {[
              { color: 'indigo', hasHighlight: true },
              { color: 'blue', hasCards: true },
              { color: 'green', hasBoxes: true },
              { color: 'purple', hasBoxes: true },
              { color: 'red' },
              { color: 'orange' }
            ].map((section, i) => (
              <div key={i} className={`border-l-4 border-${section.color}-500 pl-6 ${section.hasHighlight ? 'bg-indigo-50 rounded-r-lg py-4 pr-6' : ''}`}>
                <div className="h-7 bg-gray-300 rounded w-80 mb-4"></div>
                
                {section.hasCards ? (
                  /* Card-style items */
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className={`flex items-start gap-3 bg-${section.color}-50 p-4 rounded-lg border-l-4 border-${section.color}-400`}>
                        <div className="w-6 h-6 bg-gray-300 rounded"></div>
                        <div className="flex-1 h-4 bg-gray-300 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : section.hasBoxes ? (
                  /* Info boxes */
                  <div className={`bg-${section.color}-50 border border-${section.color}-200 rounded-xl p-5`}>
                    <div className="h-6 bg-gray-300 rounded w-48 mb-4"></div>
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="bg-white p-3 rounded-lg">
                          <div className="h-4 bg-gray-200 rounded w-full"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Regular text */
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-11/12"></div>
                    <div className="h-4 bg-gray-200 rounded w-10/12"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Contact page skeleton - three column layout with MSEC Connect, Quick Links, Support
export function ContactSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="h-12 bg-gray-300 rounded w-64 mx-auto mb-4"></div>
            <div className="h-5 bg-gray-200 rounded w-96 mx-auto mb-2"></div>
            <div className="h-5 bg-gray-200 rounded w-80 mx-auto"></div>
          </div>
          
          {/* Three Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* MSEC Connect Section */}
            <div className="bg-white/60 backdrop-blur-sm p-8 rounded-3xl shadow-2xl">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4"></div>
                <div className="h-7 bg-gray-300 rounded w-48 mx-auto mb-4"></div>
                <div className="space-y-2 mb-6">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6 mx-auto"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/5 mx-auto"></div>
                </div>
              </div>
              
              {/* Social Icons */}
              <div className="flex justify-center gap-4 mt-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>

            {/* Quick Links Section */}
            <div className="bg-white/60 backdrop-blur-sm p-8 rounded-3xl shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4"></div>
                <div className="h-7 bg-gray-300 rounded w-32 mx-auto mb-6"></div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-100">
                    <div className="w-5 h-5 bg-gray-300 rounded"></div>
                    <div className="h-4 bg-gray-300 rounded w-32"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Support Section */}
            <div className="bg-white/60 backdrop-blur-sm p-8 rounded-3xl shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full mx-auto mb-4"></div>
                <div className="h-7 bg-gray-300 rounded w-24 mx-auto mb-6"></div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-100">
                    <div className="w-5 h-5 bg-gray-300 rounded"></div>
                    <div className="h-4 bg-gray-300 rounded w-32"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Simple skeleton for NotFound and other simple pages
export function SimpleSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4 animate-pulse">
      <div className="text-center">
        <div className="w-32 h-32 bg-gray-200 rounded-full mx-auto mb-6"></div>
        <div className="h-10 bg-gray-300 rounded w-64 mx-auto mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-96 mx-auto mb-8"></div>
        <div className="h-12 bg-gray-300 rounded-xl w-48 mx-auto"></div>
      </div>
    </div>
  )
}
