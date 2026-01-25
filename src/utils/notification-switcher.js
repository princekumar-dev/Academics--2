i // Lightweight wrapper: re-export the robust notification manager implementation
export { 
  initNotifications,
  requestNotificationPermission,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  handleLogout,
  showNotification,
  isNotificationSupported,
  getNotificationPermission,
  checkCurrentSubscription
} from './notifications'