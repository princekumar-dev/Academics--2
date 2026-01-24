import apiClient from './apiClient'

class PushNotificationManager {
  constructor() {
    this.registration = null;
    this.subscription = null;
  }

  // Check if browser supports notifications
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // Get current permission status
  getPermission() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  // Request notification permission with Windows compatibility
  async requestPermission() {
    if (!this.isSupported()) {
      console.warn('Push notifications are not supported in this browser');
      alert('⚠️ Your browser does not support notifications.\n\nPlease use Chrome, Edge, or Firefox.');
      return false;
    }

    try {
      // Check current permission first
      if (Notification.permission === 'granted') {
        console.log('✅ Notification permission already granted');
        return true;
      }

      if (Notification.permission === 'denied') {
        console.warn('❌ Notifications are blocked. Please enable them in browser settings.');
        // For Windows Chrome/Edge: Guide user to browser settings
        const isChrome = navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Edge');
        const isEdge = navigator.userAgent.includes('Edg'); // Edge uses 'Edg' in user agent
        
        let instructions = '❌ Notifications are blocked!\n\nTo enable notifications:\n\n';
        
        if (isEdge) {
          instructions += '1. Click the 🔒 lock icon in the address bar\n';
          instructions += '2. Click "Permissions for this site"\n';
          instructions += '3. Find "Notifications" and select "Allow"\n';
          instructions += '4. Refresh the page';
        } else if (isChrome) {
          instructions += '1. Click the 🔒 lock icon in the address bar\n';
          instructions += '2. Click "Site settings"\n';
          instructions += '3. Find "Notifications" and select "Allow"\n';
          instructions += '4. Refresh the page';
        } else {
          instructions += 'Go to Settings > Privacy > Notifications\nand allow notifications for this site.';
        }
        
        alert(instructions);
        return false;
      }

      console.log('📢 Requesting notification permission...');
      
      // Request permission - Windows desktop needs user interaction
      const permission = await Notification.requestPermission();
      console.log('Notification permission result:', permission);
      
      if (permission === 'granted') {
        console.log('✅ Notification permission granted!');
        
        // Test notification on Windows/Desktop to ensure it works
        const isWindows = navigator.platform.includes('Win') || navigator.userAgent.includes('Windows');
        if (isWindows) {
          console.log('🪟 Windows detected - sending test notification...');
          setTimeout(() => {
            this.showTestNotification();
          }, 500); // Reduced delay for better UX
        }
        return true;
      } else if (permission === 'denied') {
        console.warn('❌ User denied notification permission');
        alert('⚠️ Notifications were blocked.\n\nYou won\'t receive event reminders.\nYou can enable them later in Settings.');
        return false;
      } else {
        console.log('ℹ️ User dismissed notification permission request');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      alert('⚠️ Error enabling notifications: ' + error.message);
      return false;
    }
  }

  // Test notification for Windows desktop - enhanced for Chrome/Edge
  showTestNotification() {
    if (Notification.permission === 'granted') {
      try {
        // For desktop browsers, use direct Notification API for immediate test
        const notification = new Notification('🎉 Notifications Enabled!', {
          body: 'MSEC Academics notifications are working!\nYou will receive event reminders here.',
          icon: '/images/android-chrome-192x192.png',
          badge: '/images/favicon-32x32.png',
          tag: 'test-notification-' + Date.now(), // Unique tag to avoid replacement
          requireInteraction: false,
          silent: false,
          timestamp: Date.now(),
          vibrate: [200, 100, 200], // Vibrate pattern for mobile
          // Windows-specific options
          renotify: true, // Always show notification
          dir: 'auto', // Text direction
          lang: 'en-US' // Language
        });

        // Handle notification click
        notification.onclick = function(event) {
          event.preventDefault();
          window.focus();
          notification.close();
        };

        // Auto-close after 5 seconds on desktop
        setTimeout(() => {
          notification.close();
        }, 5000);

        console.log('✅ Test notification sent successfully');
      } catch (error) {
        console.error('❌ Error showing test notification:', error);
        // Fallback: try service worker method
        if (this.registration) {
          this.registration.showNotification('🎉 Notifications Enabled!', {
            body: 'MSEC Academics notifications are working!',
            icon: '/images/android-chrome-192x192.png',
            tag: 'test-notification-' + Date.now()
          });
        }
      }
    }
  }

  // Register service worker
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered:', registration);
      this.registration = registration;

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('Service Worker is ready');

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  // Get VAPID public key from server
  async getVapidPublicKey() {
    try {
      const data = await apiClient.get('/api/notifications/vapid-public-key')
      if (data && data.publicKey) return data.publicKey
      console.warn('Failed to fetch VAPID key from server, using fallback')
      return 'BI3ZQwdtuxxYpepMvZjy5xkuzLbnsjG8J1jfBkGMi0AzbhWDocIASZkq6ocisfwCTnYCHuogo_O-PJSuyfGWwkU'
    } catch (error) {
      console.error('Error fetching VAPID key:', error)
      return 'BI3ZQwdtuxxYpepMvZjy5xkuzLbnsjG8J1jfBkGMi0AzbhWDocIASZkq6ocisfwCTnYCHuogo_O-PJSuyfGWwkU'
    }
  }

  // Subscribe to push notifications
  async subscribe() {
    if (!this.registration) {
      await this.registerServiceWorker();
    }

    if (!this.registration) {
      console.error('Service Worker registration required');
      return null;
    }

    try {
      // Get current user email FIRST to ensure we're subscribing for the right user
      let userEmail = localStorage.getItem('userEmail');
      if (!userEmail) {
        const auth = localStorage.getItem('auth');
        if (auth) {
          try { const authData = JSON.parse(auth); userEmail = authData.email; } catch (e) {}
        }
      }
      if (!userEmail) { alert('Please login again to enable notifications'); return null; }

      // Check if already subscribed (browser-level subscription)
      let subscription = await this.registration.pushManager.getSubscription();
      if (!subscription) {
        const vapidPublicKey = await this.getVapidPublicKey();
        subscription = await this.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey) });
      }

      this.subscription = subscription;
      await this.sendSubscriptionToServer(subscription, userEmail);
      // Persist per-user preference ON
      this.setUserPrefEnabled(true);
      return subscription;
    } catch (error) {
      console.error('❌ Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe() {
    if (!this.subscription) {
      const registration = await navigator.serviceWorker.ready;
      this.subscription = await registration.pushManager.getSubscription();
    }

    if (this.subscription) {
      try {
        await this.subscription.unsubscribe();
        // Remove/expire on server as before
        await this.removeSubscriptionFromServer(this.subscription);
        this.subscription = null;
        // Persist per-user preference OFF
        this.setUserPrefEnabled(false);
        return true;
      } catch (error) {
        console.error('Failed to unsubscribe:', error);
        return false;
      }
    }
    // Ensure preference OFF even if no sub
    this.setUserPrefEnabled(false);
    return false;
  }

  // Send subscription to server (userEmail can be passed explicitly)
  async sendSubscriptionToServer(subscription, userEmail = null) {
    try {
      // If userEmail not provided, try to get from multiple sources
      if (!userEmail) {
        userEmail = localStorage.getItem('userEmail');
        
        // Fallback: try to get from auth object
        if (!userEmail) {
          const auth = localStorage.getItem('auth');
          if (auth) {
            try {
              const authData = JSON.parse(auth);
              userEmail = authData.email;
            } catch (e) {
              console.error('Error parsing auth data:', e);
            }
          }
        }
      }
      
      console.log('💾 Sending subscription to server...', {
        hasSubscription: !!subscription,
        userEmail: userEmail,
        endpoint: subscription?.endpoint?.substring(0, 50) + '...'
      });

      if (!userEmail) {
        console.error('❌ No userEmail found in localStorage');
        alert('Please login again to enable push notifications.');
        return false;
      }

      const data = await apiClient.post('/api/notifications/subscribe', { subscription: subscription, userEmail: userEmail })
      console.log('✅ Subscription sent to server successfully:', data);

      if (data && data.message && data.message.includes('reassigned')) {
        console.log('🔄 This browser subscription was reassigned from a previous user');
      }

      // Treat a truthy success flag as success, otherwise treat as failure
      if (data && (data.success === undefined || data.success)) {
        return true;
      }

      console.error('❌ Failed to send subscription to server:', data);
      return false;
    } catch (error) {
      console.error('❌ Error sending subscription to server:', error);
      return false;
    }
  }

  // Remove subscription from server
  async removeSubscriptionFromServer(subscription) {
    try {
      // Try to get userEmail from multiple sources
      let userEmail = localStorage.getItem('userEmail');
      
      // Fallback: try to get from auth object
      if (!userEmail) {
        const auth = localStorage.getItem('auth');
        if (auth) {
          try {
            const authData = JSON.parse(auth);
            userEmail = authData.email;
          } catch (e) {
            console.error('Error parsing auth data:', e);
          }
        }
      }
      
      console.log('Removing subscription from server...', {
        hasSubscription: !!subscription,
        userEmail: userEmail,
        endpoint: subscription?.endpoint?.substring(0, 50) + '...'
      });

      if (!userEmail) {
        console.error('No userEmail found in localStorage');
        return false;
      }

      try {
        const data = await apiClient.post('/api/notifications/unsubscribe', { endpoint: subscription.endpoint, userEmail: userEmail })
        console.log('Subscription removed from server successfully', data);
        return true
      } catch (err) {
        console.error('Failed to remove subscription:', err)
        return false
      }
    } catch (error) {
      console.error('Error removing subscription from server:', error);
      return false;
    }
  }

  // Show local notification (doesn't require server)
  async showLocalNotification(title, options = {}) {
    try {
      // Ensure we have a service worker registration
      if (!this.registration) {
        console.log('No service worker registration, attempting to register...');
        await this.registerServiceWorker();
      }

      // Double-check permission
      if (Notification.permission !== 'granted') {
        console.log('Notification permission not granted, requesting...');
        const granted = await this.requestPermission();
        if (!granted) {
          console.warn('Notification permission denied');
          throw new Error('Notification permission denied');
        }
      }

      const defaultOptions = {
        body: '',
        icon: '/images/android-chrome-192x192.png',
        badge: '/images/favicon-32x32.png',
        vibrate: [200, 100, 200],
        tag: 'msec-notification-' + Date.now(),
        requireInteraction: false,
        data: {},
        timestamp: Date.now()
      };

      const notificationOptions = { ...defaultOptions, ...options };

      // Always prefer service worker method if available
      if (this.registration && this.registration.showNotification) {
        console.log('Using service worker showNotification');
        await this.registration.showNotification(title, notificationOptions);
      } else if ('serviceWorker' in navigator) {
        // Try to get the registration if we don't have it
        console.log('Attempting to get service worker registration...');
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          console.log('Found service worker registration, using showNotification');
          await registration.showNotification(title, notificationOptions);
        } else {
          console.log('No service worker found, using direct Notification API');
          // Only use direct API as fallback if no service worker is registered
          if ('Notification' in window) {
            new Notification(title, notificationOptions);
          } else {
            throw new Error('Notifications not supported');
          }
        }
      } else {
        console.log('Service worker not supported, using direct Notification API');
        if ('Notification' in window) {
          new Notification(title, notificationOptions);
        } else {
          throw new Error('Notifications not supported');
        }
      }
      
      console.log('Notification displayed successfully');
    } catch (error) {
      console.error('Error showing notification:', error);
      throw error;
    }
  }

  // Helper function to convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Per-user preference stored in localStorage
  getUserPrefEnabled() {
    try {
      const auth = localStorage.getItem('auth');
      const email = localStorage.getItem('userEmail') || (auth ? JSON.parse(auth).email : null);
      if (!email) return null;
      const key = `notifications:${email}:enabled`;
      const val = localStorage.getItem(key);
      if (val === null) return null; // unknown
      return val === 'true';
    } catch { return null; }
  }

  setUserPrefEnabled(enabled) {
    try {
      const auth = localStorage.getItem('auth');
      const email = localStorage.getItem('userEmail') || (auth ? JSON.parse(auth).email : null);
      if (!email) return;
      const key = `notifications:${email}:enabled`;
      localStorage.setItem(key, enabled ? 'true' : 'false');
    } catch {}
  }

  // Initialize notifications on app load
  async initialize() {
    if (!this.isSupported()) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      // Register service worker
      await this.registerServiceWorker();

      // Respect per-user preference: only auto-resync when user previously had notifications ON
      const userPref = this.getUserPrefEnabled();

      if (Notification.permission === 'granted') {
        const existingSubscription = await this.registration?.pushManager.getSubscription();
        if (existingSubscription) {
          this.subscription = existingSubscription;
          if (userPref === true) {
            // Resync to backend only if user had notifications ON
            await this.sendSubscriptionToServer(existingSubscription);
          } else {
            console.log('Skipping auto-resync due to user preference OFF');
          }
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  // Check who is currently registered for this browser's subscription
  async checkCurrentSubscription() {
    if (!this.registration) {
      await this.registerServiceWorker();
    }

    try {
      // Get current browser subscription
      const subscription = await this.registration.pushManager.getSubscription();
      
      if (!subscription) {
        console.log('ℹ️ No push subscription exists in this browser');
        return { found: false };
      }
      
      // Ask server who this subscription belongs to
      const data = await apiClient.post('/api/subscription-check', { endpoint: subscription.endpoint })

      if (data.found) {
        console.log(`🔍 This browser is subscribed as: ${data.userEmail}`);
        return {
          found: true,
          userEmail: data.userEmail,
          active: data.active,
          endpoint: subscription.endpoint
        };
      } else {
        console.log('🔍 This subscription is not registered to any user');
        return { found: false };
      }
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      return { error: error.message };
    }
  }

  // Handle user logout - mark subscription as inactive (don't unsubscribe browser)
  // This allows the next user who logs in to reassign the subscription
  async handleLogout() {
    try {
      let userEmail = localStorage.getItem('userEmail');
      if (!userEmail) {
        const auth = localStorage.getItem('auth');
        if (auth) {
          try { const authData = JSON.parse(auth); userEmail = authData.email; } catch {}
        }
      }

      if (!userEmail) {
        console.log('❓ No user email found during logout');
        return false;
      }

      // Mark ALL subscriptions for this user as expired on backend
      try { await apiClient.post('/api/notifications/deactivate', { userEmail }).catch(()=>{}) } catch {}

      // Best-effort: also expire this browser endpoint if available
      if (!this.registration) { await this.registerServiceWorker(); }
      const subscription = await this.registration?.pushManager.getSubscription();
      if (subscription) {
        try { await apiClient.post('/api/notifications/deactivate', { userEmail, endpoint: subscription.endpoint }).catch(()=>{}) } catch {}
      }

      this.subscription = null;
      return true;
    } catch (error) {
      console.error('❌ Error in handleLogout:', error);
      return false;
    }
  }
}

// Export singleton instance
export const notificationManager = new PushNotificationManager();

// Convenience functions
export const initNotifications = () => notificationManager.initialize();
export const requestNotificationPermission = () => notificationManager.requestPermission();
export const subscribeToNotifications = () => notificationManager.subscribe();
export const unsubscribeFromNotifications = () => notificationManager.unsubscribe();
export const handleLogout = () => notificationManager.handleLogout();
export const showNotification = (title, options) => notificationManager.showLocalNotification(title, options);
export const isNotificationSupported = () => notificationManager.isSupported();
export const getNotificationPermission = () => notificationManager.getPermission();
export const checkCurrentSubscription = () => notificationManager.checkCurrentSubscription();
