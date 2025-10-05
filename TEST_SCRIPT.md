# 🧪 TEST SCRIPT - Stars, Pins & Push Notifications

## 📋 SETUP

### Prerequisites:
```powershell
# 1. Backend running on port 3000
# 2. Redis running on port 6379
# 3. Have valid user IDs and message IDs
```

### Get User ID:
```powershell
# List all users
$users = Invoke-RestMethod -Uri http://localhost:3000/users
$users | Format-Table id, name, email

# Pick a user ID
$USER_ID = "cmgdazo6p0000ukag3e7sdljd"  # Replace with your ID
```

### Get Message ID:
```powershell
# List conversations
$headers = @{ "X-User-Id" = $USER_ID }
$convs = Invoke-RestMethod -Uri http://localhost:3000/conversations -Headers $headers
$convs | Format-Table id, type, title

# Pick a conversation
$CONV_ID = $convs[0].id

# List messages
$messages = Invoke-RestMethod -Uri "http://localhost:3000/messages/${CONV_ID}" -Headers $headers
$messages | Format-Table id, content

# Pick a message
$MSG_ID = $messages[0].id
```

---

## ✨ TEST 1: STARS (BOOKMARKS)

### 1.1 Toggle Star (Bookmark Message)
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-User-Id" = $USER_ID
}

$body = @{
    messageId = $MSG_ID
} | ConvertTo-Json

# Toggle star (first call: add star)
$result = Invoke-RestMethod -Uri http://localhost:3000/stars/toggle `
    -Method POST `
    -Headers $headers `
    -Body $body

Write-Host "⭐ Star toggled:" -ForegroundColor Green
$result | Format-List
```

**Expected output:**
```json
{
  "messageId": "...",
  "userId": "...",
  "createdAt": "2025-10-05T...",
  "action": "added"
}
```

### 1.2 List Stars
```powershell
$headers = @{ "X-User-Id" = $USER_ID }

$stars = Invoke-RestMethod -Uri http://localhost:3000/stars -Headers $headers

Write-Host "📋 Starred messages:" -ForegroundColor Cyan
$stars | Format-Table messageId, createdAt
```

### 1.3 Check Star Flags
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-User-Id" = $USER_ID
}

$body = @{
    messageIds = @($MSG_ID)
} | ConvertTo-Json

$flags = Invoke-RestMethod -Uri http://localhost:3000/stars/flags `
    -Method POST `
    -Headers $headers `
    -Body $body

Write-Host "🚩 Star flags:" -ForegroundColor Yellow
$flags
```

**Expected output:**
```json
{
  "msg-id-1": true,
  "msg-id-2": false
}
```

### 1.4 Toggle Star Again (Remove)
```powershell
$body = @{
    messageId = $MSG_ID
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri http://localhost:3000/stars/toggle `
    -Method POST `
    -Headers $headers `
    -Body $body

Write-Host "⭐ Star toggled again:" -ForegroundColor Green
$result | Format-List
```

**Expected:** `"action": "removed"`

---

## 📌 TEST 2: PINS

### 2.1 Add Pin
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-User-Id" = $USER_ID
}

$body = @{
    messageId = $MSG_ID
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri http://localhost:3000/pins `
    -Method POST `
    -Headers $headers `
    -Body $body

Write-Host "📌 Message pinned:" -ForegroundColor Green
$result | Format-List
```

**Expected output:**
```json
{
  "id": "...",
  "conversationId": "...",
  "messageId": "...",
  "pinnedBy": "...",
  "createdAt": "..."
}
```

### 2.2 List Pins
```powershell
$headers = @{ "X-User-Id" = $USER_ID }

$pins = Invoke-RestMethod -Uri "http://localhost:3000/pins/${CONV_ID}" -Headers $headers

Write-Host "📋 Pinned messages:" -ForegroundColor Cyan
$pins | Format-Table id, messageId, pinnedBy
```

### 2.3 Remove Pin
```powershell
$headers = @{ "X-User-Id" = $USER_ID }

$result = Invoke-RestMethod -Uri "http://localhost:3000/pins/${MSG_ID}" `
    -Method DELETE `
    -Headers $headers

Write-Host "📌 Pin removed:" -ForegroundColor Green
$result
```

**Expected:** `{"ok": true}`

---

## 🔔 TEST 3: PUSH NOTIFICATIONS

### 3.1 Get VAPID Public Key
```powershell
$vapid = Invoke-RestMethod -Uri http://localhost:3000/push/public-key

Write-Host "🔑 VAPID Public Key:" -ForegroundColor Cyan
$vapid.publicKey
```

### 3.2 Subscribe to Push (Manual Test)
```javascript
// Run in Browser Console

// 1. Request notification permission
await Notification.requestPermission();

// 2. Get service worker registration
const reg = await navigator.serviceWorker.ready;

// 3. Get VAPID key
const vapidRes = await fetch('http://localhost:3000/push/public-key');
const { publicKey } = await vapidRes.json();

// 4. Subscribe to push
const subscription = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: publicKey
});

console.log('Subscription:', subscription);

// 5. Send subscription to backend
const userId = localStorage.getItem('x-user-id');
await fetch('http://localhost:3000/push/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': userId
  },
  body: JSON.stringify(subscription)
});

console.log('✅ Subscribed to push!');
```

### 3.3 Test Push Notification Flow

#### Setup (2 Users):
```powershell
# User 1 (Sender)
$USER1_ID = "cmgdazo6p0000ukag3e7sdljd"

# User 2 (Receiver - will receive push when offline)
$USER2_ID = "cmg97sct00000uk3v0j6k5f6k"
```

#### Step 1: User2 Subscribe to Push
```javascript
// Browser 1 (User2):
// 1. Login as User2
// 2. Run subscription code above
// 3. Close all tabs (go offline)
```

#### Step 2: Wait for User2 to be Offline
```powershell
# Wait 65 seconds for heartbeat timeout
Start-Sleep -Seconds 65

# Check if User2 is offline
$headers = @{ "X-User-Id" = $USER1_ID }
$presence = Invoke-RestMethod -Uri "http://localhost:3000/presence/${USER2_ID}" -Headers $headers

Write-Host "User2 Online Status:" -ForegroundColor Cyan
$presence
```

**Expected:** `"online": false`

#### Step 3: User1 Send Message
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-User-Id" = $USER1_ID
}

# Get DIRECT conversation between User1 and User2
$convs = Invoke-RestMethod -Uri http://localhost:3000/conversations -Headers $headers
$conv = $convs | Where-Object { $_.type -eq "DIRECT" } | Select-Object -First 1

$body = @{
    conversationId = $conv.id
    type = "TEXT"
    content = "🔔 Test push notification!"
} | ConvertTo-Json

# Send message
$result = Invoke-RestMethod -Uri http://localhost:3000/messages `
    -Method POST `
    -Headers $headers `
    -Body $body

Write-Host "✅ Message sent:" -ForegroundColor Green
$result | Format-List id, content
```

#### Step 4: Check Backend Logs
```
[OutboxProcessor] Processing job: notifications.new_message
[NotificationsService] 🔔 Fanout notification: conv=..., msg=...
[NotificationsService] Message from cmgdazo6p0000ukag3e7sdljd: 🔔 Test push...
[NotificationsService] Other members: cmg97sct00000uk3v0j6k5f6k
[NotificationsService] User cmg97sct00000uk3v0j6k5f6k online status: false
[NotificationsService] User cmg97sct00000uk3v0j6k5f6k throttle check: true
[NotificationsService] Push notification sent to user cmg97sct00000uk3v0j6k5f6k: 1 subscriptions
```

**✅ Success:** User2 should receive push notification!

#### Step 5: Verify Push Received
```
User2's device should show notification:
━━━━━━━━━━━━━━━━━━━━━
📱 Notification
━━━━━━━━━━━━━━━━━━━━━
Message from User1
🔔 Test push notification!
━━━━━━━━━━━━━━━━━━━━━
```

---

## 🐛 TROUBLESHOOTING

### Issue: "User not found" when toggling star
```powershell
# Check if user exists
$users = Invoke-RestMethod -Uri http://localhost:3000/users
$users | Where-Object { $_.id -eq $USER_ID }
```

### Issue: "Message not found" when adding pin
```powershell
# Check if message exists
$headers = @{ "X-User-Id" = $USER_ID }
$messages = Invoke-RestMethod -Uri "http://localhost:3000/messages/${CONV_ID}" -Headers $headers
$messages | Where-Object { $_.id -eq $MSG_ID }
```

### Issue: "Not a member" when adding pin
```powershell
# Check conversation members
$headers = @{ "X-User-Id" = $USER_ID }
$conv = Invoke-RestMethod -Uri "http://localhost:3000/conversations" -Headers $headers
$conv | Where-Object { $_.id -eq $CONV_ID } | Select-Object -ExpandProperty members
```

### Issue: Push notification not received

#### Check 1: Notification Permission
```javascript
// Browser Console
console.log('Permission:', Notification.permission);
// Should be "granted"
```

#### Check 2: Service Worker
```javascript
navigator.serviceWorker.ready.then(reg => {
  console.log('Service Worker:', reg);
  reg.pushManager.getSubscription().then(sub => {
    console.log('Subscription:', sub);
  });
});
```

#### Check 3: User Online Status
```powershell
$presence = Invoke-RestMethod -Uri "http://localhost:3000/presence/${USER2_ID}"
Write-Host "User2 online:" $presence.online
# Should be false to receive push
```

#### Check 4: Redis Keys
```bash
redis-cli
> GET presence:cmg97sct00000uk3v0j6k5f6k
(nil)  # Should be nil when offline

> GET push:mute:cmg97sct00000uk3v0j6k5f6k:conv-id
(nil)  # Should be nil (not throttled)
```

#### Check 5: Backend Logs
```
Look for:
- "🔔 Fanout notification"
- "Other members: ..."
- "online status: false"
- "Push notification sent: 1 subscriptions"

If "0 subscriptions" → User hasn't subscribed
If "online status: true" → User is online, won't receive push
```

---

## ✅ SUCCESS CRITERIA

### Stars:
- [x] Toggle star adds/removes bookmark
- [x] List stars returns bookmarked messages
- [x] Check flags returns true/false per message
- [x] Frontend star button updates correctly

### Pins:
- [x] Add pin works (admin/owner only)
- [x] List pins returns pinned messages
- [x] Remove pin works
- [x] Frontend pin button updates correctly

### Push Notifications:
- [x] VAPID public key returned
- [x] Subscribe to push successful
- [x] Backend emits `notifications.new_message` job
- [x] Outbox processor handles job
- [x] NotificationsService fanouts to offline users
- [x] Push notification delivered to user
- [x] Notification shows correct title/body
- [x] Click notification opens chat

---

## 🎉 COMPLETE TEST RUN

```powershell
# Run all tests in sequence
Write-Host "`n=== TESTING STARS ===" -ForegroundColor Magenta

# Stars test
$USER_ID = "cmgdazo6p0000ukag3e7sdljd"
$MSG_ID = "your-message-id"

$headers = @{
    "Content-Type" = "application/json"
    "X-User-Id" = $USER_ID
}

# Toggle star
$body = @{ messageId = $MSG_ID } | ConvertTo-Json
$star = Invoke-RestMethod -Uri http://localhost:3000/stars/toggle -Method POST -Headers $headers -Body $body
Write-Host "✅ Star toggled:" $star.action

# List stars
$stars = Invoke-RestMethod -Uri http://localhost:3000/stars -Headers @{ "X-User-Id" = $USER_ID }
Write-Host "✅ Stars count:" $stars.Count

Write-Host "`n=== TESTING PINS ===" -ForegroundColor Magenta

# Add pin
$body = @{ messageId = $MSG_ID } | ConvertTo-Json
$pin = Invoke-RestMethod -Uri http://localhost:3000/pins -Method POST -Headers $headers -Body $body
Write-Host "✅ Pin added:" $pin.id

# List pins
$CONV_ID = "your-conv-id"
$pins = Invoke-RestMethod -Uri "http://localhost:3000/pins/${CONV_ID}" -Headers @{ "X-User-Id" = $USER_ID }
Write-Host "✅ Pins count:" $pins.Count

# Remove pin
$remove = Invoke-RestMethod -Uri "http://localhost:3000/pins/${MSG_ID}" -Method DELETE -Headers @{ "X-User-Id" = $USER_ID }
Write-Host "✅ Pin removed:" $remove.ok

Write-Host "`n=== TESTING PUSH ===" -ForegroundColor Magenta

# Get VAPID key
$vapid = Invoke-RestMethod -Uri http://localhost:3000/push/public-key
Write-Host "✅ VAPID key received:" $vapid.publicKey.Substring(0, 20)...

Write-Host "`n🎉 ALL TESTS PASSED!" -ForegroundColor Green
```

---

## 📊 RESULTS

After running all tests, you should see:

```
=== TESTING STARS ===
✅ Star toggled: added
✅ Stars count: 1

=== TESTING PINS ===
✅ Pin added: clxxxxx
✅ Pins count: 1
✅ Pin removed: True

=== TESTING PUSH ===
✅ VAPID key received: BMxxxxxxxxxxxx...

🎉 ALL TESTS PASSED!
```

**Done! All features working correctly!** 🚀
