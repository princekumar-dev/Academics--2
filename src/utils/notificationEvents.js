let __notif_timer = null;

export function notifyNotificationsUpdated(detail = null, delay = 400) {
  if (typeof window === 'undefined') return;
  try {
    if (__notif_timer) clearTimeout(__notif_timer);
    __notif_timer = setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail }));
      } catch (e) { /* ignore */ }
      __notif_timer = null;
    }, delay);
  } catch (e) {
    // ignore
  }
}

export function notifyNotificationsUpdatedImmediate(detail = null) {
  if (typeof window === 'undefined') return;
  try {
    if (__notif_timer) { clearTimeout(__notif_timer); __notif_timer = null }
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail }));
  } catch (e) {}
}

export default { notifyNotificationsUpdated, notifyNotificationsUpdatedImmediate };
