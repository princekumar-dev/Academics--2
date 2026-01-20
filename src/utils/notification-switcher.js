/**
 * Enhanced notification handler for managing user switching
 * Handles subscription deactivation on logout and reactivation on login
 */
import apiClient from './apiClient'
    try {
      const data = await apiClient.get('/api/notifications/vapid-public-key')
      if (data && data.publicKey) return data.publicKey
      console.warn('Failed to fetch VAPID key from server, using fallback')
      return 'BI3ZQwdtuxxYpepMvZjy5xkuzLbnsjG8J1jfBkGMi0AzbhWDocIASZkq6ocisfwCTnYCHuogo_O-PJSuyfGWwkU'
    } catch (error) {
      console.error('Error fetching VAPID key:', error)
      return 'BI3ZQwdtuxxYpepMvZjy5xkuzLbnsjG8J1jfBkGMi0AzbhWDocIASZkq6ocisfwCTnYCHuogo_O-PJSuyfGWwkU'
    }

    // Check if push is supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return false;
    }

    // Register service worker if not already registered
    const swRegistration = await registerServiceWorker();
    
    // Check if we already have permission
    if (Notification.permission === 'granted') {
      // Get existing subscription
      const subscription = await swRegistration.pushManager.getSubscription();
      
      if (subscription) {
        // We already have a subscription, check if it belongs to this user
        await manageExistingSubscription(subscription, userEmail);
      } else {
        // No subscription yet, try to subscribe
        await subscribeUser(userEmail);
      }
      return true;
    } else if (Notification.permission !== 'denied') {
      // Ask for permission
      await requestNotificationPermission(userEmail);
      return true;
    } else {
      console.log('Notification permission denied');
      return false;
    }
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
    return false;
  }
}

/**
 * Handle an existing subscription when a user logs in
 * @param {PushSubscription} subscription - The existing push subscription
 * @param {string} userEmail - Current user's email
 * @returns {Promise<void>}
 */
async function manageExistingSubscription(subscription, userEmail) {
  try {
    // First check if this subscription is in storage and for which user
    const savedData = getSubscriptionFromStorage();
    
    if (savedData && savedData.userEmail !== userEmail) {
      console.log('User switched detected, reactivating subscription for new user');
      
      // User has switched, reactivate the subscription for the new user
      try {
        const result = await apiClient.post('/api/notifications/reactivate', {
          subscriptionId: savedData.subscriptionId,
          userEmail
        });
        if (result && result.success) {
          // Update storage with new user
          saveSubscriptionToStorage(savedData.subscriptionId, userEmail, subscription);
          console.log('Subscription reactivated for new user:', userEmail);
        } else {
          console.error('Failed to reactivate subscription for new user');
        }
      } catch (err) {
        console.error('Failed to reactivate subscription for new user:', err);
      }
    } else if (!savedData) {
      // We have a subscription but no saved data, need to check with server
      await verifySubscriptionWithServer(subscription, userEmail);
    } else {
      // Same user, subscription already active
      console.log('Using existing subscription for current user:', userEmail);
    }
  } catch (error) {
    console.error('Error managing existing subscription:', error);
  }
}

/**
 * Verify subscription status with server and update if needed
 * @param {PushSubscription} subscription - Push subscription object
 * @param {string} userEmail - Current user's email
 * @returns {Promise<void>}
 */
async function verifySubscriptionWithServer(subscription, userEmail) {
  try {
    // Store subscription for current user
    try {
      const result = await apiClient.post('/api/notifications/subscribe', { subscription, userEmail });
      if (result && result.success) {
        // Save to storage
        saveSubscriptionToStorage(result.subscriptionId, userEmail, subscription);
        console.log('Subscription verified and saved for:', userEmail);
      }
    } catch (err) {
      console.error('Error verifying subscription with server:', err);
    }
  } catch (error) {
    console.error('Error verifying subscription with server:', error);
  }
}

/**
 * Register the service worker
 * @returns {Promise<ServiceWorkerRegistration>}
 */
async function registerServiceWorker() {
  try {
    return await navigator.serviceWorker.register('/service-worker.js');
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    throw error;
  }
}

/**
 * Request notification permission and subscribe user
 * @param {string} userEmail - User's email
 * @returns {Promise<void>}
 */
async function requestNotificationPermission(userEmail) {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      await subscribeUser(userEmail);
    } else {
      console.log('Unable to get permission to notify.');
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
}

/**
 * Subscribe the user to push notifications
 * @param {string} userEmail - User's email
 * @returns {Promise<void>}
 */
async function subscribeUser(userEmail) {
  try {
    const swRegistration = await navigator.serviceWorker.ready;
    
    // Get the server's public VAPID key
    const vapidData = await apiClient.get('/api/notifications/vapid-public-key');
    if (!vapidData || !vapidData.success) {
      throw new Error('Failed to get VAPID public key');
    }

    const publicKey = urlBase64ToUint8Array(vapidData.publicKey);
    
    // Subscribe the user
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey
    });
    
    // Send the subscription to the server
    try {
      const result = await apiClient.post('/api/notifications/subscribe', { subscription, userEmail });
      if (result && result.success) {
        saveSubscriptionToStorage(result.subscriptionId, userEmail, subscription);
        console.log('User subscribed to notifications:', userEmail);
      }
    } catch (err) {
      console.error('Failed to send subscription to server:', err);
    }
  } catch (error) {
    console.error('Failed to subscribe user:', error);
  }
}

/**
 * Deactivate all user subscriptions on logout
 * @param {string} userEmail - User's email
 * @returns {Promise<boolean>} - Success status
 */
export async function deactivateUserNotifications(userEmail) {
  if (!userEmail) return false;
  
  try {
    // Get saved subscription info
    const savedData = getSubscriptionFromStorage();
    
    // Only proceed if the saved email matches the current user
    if (savedData && savedData.userEmail === userEmail) {
      try {
        const res = await apiClient.post('/api/notifications/deactivate', { userEmail });
        if (res && res.success) {
          // Keep the subscription data in storage, but mark it as inactive
          // This helps with reactivation when another user logs in
          localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify({
            ...savedData,
            active: false
          }));

          console.log('Notifications deactivated for user:', userEmail);
          return true;
        }
      } catch (err) {
        console.error('Failed to deactivate notifications (server error):', err);
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error('Failed to deactivate notifications:', error);
    return false;
  }
}

/**
 * Save subscription details to storage
 * @param {string} subscriptionId - Server-side subscription ID
 * @param {string} userEmail - User's email
 * @param {PushSubscription} subscription - Push subscription object
 */
function saveSubscriptionToStorage(subscriptionId, userEmail, subscription) {
  try {
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify({
      subscriptionId,
      userEmail,
      active: true,
      endpoint: subscription.endpoint,
      // Don't store sensitive keys, just the endpoint for identification
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Failed to save subscription to storage:', error);
  }
}

/**
 * Get subscription from storage
 * @returns {Object|null} - Stored subscription data or null
 */
function getSubscriptionFromStorage() {
  try {
    const data = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get subscription from storage:', error);
    return null;
  }
}

/**
 * Convert base64 string to Uint8Array for the applicationServerKey
 * @param {string} base64String - Base64 encoded string
 * @returns {Uint8Array} - Converted array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
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