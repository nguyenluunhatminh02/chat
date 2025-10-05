import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';

/**
 * Component to show notification permission status and prompt
 * Shows a banner if notifications are not enabled
 */
export function NotificationBanner() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      return;
    }

    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        // Permission granted, the push hook will handle subscription
        setDismissed(true);
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show if:
  // - Notifications not supported
  // - Permission already granted
  // - User dismissed
  if (!('Notification' in window) || permission === 'granted' || dismissed) {
    return null;
  }

  // Don't show if permission denied (user explicitly blocked)
  if (permission === 'denied') {
    return (
      <div className="bg-gray-100 border-l-4 border-gray-400 p-4 mx-4 mt-4 rounded">
        <div className="flex items-start">
          <BellOff className="h-5 w-5 text-gray-500 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              Notifications are blocked. Enable them in your browser settings to receive message alerts.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // Show enable banner if permission is 'default' (not yet asked)
  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mx-4 mt-4 rounded">
      <div className="flex items-start">
        <Bell className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-800">
            Enable notifications
          </h3>
          <p className="mt-1 text-sm text-blue-700">
            Get notified when you receive new messages, even when the app is closed.
          </p>
          <button
            onClick={requestPermission}
            disabled={loading}
            className="mt-3 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Requesting...' : 'Enable Notifications'}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-3 flex-shrink-0 text-blue-400 hover:text-blue-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
