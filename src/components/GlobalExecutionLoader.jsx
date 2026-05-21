import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

function GlobalExecutionLoader() {
  const [apiCount, setApiCount] = useState(0)
  const [navActive, setNavActive] = useState(false)
  const [percent, setPercent] = useState(0)
  const location = useLocation()

  // 1. Trigger beautiful golden top-line loading effect on every page/route change (navigation)
  useEffect(() => {
    // Start navigation progress
    setNavActive(true)
    setPercent(20)

    const t1 = setTimeout(() => {
      setPercent(55)
    }, 100)

    const t2 = setTimeout(() => {
      setPercent(85)
    }, 250)

    const t3 = setTimeout(() => {
      setPercent(100)
      setNavActive(false)
      const t4 = setTimeout(() => {
        setPercent(0)
      }, 350)
      return () => clearTimeout(t4)
    }, 500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [location.key, location.pathname, location.search])

  // 2. Track global API requests via custom events from apiClient.js
  useEffect(() => {
    let safetyTimer = null

    const handleProgress = (e) => {
      const count = e.detail?.count || 0
      
      // Clear safety timer on any new progress update
      if (safetyTimer) clearTimeout(safetyTimer)

      setApiCount(count)

      if (count > 0) {
        setPercent((prev) => (prev < 40 ? 50 : prev < 75 ? prev + 10 : 85))

        // Safety fallback: if request takes longer than 25s (e.g. hung request, closed page),
        // automatically fade out the loading indicators so the user is never stuck.
        safetyTimer = setTimeout(() => {
          setApiCount(0)
          setPercent(100)
          setTimeout(() => setPercent(0), 400)
        }, 25000)
      } else {
        // Smoothly finish loader
        setPercent(100)
        const timer = setTimeout(() => {
          setPercent(0)
        }, 400)
        return () => clearTimeout(timer)
      }
    }

    window.addEventListener('apiProgress', handleProgress)
    return () => {
      window.removeEventListener('apiProgress', handleProgress)
      if (safetyTimer) clearTimeout(safetyTimer)
    }
  }, [])

  // 3. Auto-increment simulated progress when active
  useEffect(() => {
    if (apiCount === 0 && !navActive) return

    const interval = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 95) return 95
        const step = prev < 50 ? 5 : prev < 80 ? 2 : 1
        return prev + step
      })
    }, 450)

    return () => clearInterval(interval)
  }, [apiCount, navActive])

  // Determine if loader is active or in final fade-out
  const isVisible = apiCount > 0 || navActive || percent > 0

  if (!isVisible) return null

  return (
    <>
      <style>{`
        /* Golden top line loader animation */
        @keyframes goldShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .gold-top-loader {
          position: fixed;
          top: 0;
          left: 0;
          height: 3px;
          z-index: 99999;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
          background: linear-gradient(90deg, #d4af37, #f3e5ab, #aa7c11, #d4af37);
          background-size: 300% 100%;
          animation: goldShimmer 2s linear infinite;
          box-shadow: 0 0 10px rgba(212, 175, 55, 0.8), 0 0 18px rgba(170, 124, 17, 0.5);
        }
        
        /* Premium Golden Radial Glow Effect */
        .gold-screen-glow {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 99998;
          pointer-events: none;
          opacity: 0.15;
          background: radial-gradient(circle at top, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.06) 50%, transparent 80%);
          animation: goldPulse 2.5s ease-in-out infinite alternate;
          transition: opacity 0.5s ease;
        }

        @keyframes goldPulse {
          0% { opacity: 0.10; }
          100% { opacity: 0.25; }
        }

        /* Micro Glassmorphic Processing Tag */
        .processing-tag {
          position: fixed;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 99999;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(212, 175, 55, 0.4);
          box-shadow: 0 8px 32px rgba(212, 175, 55, 0.18), 0 2px 10px rgba(0,0,0,0.06);
          font-size: 13px;
          font-weight: 600;
          color: #8c6b12;
          animation: slideUpFade 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Float above BottomNav on mobile */
        @media (max-width: 768px) {
          .processing-tag {
            bottom: 84px;
            padding: 6px 16px;
            font-size: 12px;
          }
        }

        @keyframes slideUpFade {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        
        .gold-spin-micro {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(212, 175, 55, 0.2);
          border-top: 2px solid #d4af37;
          border-radius: 50%;
          animation: spinMicro 0.8s linear infinite;
        }

        @keyframes spinMicro {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* 1. Golden Line Loader */}
      <div 
        className="gold-top-loader" 
        style={{ 
          width: `${percent}%`,
          opacity: percent > 0 && percent < 100 ? 1 : 0
        }} 
      />

      {/* 2. Golden Screen Radial Glow - only when API execution is active */}
      {apiCount > 0 && (
        <div className="gold-screen-glow" />
      )}

      {/* 3. Modern Processing Indicator Tag - only when API execution is active */}
      {apiCount > 0 && (
        <div className="processing-tag">
          <div className="gold-spin-micro" />
          <span>Processing...</span>
        </div>
      )}
    </>
  )
}

export default GlobalExecutionLoader
