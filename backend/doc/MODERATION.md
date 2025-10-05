# PHẦN 17 — Audit/Moderation System

## 📋 Tổng quan

Hệ thống moderation toàn diện bao gồm:
- **Block System**: User có thể block lẫn nhau, chặn DM
- **Report System**: Report tin nhắn/user/conversation vi phạm
- **Admin Moderation**: Admin xử lý reports (xóa tin, block user)
- **Group Moderation**: Admin/Owner group có thể kick/ban members
- **Appeal System**: User bị xử lý có thể kháng nghị

---

## 🗄️ Database Schema

### New Tables

#### `Report`
```prisma
model Report {
  id                   String        @id @default(cuid())
  reporterId           String        // Người report
  type                 ReportType    // MESSAGE | USER | CONVERSATION
  targetMessageId      String?
  targetUserId         String?
  targetConversationId String?
  reason               ReportReason  // SPAM | ABUSE | NSFW | HARASSMENT | OTHER
  details              String?       // Mô tả chi tiết
  evidence             Json?         // Snapshot của nội dung bị report
  status               ReportStatus  @default(OPEN) // OPEN | RESOLVED | REJECTED
  action               String?       // NONE | DELETE_MESSAGE | BLOCK_USER
  resolutionNotes      String?       // Ghi chú của admin
  resolvedById         String?       // Admin xử lý
  createdAt            DateTime      @default(now())
  resolvedAt           DateTime?
}
```

#### `Block`
```prisma
model Block {
  blockerId     String
  blockedUserId String
  createdAt     DateTime  @default(now())
  expiresAt     DateTime? // Tạm thời block (null = vĩnh viễn)
  
  @@id([blockerId, blockedUserId])
}
```

#### `ConversationBan`
```prisma
model ConversationBan {
  conversationId String
  userId         String
  bannedBy       String    // Admin/Owner đã ban
  reason         String?
  createdAt      DateTime  @default(now())
  expiresAt      DateTime?
  
  @@id([conversationId, userId])
}
```

#### `Appeal`
```prisma
model Appeal {
  id          String       @id @default(cuid())
  userId      String       // Người kháng nghị
  reportId    String?      // Liên kết với report (nếu có)
  banId       String?      // Format: "conversationId:userId"
  reason      String       // Lý do kháng nghị
  status      AppealStatus @default(PENDING) // PENDING | APPROVED | REJECTED
  reviewedBy  String?      // Admin review
  reviewNotes String?
  createdAt   DateTime     @default(now())
  reviewedAt  DateTime?
}
```

---

## 🔌 API Endpoints

### 1. Block System

#### `POST /blocks`
Block một user.
```json
{
  "blockedUserId": "user-id",
  "expiresAt": "2024-12-31T23:59:59Z" // Optional
}
```

#### `GET /blocks`
List tất cả blocks của user hiện tại.

#### `DELETE /blocks/:blockedUserId`
Unblock một user.

---

### 2. Report System

#### `POST /moderation/reports`
Tạo report mới.
```json
{
  "type": "MESSAGE",
  "targetMessageId": "msg-id",
  "reason": "ABUSE",
  "details": "Offensive language"
}
```

**Types**: `MESSAGE` | `USER` | `CONVERSATION`  
**Reasons**: `SPAM` | `ABUSE` | `NSFW` | `HARASSMENT` | `OTHER`

#### `GET /moderation/reports?status=OPEN` (Admin only)
List reports. Requires header: `X-Admin: 1`

**Statuses**: `OPEN` | `RESOLVED` | `REJECTED`

#### `POST /moderation/reports/:id/resolve` (Admin only)
Xử lý report.
```json
{
  "action": "DELETE_MESSAGE", // NONE | DELETE_MESSAGE | BLOCK_USER
  "resolutionNotes": "Violated community guidelines"
}
```

---

### 3. Group Moderation

#### `POST /moderation/conversations/:conversationId/kick`
Kick member khỏi group (Admin/Owner only).
```json
{
  "userId": "user-to-kick"
}
```

#### `POST /moderation/conversations/:conversationId/ban`
Ban member khỏi group vĩnh viễn hoặc tạm thời.
```json
{
  "userId": "user-to-ban",
  "reason": "Spam",
  "expiresAt": "2024-12-31T23:59:59Z" // Optional
}
```

#### `DELETE /moderation/conversations/:conversationId/ban/:userId`
Unban member.

#### `GET /moderation/conversations/:conversationId/bans`
List tất cả bans trong group.

---

### 4. Appeal System

#### `POST /moderation/appeals`
Tạo kháng nghị.
```json
{
  "reportId": "report-id",        // Optional
  "banId": "convId:userId",       // Optional
  "reason": "I was wrongly banned"
}
```

#### `GET /moderation/appeals?status=PENDING` (Admin only)
List appeals.

#### `POST /moderation/appeals/:id/review` (Admin only)
Xét duyệt appeal.
```json
{
  "decision": "APPROVED", // APPROVED | REJECTED
  "reviewNotes": "Appeal granted"
}
```

---

## 🔒 Business Logic

### Block System
- **Bidirectional check**: Nếu A block B hoặc B block A → Không thể gửi DM
- **Group messages**: Vẫn gửi được, nhưng client nên ẩn tin từ người bị block
- **Temporary blocks**: Có thể set `expiresAt` để tự động unblock

### Report Flow
1. User report → Status = `OPEN`
2. Admin review → Thực hiện action (xóa tin, block user, hoặc không làm gì)
3. Status → `RESOLVED` hoặc `REJECTED`
4. Evidence được snapshot khi tạo report (tin nhắn có thể bị xóa sau đó)

### Group Moderation
- **Kick**: Xóa member khỏi group ngay lập tức
- **Ban**: Kick + thêm vào blacklist → Không thể join lại
- **Permissions**: Chỉ ADMIN hoặc OWNER mới có quyền
- **Protection**: Không thể kick/ban OWNER

### Message Sending Checks
```typescript
// messages.service.ts - send() method
1. Check if user is member
2. Check if user is banned from conversation ✅ NEW
3. For DIRECT: Check if blocked ✅ NEW
4. Validate parent message
5. Create message + emit outbox
```

---

## 🧪 Testing

### Setup
1. Run migration: `pnpm dlx prisma migrate dev`
2. Start backend: `pnpm run start:dev`
3. Get user IDs from database

### Quick Test (PowerShell)
```powershell
# Block user
curl.exe -X POST http://localhost:3000/blocks `
  -H "Content-Type: application/json" `
  -H "X-User-Id: user1" `
  -d '{"blockedUserId":"user2"}'

# Try to send DM (should fail)
curl.exe -X POST http://localhost:3000/messages `
  -H "Content-Type: application/json" `
  -H "X-User-Id: user2" `
  -d '{"conversationId":"conv-id","type":"TEXT","content":"test"}'

# Report message
curl.exe -X POST http://localhost:3000/moderation/reports `
  -H "Content-Type: application/json" `
  -H "X-User-Id: user1" `
  -d '{"type":"MESSAGE","targetMessageId":"msg-id","reason":"ABUSE"}'

# Admin resolve
curl.exe -X POST http://localhost:3000/moderation/reports/report-id/resolve `
  -H "Content-Type: application/json" `
  -H "X-Admin: 1" `
  -H "X-User-Id: admin" `
  -d '{"action":"DELETE_MESSAGE","resolutionNotes":"Removed"}'
```

**Full test script**: `backend/scripts/test-moderation.ps1`

---

## 📊 Admin Dashboard (Future)

Frontend admin panel có thể hiển thị:
- **Reports Dashboard**: Pending reports, recent actions
- **Block Stats**: Most blocked users, block trends
- **Ban Management**: Active bans per group
- **Appeal Queue**: Pending appeals to review

---

## ⚠️ Security Notes

1. **Admin Authentication**: Demo dùng header `X-Admin: 1`. Production cần JWT + role check.
2. **Rate Limiting**: Nên thêm rate limit cho report endpoint (tránh spam).
3. **Evidence Privacy**: Report evidence chứa nội dung tin nhắn → Cần encrypt hoặc xóa sau một thời gian.
4. **Appeal Abuse**: User có thể spam appeals → Giới hạn số lần appeal.

---

## ✅ Completed Features

- ✅ Block/Unblock users
- ✅ Block check for DM (DIRECT conversations)
- ✅ Report system (Message/User/Conversation)
- ✅ Admin moderation (resolve reports, delete messages, block users)
- ✅ Group moderation (kick/ban/unban members)
- ✅ Appeal system (create, list, approve/reject)
- ✅ Ban expiration logic
- ✅ Permission checks (Admin/Owner only for group actions)
- ✅ Evidence snapshot for reports
- ✅ Outbox events for deleted messages

---

## 🚀 Next Steps

1. **Frontend UI**: 
   - Report button on messages
   - Block/unblock UI
   - Admin dashboard
   - Appeal form

2. **Enhanced Features**:
   - Auto-mod with ML (detect toxic content)
   - Shadow ban (user không biết bị ban)
   - Appeal history
   - Moderation audit log

3. **Notifications**:
   - Notify user khi bị banned
   - Notify admin có report mới
   - Notify user khi appeal được duyệt
