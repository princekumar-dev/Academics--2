import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import {
  DashboardSkeleton,
  ListSkeleton,
  DetailSkeleton,
  FormSkeleton,
  RecordsSkeleton,
  DispatchRequestsSkeleton,
  ApprovalRequestsSkeleton,
  TableSkeleton,
  FAQSkeleton,
  PrivacySkeleton,
  TermsSkeleton,
  ContactSkeleton,
  SimpleSkeleton,
  LoginSkeleton,
  SignUpSkeleton
} from './components/PageSkeletons'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import { AlertProvider } from './components/AlertContext'
import apiClient from './utils/apiClient'
import { ensureBodyScrollable } from './utils/scrollFix'
import { getAuthOrNull } from './utils/auth'
// Removed old notification imports for academic system

// Lazy load components for better performance
const Home = lazy(() => import('./pages/Home'))
const ImportMarks = lazy(() => import('./pages/ImportMarks'))
const Marksheets = lazy(() => import('./pages/Marksheets'))
const MarksheetDetails = lazy(() => import('./pages/MarksheetDetails'))
const DispatchRequests = lazy(() => import('./pages/DispatchRequests'))
const Records = lazy(() => import('./pages/Records'))
const DepartmentOverview = lazy(() => import('./pages/DepartmentOverview'))
const ApprovalRequests = lazy(() => import('./pages/ApprovalRequests'))
const Reports = lazy(() => import('./pages/Reports'))
const Login = lazy(() => import('./pages/Login'))
const SignUp = lazy(() => import('./pages/SignUp'))
const Contact = lazy(() => import('./pages/Contact'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const Leave = lazy(() => import('./pages/Leave'))
const LeaveApprovals = lazy(() => import('./pages/LeaveApprovals'))
const LateAcknowledgment = lazy(() => import('./pages/LateAcknowledgment'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const FAQ = lazy(() => import('./pages/FAQ'))
const NotFound = lazy(() => import('./pages/NotFound'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

// Root route handler - checks auth and redirects accordingly
const RootRedirect = () => {
  const parsed = getAuthOrNull()
  if (!parsed) return <Navigate to="/login" replace />
  if (parsed.role === 'student') return <Navigate to="/student" replace />
  if (parsed.role === 'admin') return <Navigate to="/admin-dashboard" replace />
  return <Navigate to="/home" replace />
}

// Protected route wrapper for home/dashboard
const ProtectedHome = () => {
  const parsed = getAuthOrNull()
  if (!parsed) return <Navigate to="/login" replace />
  if (parsed.role === 'student') return <Navigate to="/student" replace />
  if (parsed.role === 'admin') return <Navigate to="/admin-dashboard" replace />
  return <Home />
}

const ProtectedStudent = () => {
  const parsed = getAuthOrNull()
  if (!parsed) return <Navigate to="/login" replace />
  if (parsed.role !== 'student') return <Navigate to="/home" replace />
  return <StudentDashboard />
}

const ProtectedAdmin = () => {
  const parsed = getAuthOrNull()
  if (!parsed) return <Navigate to="/login" replace />
  if (parsed.role !== 'admin') return <Navigate to="/home" replace />
  return <AdminDashboard />
}

// Staff or HOD only - redirects students and unauthenticated users
const ProtectedStaffOrHod = ({ children }) => {
  const parsed = getAuthOrNull()
  if (!parsed) return <Navigate to="/login" replace />
  if (parsed.role === 'student') return <Navigate to="/student" replace />
  if (parsed.role === 'admin') return <Navigate to="/admin-dashboard" replace />
  if (parsed.role !== 'staff' && parsed.role !== 'hod') return <Navigate to="/home" replace />
  return children
}

// Redirect to dashboard if already authenticated (for Login/SignUp)
const RedirectIfAuthenticated = ({ children }) => {
  const parsed = getAuthOrNull()
  if (!parsed) return children
  if (parsed.role === 'student') return <Navigate to="/student" replace />
  if (parsed.role === 'admin') return <Navigate to="/admin-dashboard" replace />
  return <Navigate to="/home" replace />
}

function AppContent() {
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'

  // Remove body background when not on auth pages
  useEffect(() => {
    if (!isAuthPage) {
      document.body.style.backgroundImage = 'none'
    } else {
      // Prefer AVIF/WebP via CSS image-set when supported; fallback to WebP/JPEG
      try {
        const avifImageSet = "image-set(url('/images/campus.avif') type('image/avif') 1x, url('/images/campus.webp') type('image/webp') 1x, url('/images/campus.jpeg') 1x)"
        if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('background-image', avifImageSet)) {
          document.body.style.backgroundImage = avifImageSet
        } else if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('background-image', "url('/images/campus.webp')")) {
          document.body.style.backgroundImage = "url('/images/campus.webp')"
        } else {
          document.body.style.backgroundImage = "url('/images/campus.jpeg')"
        }
      } catch (e) {
        document.body.style.backgroundImage = "url('/images/campus.jpeg')"
      }
    }
  }, [isAuthPage])

  // Ping both backend servers on load to wake up Render services
  useEffect(() => {
    // Ping local API (Vercel proxy)
    apiClient.get('/api/generate-pdf?test=true').catch(() => { })
    // Removed unreachable Academics backend health check
    // Removed unreachable Evolution API health check
  }, [])

  return (
    <>
      <div
        className={`flex w-full flex-col ${isAuthPage ? 'relative' : ''}`}
        style={{
          fontFamily: 'Inter, Manrope, sans-serif',
          WebkitOverflowScrolling: 'touch',
          minHeight: '100vh',
          height: 'auto',
          overflow: 'visible',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        {isAuthPage && <div className="fixed inset-0 bg-black/40 z-0 pointer-events-none"></div>}
        <div className={`layout-container flex min-h-screen flex-col max-w-full ${isAuthPage ? 'relative z-10' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
          <Header />
          <div className="flex flex-1 justify-center w-full">
            <div className={`layout-content-container flex flex-col w-full max-w-full ${!isAuthPage ? 'pb-20 md:pb-0' : ''}`}>
              <Routes>
                {/* Root path - redirects based on auth status */}
                <Route path="/" element={<RootRedirect />} />
                {/* Home/Dashboard - protected route */}
                <Route path="/home" element={<Suspense fallback={<DashboardSkeleton />}><ProtectedHome /></Suspense>} />
                <Route path="/student" element={<Suspense fallback={<DashboardSkeleton />}><ProtectedStudent /></Suspense>} />
                <Route path="/admin-dashboard" element={<Suspense fallback={<DashboardSkeleton />}><ProtectedAdmin /></Suspense>} />
                <Route path="/leave" element={<Suspense fallback={<FormSkeleton />}><Leave /></Suspense>} />
                {/* Staff/HOD Routes - protected by role */}
                <Route path="/import-marks" element={<Suspense fallback={<FormSkeleton />}><ProtectedStaffOrHod><ImportMarks /></ProtectedStaffOrHod></Suspense>} />
                <Route path="/marksheets" element={<Suspense fallback={<ListSkeleton />}><ProtectedStaffOrHod><Marksheets /></ProtectedStaffOrHod></Suspense>} />
                <Route path="/marksheets/:id" element={<Suspense fallback={<DetailSkeleton />}><ProtectedStaffOrHod><MarksheetDetails /></ProtectedStaffOrHod></Suspense>} />
                <Route path="/dispatch-requests" element={<Suspense fallback={<DispatchRequestsSkeleton />}><ProtectedStaffOrHod><DispatchRequests /></ProtectedStaffOrHod></Suspense>} />
                <Route path="/records" element={<Suspense fallback={<RecordsSkeleton />}><ProtectedStaffOrHod><Records /></ProtectedStaffOrHod></Suspense>} />
                <Route path="/department-overview" element={<Suspense fallback={<DashboardSkeleton />}><ProtectedStaffOrHod><DepartmentOverview /></ProtectedStaffOrHod></Suspense>} />
                <Route path="/approval-requests" element={<Suspense fallback={<ApprovalRequestsSkeleton />}><ProtectedStaffOrHod><ApprovalRequests /></ProtectedStaffOrHod></Suspense>} />
                <Route path="/leave-approvals" element={<Suspense fallback={<ApprovalRequestsSkeleton />}><ProtectedStaffOrHod><LeaveApprovals /></ProtectedStaffOrHod></Suspense>} />
                <Route path="/late-acknowledgment" element={<Suspense fallback={<ListSkeleton />}><ProtectedStaffOrHod><LateAcknowledgment /></ProtectedStaffOrHod></Suspense>} />
                <Route path="/reports" element={<Suspense fallback={<TableSkeleton />}><ProtectedStaffOrHod><Reports /></ProtectedStaffOrHod></Suspense>} />
                {/* Auth Routes - redirect to dashboard if already logged in */}
                <Route path="/login" element={<Suspense fallback={<LoginSkeleton />}><RedirectIfAuthenticated><Login /></RedirectIfAuthenticated></Suspense>} />
                <Route path="/signup" element={<Suspense fallback={<SignUpSkeleton />}><RedirectIfAuthenticated><SignUp /></RedirectIfAuthenticated></Suspense>} />
                {/* General Routes */}
                <Route path="/contact" element={<Suspense fallback={<ContactSkeleton />}><Contact /></Suspense>} />
                <Route path="/privacy-policy" element={<Suspense fallback={<PrivacySkeleton />}><PrivacyPolicy /></Suspense>} />
                <Route path="/terms-of-service" element={<Suspense fallback={<TermsSkeleton />}><TermsOfService /></Suspense>} />
                <Route path="/faq" element={<Suspense fallback={<FAQSkeleton />}><FAQ /></Suspense>} />
                {/* Fallback route for 404 */}
                <Route path="*" element={<Suspense fallback={<SimpleSkeleton />}><NotFound /></Suspense>} />
              </Routes>
            </div>
          </div>
        </div>
      </div>
      {!isAuthPage && <BottomNav />}
    </>
  )
}

function App() {
  // Opt-in to React Router v7 future flags
  const futureFlags = {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }

  // Ensure body scrolling is never permanently blocked
  useEffect(() => {
    const cleanup = ensureBodyScrollable()
    return cleanup
  }, [])

  return (
    <ErrorBoundary>
      <AlertProvider>
        <BrowserRouter future={futureFlags}>
          <AppContent />
        </BrowserRouter>
      </AlertProvider>
    </ErrorBoundary>
  )
}

export default App