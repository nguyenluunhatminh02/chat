// Service Worker for Web Push Notifications (tuned for visible toasts)

self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  console.log('[SW] Permission:', Notification.permission); // debug

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      try {
        const text = event.data.text();
        console.log('[SW] Push data (text):', text);
        data = { title: 'New Message', body: text };
      } catch (e) {
        console.error('[SW] Failed to parse push data:', error);
        data = { title: 'New Message', body: 'You have a new message' };
      }
    }
  }

  // Tạo tag "ổn" cho UX:
  // - Nếu payload có messageId → tag theo message (show mỗi tin là 1 toast)
  // - Nếu có conversationId → tag theo conversation và renotify: true (gộp nhưng vẫn ping)
  // - Nếu không có gì → tag theo timestamp để không replace
  const tagFromPayload =
    data.tag ||
    (data.messageId && `msg:${data.messageId}`) ||
    (data.conversationId && `conv:${data.conversationId}`) ||
    `push:${Date.now()}`; // đảm bảo không replace

  // Trong DEV, ép hiện toast rõ ràng
  const DEV = true; // ← đổi thành false khi lên prod nếu muốn
  const title = data.title || 'New Message';
  const options = {
    body: data.body || 'You have a new message',
    icon: data.icon || '/vite.svg',
    badge: data.badge || '/vite.svg',
    tag: tagFromPayload,
    renotify: data.renotify ?? true,                // 👈 quan trọng
    requireInteraction: data.requireInteraction ?? DEV, // 👈 ép banner đứng yên khi DEV
    vibrate: data.vibrate || [200, 100, 200],
    data: {
      url: data.data?.url || data.url || '/',       // deep link
      conversationId: data.conversationId,
      messageId: data.messageId,
      ...data.data,
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' },
    ],
    silent: false, // ensure not silent
  };

  console.log('[SW] Showing notification:', title, options);

  event.waitUntil((async () => {
    // Optional debug: xem các notification đang mở
    const existing = await self.registration.getNotifications({ includeTriggered: true });
    console.log('[SW] Existing notifications:', existing.map(n => n.tag));

    await self.registration.showNotification(title, options);
    console.log('[SW] Notification shown successfully');
  })().catch(err => console.error('[SW] Failed to show notification:', err)));
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();
  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    // Ưu tiên tab cùng origin
    const sameOrigin = allClients.filter(c => c.url.startsWith(self.location.origin));
    // Tìm tab đúng path nếu có
    const target = sameOrigin.find(c => {
      try {
        const u = new URL(c.url);
        const t = new URL(fullUrl);
        return u.pathname === t.pathname;
      } catch { return false; }
    });

    if (target) {
      if ('focus' in target) await target.focus();
      if ('navigate' in target) await target.navigate(fullUrl);
      return;
    }

    // Fallback: focus 1 tab cùng origin
    if (sameOrigin[0]) {
      if ('navigate' in sameOrigin[0]) await sameOrigin[0].navigate(fullUrl);
      if ('focus' in sameOrigin[0]) await sameOrigin[0].focus();
      return;
    }

    // Mở mới
    await self.clients.openWindow(fullUrl);
  })());
});

// Handle push subscription change (edge cases)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');

  event.waitUntil((async () => {
    try {
      // ⚠️ Bạn nên giữ applicationServerKey trong env và truyền xuống, không lấy từ oldSubscription (có thể undefined)
      const newSubscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: self.__VAPID_PUBLIC_KEY /* set khi build, hoặc importScripts */,
      });

      await fetch('/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // nếu server cần cookie phiên
        body: JSON.stringify(newSubscription.toJSON()),
      });
    } catch (error) {
      console.error('[SW] Failed to resubscribe:', error);
    }
  })());
});
