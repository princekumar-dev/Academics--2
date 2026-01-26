/**
 * Utility to ensure body scrolling is never permanently blocked
 * This runs on page load and periodically checks if body overflow is stuck
 */

export function ensureBodyScrollable() {
    // Force body to be scrollable immediately
    const forceScrollable = () => {
        // Reset body overflow
        if (document.body.style.overflow === 'hidden') {
            const hasOpenModal = document.querySelector('[role="dialog"]') ||
                document.querySelector('.modal') ||
                document.querySelector('[data-modal-open="true"]')

            if (!hasOpenModal) {
                console.warn('Body overflow was stuck as hidden, fixing...')
                document.body.style.overflow = ''
            }
        }

        // Ensure html and body have proper styles for scrolling
        document.documentElement.style.height = 'auto'
        document.documentElement.style.minHeight = '100%'
        document.documentElement.style.overflowY = 'auto'
        document.documentElement.style.overflowX = 'hidden'

        if (document.body.style.overflow !== 'hidden') {
            document.body.style.height = 'auto'
            document.body.style.minHeight = '100%'
            document.body.style.overflowY = 'auto'
            document.body.style.overflowX = 'hidden'
        }

        // Remove any CSS that might block scrolling
        document.documentElement.style.touchAction = 'auto'
        document.body.style.touchAction = 'auto'

        // Aggressive fix: Reset touch-action on all elements if needed
        // This fixes issues where some UI libraries set touch-action: none globally
        const styleId = 'force-scroll-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
            * { 
                touch-action: pan-y !important; 
                overscroll-behavior: auto !important; 
            }
            .no-scroll {
                touch-action: none !important;
            }
        `;
            document.head.appendChild(style);
        }
    }

    // Run immediately
    forceScrollable()

    // Run again after a short delay to catch any late-loading styles
    setTimeout(forceScrollable, 100)
    setTimeout(forceScrollable, 500)
    setTimeout(forceScrollable, 1000)
    setTimeout(forceScrollable, 2000)

    // Check periodically (every 2 seconds) as a safeguard
    const interval = setInterval(forceScrollable, 2000)

    // Return cleanup function
    return () => clearInterval(interval)
}

// Auto-run on module load - IMMEDIATE FIX
if (typeof window !== 'undefined') {
    // Run immediately when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.style.overflow = ''
            document.body.style.overflowY = 'auto'
            document.body.style.height = 'auto'
            document.body.style.minHeight = '100%'
            document.documentElement.style.height = 'auto'
            document.documentElement.style.minHeight = '100%'
            document.documentElement.style.overflowY = 'auto'
        })
    } else {
        // DOM already loaded
        document.body.style.overflow = ''
        document.body.style.overflowY = 'auto'
        document.body.style.height = 'auto'
        document.body.style.minHeight = '100%'
        document.documentElement.style.height = 'auto'
        document.documentElement.style.minHeight = '100%'
        document.documentElement.style.overflowY = 'auto'
    }

    // Additional fix: Ensure scroll events work after React loads
    window.addEventListener('load', () => {
        setTimeout(() => {
            document.body.style.overflow = ''
            document.body.style.overflowY = 'auto'
            document.documentElement.style.overflowY = 'auto'

            // Force a reflow to ensure browser recognizes the changes
            void document.body.offsetHeight
        }, 100)
    })
}
