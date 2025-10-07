import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Bell, BellOff, Moon, Sun, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}

export function SettingsModal({
  open,
  onOpenChange,
  currentUserId,
}: SettingsModalProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [darkMode, setDarkMode] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const savedNotifications = localStorage.getItem(`notifications-${currentUserId}`);
    const savedDarkMode = localStorage.getItem(`darkMode-${currentUserId}`);
    
    if (savedNotifications !== null) {
      setNotificationsEnabled(savedNotifications === 'true');
    }
    
    // Always apply dark mode on load, not just when modal opens
    const isDark = savedDarkMode === 'true';
    setDarkMode(isDark);
    applyDarkMode(isDark);
    
    // Also ensure body has correct background
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }

    // Check browser notification permission
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, [currentUserId]);

  const applyDarkMode = (enabled: boolean) => {
    if (enabled) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  };

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled && 'Notification' in window) {
      // Requesting permission to enable notifications
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem(`notifications-${currentUserId}`, 'true');
        toast.success('Notifications enabled!');
      } else if (permission === 'denied') {
        toast.error('Notification permission denied. Please enable in browser settings.');
      }
    } else {
      // Disabling notifications
      setNotificationsEnabled(!notificationsEnabled);
      localStorage.setItem(`notifications-${currentUserId}`, String(!notificationsEnabled));
      toast.success(notificationsEnabled ? 'Notifications disabled' : 'Notifications enabled');
    }
  };

  const handleToggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem(`darkMode-${currentUserId}`, String(newDarkMode));
    applyDarkMode(newDarkMode);
    toast.success(newDarkMode ? 'Dark mode enabled' : 'Light mode enabled');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-gray-800 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Notifications Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Notifications
            </h3>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                {notificationsEnabled ? (
                  <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    Push Notifications
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {pushPermission === 'granted' 
                      ? 'Receive notifications for new messages'
                      : pushPermission === 'denied'
                      ? 'Permission denied - enable in browser settings'
                      : 'Click to enable push notifications'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleToggleNotifications}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationsEnabled
                    ? 'bg-indigo-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {pushPermission === 'denied' && (
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                ⚠️ Notifications are blocked. To enable them, go to your browser settings and allow notifications for this site.
              </div>
            )}
          </div>

          {/* Appearance Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Appearance
            </h3>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                {darkMode ? (
                  <Moon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Sun className="w-5 h-5 text-amber-500" />
                )}
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    Dark Mode
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {darkMode ? 'Dark theme enabled' : 'Light theme enabled'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleToggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  darkMode
                    ? 'bg-indigo-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Info Section */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>💡 <strong>Tip:</strong> Enable notifications to never miss a message!</p>
              <p>🌙 <strong>Dark Mode:</strong> Easier on the eyes in low-light environments</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
