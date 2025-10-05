import { useEffect, useState } from 'react';
import { getPushPublicKey, subscribePush, urlBase64ToUint8Array } from '../lib/push';
import { useAppContext } from './useAppContext';

/**
 * Hook to register and manage Web Push notifications
 * Call this in your main App component to enable push for the current user
 */
export function usePushNotifications() {
  const { currentUserId } = useAppContext();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if Push is supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported in this browser');
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    if (!currentUserId) {
      return;
    }

    // Register service worker and subscribe to push
    registerPush();
  }, [currentUserId]);

  const registerPush = async () => {
    try {
      // 1. Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registered:', registration.scope);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // 2. Get VAPID public key from server
      const { publicKey } = await getPushPublicKey();
      
      if (!publicKey) {
        throw new Error('VAPID public key not configured on server');
      }

      // 3. Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 4. Send subscription to server
      await subscribePush(currentUserId!, subscription.toJSON() as any);

      setIsSubscribed(true);
      setError(null);
      console.log('Push subscription successful');
    } catch (err: any) {
      console.error('Push subscription failed:', err);
      setError(err.message || 'Failed to subscribe to push notifications');
      setIsSubscribed(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    error,
    register: registerPush,
  };
}
