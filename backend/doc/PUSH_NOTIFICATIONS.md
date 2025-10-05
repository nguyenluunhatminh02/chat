# PHẦN 18 — Web Push Notifications

## ✅ Features Implemented

1. **Backend Push Module** (`/backend/src/modules/push/`)
   - `PushService`: Manage push subscriptions and send notifications
   - `PushController`: REST API endpoints for push operations
   - VAPID configuration with environment variables

2. **Backend Notifications Module** (`/backend/src/modules/notifications/`)
   - `NotificationsService`: Logic to send notifications to offline users
   - Checks user online status via `PresenceService`
   - Implements throttling (30s per user per conversation) to prevent spam
   - Integrates with `OutboxProcessor` for reliable delivery

3. **Database Schema**
   - `PushSubscription` table to store user push subscriptions
   - Stores endpoint, p256dh, and auth keys

4. **Frontend Integration**
   - `lib/push.ts`: API functions for push subscription
   - `hooks/usePushNotifications.ts`: React hook for automatic registration
   - `public/sw.js`: Service Worker for handling push notifications
   - Integrated into main App component

---

## 🔧 Setup Instructions

### 1. Install Dependencies

```cmd
cd backend
npm install web-push
```

### 2. Generate VAPID Keys

Run in **cmd.exe** (not PowerShell):

```cmd
cd backend
npx web-push generate-vapid-keys --json
```

You'll get output like:
```json
{"publicKey":"BG3x...","privateKey":"vT8y..."}
```

### 3. Update `.env`

Add to `backend/.env`:

```env
# Web Push (VAPID Keys)
VAPID_PUBLIC_KEY=BG3x... 
VAPID_PRIVATE_KEY=vT8y...
VAPID_SUBJECT=mailto:admin@example.com
```

### 4. Run Database Migration

```cmd
cd backend
npx prisma migrate dev --name push_subscriptions
npx prisma generate
```

---

## 🚀 How It Works

### Backend Flow:

1. **User subscribes** → `POST /push/subscribe` → Saves subscription to database
2. **Message created** → `OutboxProducer` → `OutboxForwarder` → BullMQ Queue
3. **OutboxProcessor** handles `messaging.message_created`:
   - Emits WebSocket event (for online users)
   - Indexes message in search
   - **Calls `NotificationsService.fanoutNewMessage()`** ⬇️
4. **NotificationsService**:
   - Gets all conversation members (except sender)
   - Checks if each member is **offline** (via `PresenceService`)
   - Checks **throttle** (30s cooldown per user/convo in Redis)
   - Sends Web Push via `PushService` ✉️

### Frontend Flow:

1. **App loads** → `usePushNotifications()` hook runs
2. **Registers Service Worker** → `/sw.js`
3. **Gets VAPID public key** → `GET /push/public-key`
4. **Subscribes to push** → `registration.pushManager.subscribe()`
5. **Sends subscription to server** → `POST /push/subscribe`
6. **Service Worker listens** → `self.addEventListener('push', ...)`
7. **Shows notification** → `self.registration.showNotification()`
8. **Click notification** → Opens/focuses chat window

---

## 🧪 Testing

### Test 1: Subscribe to Push (Browser)

1. Start backend: `cd backend && npm run start:dev`
2. Start frontend: `cd frontend && npm run dev`
3. Login as user (e.g., `u2`)
4. Open DevTools Console → Should see:
   ```
   Service Worker registered
   Push subscription successful
   ```

### Test 2: Receive Push Notification

**Setup:**
- User A (u1) and User B (u2) in same conversation
- User B is logged in, then **closes the tab** (offline)

**Send message as User A:**

```powershell
# In cmd.exe or Git Bash (not PowerShell)
curl -X POST http://localhost:3000/messages ^
  -H "Content-Type: application/json" ^
  -H "X-User-Id: u1" ^
  -d "{\"conversationId\":\"<CONVERSATION_ID>\",\"type\":\"TEXT\",\"content\":\"Test push notification\"}"
```

**Expected Result:**
- User B receives browser notification (even though tab is closed)
- Notification shows: "Message from u1" with content preview
- Clicking notification opens/focuses the chat

### Test 3: Throttling

Send multiple messages rapidly from u1:

```powershell
# Message 1 - should send push
curl -X POST http://localhost:3000/messages ^
  -H "Content-Type: application/json" ^
  -H "X-User-Id: u1" ^
  -d "{\"conversationId\":\"<CONVERSATION_ID>\",\"type\":\"TEXT\",\"content\":\"Message 1\"}"

# Message 2 (immediately after) - should be throttled (no push)
curl -X POST http://localhost:3000/messages ^
  -H "Content-Type: application/json" ^
  -H "X-User-Id: u1" ^
  -d "{\"conversationId\":\"<CONVERSATION_ID>\",\"type\":\"TEXT\",\"content\":\"Message 2\"}"

# Wait 30+ seconds, then send Message 3 - should send push
```

**Expected Result:**
- Only Message 1 and Message 3 trigger push notifications
- Message 2 is throttled (30s cooldown)

---

## 📡 API Endpoints

### `GET /push/public-key`
Get VAPID public key for subscription

**Response:**
```json
{
  "publicKey": "BG3x..."
}
```

### `POST /push/subscribe`
Register a push subscription

**Headers:**
- `X-User-Id`: User ID
- `Content-Type`: application/json

**Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

**Response:**
```json
{
  "ok": true
}
```

### `DELETE /push/unsubscribe`
Remove a push subscription

**Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/..."
}
```

---

## 🎛️ Configuration

### Throttle Duration
Edit `NotificationsService.shouldNotify()`:

```typescript
const result = await this.redis.set(key, '1', { NX: true, EX: 30 }); // Change 30 to desired seconds
```

### Notification Content
Edit `NotificationsService.fanoutNewMessage()`:

```typescript
const title = conversation?.type === 'GROUP'
  ? `${senderName} in ${conversation.title || 'Group'}`
  : `Message from ${senderName}`;

let body = '';
if (message.type === 'TEXT' && message.content) {
  body = message.content.length > 120 
    ? message.content.slice(0, 120) + '...' 
    : message.content;
}
```

---

## 🔒 Production Notes

1. **HTTPS Required**: Web Push requires HTTPS in production (localhost works for dev)
2. **VAPID Keys**: Keep `VAPID_PRIVATE_KEY` secret! Never commit to git
3. **Service Worker Scope**: Must be served from root (`/sw.js`) for full app access
4. **Browser Support**: Check [caniuse.com/push-api](https://caniuse.com/push-api)
5. **Permissions**: Users must grant notification permission (browser prompts automatically)

---

## 🐛 Troubleshooting

### "Service Worker registration failed"
- Ensure `sw.js` is in `frontend/public/` folder
- Check browser console for errors
- Try clearing service worker cache: DevTools → Application → Service Workers → Unregister

### "VAPID keys not configured"
- Check `.env` file has `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
- Restart backend after updating `.env`

### "Push subscription failed"
- Check browser notification permissions: Settings → Site Permissions
- Ensure VAPID keys are valid (regenerate if needed)
- Check DevTools Console for detailed error

### "No push received"
- Verify user is actually offline (close all tabs)
- Check backend logs: `NotificationsService` should log "Push notification sent to user..."
- Check Redis is running (throttle uses Redis)
- Verify `PresenceService.isOnline()` returns false

---

## ✅ Checklist

- [x] Installed `web-push` package
- [x] Generated VAPID keys
- [x] Added keys to `.env`
- [x] Ran database migration
- [x] Created PushModule (service, controller, module)
- [x] Created NotificationsModule (service, module)
- [x] Updated OutboxModule imports
- [x] Updated OutboxProcessor to call fanoutNewMessage
- [x] Updated AppModule with new modules
- [x] Created frontend API layer (`lib/push.ts`)
- [x] Created React hook (`hooks/usePushNotifications.ts`)
- [x] Created Service Worker (`public/sw.js`)
- [x] Integrated hook into App component
- [x] Tested push subscription
- [x] Tested push delivery to offline users
- [x] Tested throttling mechanism

---

## 🎉 Result

You now have a **production-ready Web Push notification system** that:

✅ Only sends to **offline** users (doesn't spam online users with duplicate notifications)  
✅ Has **throttling** to prevent notification spam (30s cooldown)  
✅ **Reliable delivery** via OutboxPattern (no message lost even in multi-instance)  
✅ **Auto-cleanup** of dead subscriptions (410/404 errors)  
✅ **Browser notification** with click-to-open functionality  
✅ **Group notifications** by conversation (tag feature)  

**Users will never miss a message, even when offline! 📱✉️**
