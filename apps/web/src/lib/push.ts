import { api, unwrap } from './api';

/**
 * Web push through Firebase Cloud Messaging. Available when the VITE_FIREBASE_* settings are
 * present and the browser supports push (on iOS: only once added to the home screen).
 */
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export const pushAvailable = () => !!(cfg.apiKey && vapidKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
export const pushPermission = () => (pushAvailable() ? Notification.permission : 'denied');

async function registerDevice() {
  const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([import('firebase/app'), import('firebase/messaging')]);
  const app = getApps()[0] ?? initializeApp(cfg);
  const serviceWorkerRegistration = await navigator.serviceWorker.register('/push-sw.js');
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration });
  await unwrap(api.notifications['push-token'].$put({ json: { token, platform: 'web' } }));
}

/** Ask for permission (must run from a user gesture) and register this device. */
export async function enablePush() {
  if (!pushAvailable()) return false;
  if ((await Notification.requestPermission()) !== 'granted') return false;
  await registerDevice();
  return true;
}

/** FCM tokens rotate; re-register quietly on each visit once permission was granted. */
export function refreshPushToken() {
  if (pushAvailable() && Notification.permission === 'granted') registerDevice().catch((err) => console.warn('push registration failed', err));
}
