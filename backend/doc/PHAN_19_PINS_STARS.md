# PHẦN 19 — Message Pin/Star (Bookmarks) ⭐📌

## ✅ Hoàn Thành

### Backend Implementation

#### 1. **Stars Module** (Personal Bookmarks)
- `backend/src/modules/stars/stars.service.ts`
  - `toggle(userId, messageId)` - Idempotent star/unstar
  - `list(userId, conversationId?, limit, cursor)` - Paginated bookmarks
  - `flags(userId, messageIds)` - Bulk check starred status
  - Permission: Only conversation members can star

- `backend/src/modules/stars/stars.controller.ts`
  - `POST /stars/toggle` - Toggle bookmark
  - `GET /stars` - List bookmarked messages
  - `POST /stars/flags` - Check multiple messages

#### 2. **Pins Module** (Group-level Pins)
- `backend/src/modules/pins/pins.service.ts`
  - `add(userId, messageId)` - Pin message (ADMIN/OWNER only)
  - `remove(userId, messageId)` - Unpin (ADMIN/OWNER or original pinner)
  - `list(conversationId, limit, cursor)` - List pinned messages
  
- `backend/src/modules/pins/pins.controller.ts`
  - `POST /pins` - Pin a message
  - `DELETE /pins/:messageId` - Unpin a message
  - `GET /pins/:conversationId` - List all pins

#### 3. **Database Schema**
```prisma
model Star {
  messageId String
  userId String
  createdAt DateTime @default(now())
  
  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@id([messageId, userId])
  @@index([userId, createdAt])
}

model Pin {
  id String @id @default(cuid())
  conversationId String
  messageId String
  pinnedBy String
  createdAt DateTime @default(now())
  
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  pinner User @relation(fields: [pinnedBy], references: [id], onDelete: Cascade)
  
  @@unique([conversationId, messageId])
  @@index([conversationId, createdAt])
}
```

#### 4. **Realtime Events**
- `pin.added` - Broadcast when message is pinned
- `pin.removed` - Broadcast when message is unpinned
- Handled in `backend/src/modules/outbox/outbox.processor.ts`

### Frontend Implementation

#### 1. **API Client**
- `frontend/src/lib/stars.ts` - Stars API functions
- `frontend/src/lib/pins.ts` - Pins API functions

#### 2. **React Query Hooks**
- `frontend/src/hooks/useStars.ts`
  - `useToggleStar()` - Mutation hook
  - `useStars(conversationId?)` - Query hook
  - `useStarFlags(messageIds)` - Bulk check hook
  
- `frontend/src/hooks/usePins.ts`
  - `useAddPin()` - Mutation hook
  - `useRemovePin()` - Mutation hook
  - `usePins(conversationId)` - Query hook

#### 3. **UI Components**
- `frontend/src/components/chat/StarButton.tsx`
  - Yellow star icon button
  - Shows filled when starred
  - Click to toggle bookmark
  
- `frontend/src/components/chat/PinButton.tsx`
  - Blue pin icon button
  - Only visible to ADMIN/OWNER
  - Shows X when pinned (to unpin)
  
- `frontend/src/components/chat/PinnedMessagesPanel.tsx`
  - Slide-in panel from right
  - Shows all pinned messages in conversation
  - Click to jump to message
  - Shows who pinned and when
  
- `frontend/src/components/chat/StarredMessagesModal.tsx`
  - Full-screen modal
  - Shows all bookmarked messages
  - Optional filter by conversation
  - Click to navigate to message

#### 4. **Integration**
- `frontend/src/pages/ChatPage.tsx`
  - Added header buttons for pins/stars
  - WebSocket listeners for `pin.added` and `pin.removed`
  - `MessagesRenderer` component with star/pin state
  - Auto-invalidate queries on events

## 🎯 Features

### Stars (Personal Bookmarks)
- ⭐ Any conversation member can star messages
- 📚 View all starred messages across conversations
- 🔍 Filter starred messages by conversation
- 🔄 Real-time sync via React Query
- 💾 Persistent storage in database

### Pins (Group-level)
- 📌 Only ADMIN/OWNER can pin messages
- 🔓 ADMIN/OWNER or original pinner can unpin
- 🎯 One message can be pinned per conversation
- 🔔 Realtime notification to all members
- 👀 Visible to all conversation members

## 🧪 Testing

### Backend API Tests

```bash
# 1. Toggle Star
curl -X POST http://localhost:3000/stars/toggle \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageId":"msg_xxx"}'

# 2. List Starred Messages
curl http://localhost:3000/stars \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Check Star Flags
curl -X POST http://localhost:3000/stars/flags \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageIds":["msg_1","msg_2","msg_3"]}'

# 4. Pin Message (ADMIN only)
curl -X POST http://localhost:3000/pins \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageId":"msg_xxx"}'

# 5. List Pins
curl http://localhost:3000/pins/conv_xxx \
  -H "Authorization: Bearer YOUR_TOKEN"

# 6. Unpin Message
curl -X DELETE http://localhost:3000/pins/msg_xxx \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Frontend Testing
1. **Stars**:
   - Click star button on any message
   - Check it turns yellow and filled
   - Click header star button to view all bookmarks
   - Click bookmarked message to navigate

2. **Pins**:
   - As ADMIN, click pin button on message
   - Check it broadcasts to all members
   - Click header pin button to view pinned messages
   - Click pinned message to jump to it
   - Click X on pin button to unpin

3. **Realtime**:
   - Open same conversation in 2 tabs
   - Pin message in tab 1
   - Check tab 2 receives update immediately
   - Same for unpin action

## 🔧 Database Migration

```bash
# Run migration
cd backend
npx prisma migrate dev --name pins_stars_init

# Generate Prisma Client
npx prisma generate

# Restart backend server
npm run start:dev
```

## 📊 Performance Notes

### Indexes
- `Star`: Indexed by `[userId, createdAt]` for fast pagination
- `Pin`: Indexed by `[conversationId, createdAt]` for fast lookup
- Composite keys prevent duplicates

### Caching
- React Query caches star flags per message list
- Pin lists cached per conversation
- Auto-invalidation on mutations

### Optimizations
- Bulk star flag check (single query for multiple messages)
- Lazy loading with cursor pagination
- WebSocket events for instant updates

## 🎨 UI/UX

### Design Principles
- **Stars**: Yellow gradient (warm, personal bookmark feel)
- **Pins**: Blue gradient (official, important message)
- **Hover effects**: Scale 1.1x on hover
- **Transitions**: Smooth color/shadow changes
- **Icons**: Lucide React icons (Star, Pin, X)

### Accessibility
- `aria-label` on all buttons
- `aria-pressed` state for toggles
- Keyboard navigation support
- Screen reader friendly

## 🚀 Next Steps

### Possible Enhancements
1. **Star Collections**: Group stars into custom collections
2. **Pin Limit**: Set max pins per conversation (e.g., 5)
3. **Pin Expiry**: Auto-unpin after X days
4. **Star Notes**: Add personal notes to starred messages
5. **Export Stars**: Download bookmarked messages as PDF
6. **Pin Notifications**: Notify when admin pins important message
7. **Star Search**: Full-text search within starred messages only

---

**Status**: ✅ Fully Implemented (Backend + Frontend + Realtime)
**Migration**: Required (`npx prisma migrate dev`)
**Breaking Changes**: None
