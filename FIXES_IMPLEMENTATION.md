# 🐛 BUG FIXES IMPLEMENTATION - PHẦN 19

## ✅ COMPLETED

### 1. Pin Visual Indicator
**Status**: ✅ DONE
**Files Changed**:
- `frontend/src/components/chat/MessageItem.tsx`
  - Added "Pinned" badge with icon above message content
  - Blue gradient badge for pinned messages
  - Responsive styling for own/other messages

**Test**: Pin a message → Should see blue "📌 PINNED" badge

---

### 2. Block Status API
**Status**: ✅ DONE  
**Files Changed**:
- `backend/src/modules/blocks/blocks.service.ts`
  - Added `isBlocked(blockerId, blockedUserId)` method
  
- `backend/src/modules/blocks/blocks.controller.ts`
  - Added `GET /blocks/check/:otherUserId` endpoint
  - Returns: `{ blocked: boolean, direction: 'none' | 'blocker' | 'blocked' | 'mutual' }`

- `frontend/src/lib/moderation.ts`
  - Added `checkBlockStatus(userId, otherUserId)` API function

- `frontend/src/hooks/useBlockStatus.ts` (NEW)
  - React Query hook for checking block status
  - Auto-enabled when both userIds present
  - 30s cache

- `frontend/src/components/chat/BlockedBanner.tsx` (NEW)
  - Messenger-style gray banner
  - Two variants: "You blocked X" vs "X blocked you"
  - Unblock button for blocker

**Test**: 
```bash
# Backend
curl http://localhost:3000/blocks/check/USER_B_ID \
  -H "X-User-Id: USER_A_ID"
# Should return: { blocked: false, direction: 'none' }
```

---

## 🔄 IN PROGRESS

### 3. Integrate Block Banner in ChatPage
**Status**: 🔄 NEXT STEP
**TODO**:
```typescript
// frontend/src/pages/ChatPage.tsx

// 1. Import components
import { BlockedBanner } from '../components/chat/BlockedBanner';
import { useBlockStatus } from '../hooks/useBlockStatus';
import { unblockUser } from '../lib/moderation';

// 2. Get other user ID for DIRECT conversations
const otherUserId = selectedConv?.type === 'DIRECT'
  ? selectedConv.members.find(m => m.userId !== currentUserId)?.userId
  : undefined;

// 3. Check block status
const { data: blockStatus } = useBlockStatus(currentUserId, otherUserId);
const isBlocked = blockStatus?.blocked || false;
const blockDirection = blockStatus?.direction || 'none';

// 4. Handle unblock
const handleUnblock = async () => {
  if (!otherUserId) return;
  await unblockUser(currentUserId, otherUserId);
  queryClient.invalidateQueries({ queryKey: ['blockStatus'] });
};

// 5. Render BlockedBanner instead of MessageInput
{isBlocked ? (
  <BlockedBanner
    type={blockDirection === 'blocker' ? 'blocker' : 'blocked'}
    userName={getUserById(otherUserId)?.name}
    onUnblock={blockDirection === 'blocker' ? handleUnblock : undefined}
  />
) : (
  <MessageInput
    onSend={handleSendMessage}
    onFileUpload={handleFileUpload}
    disabled={sendMessageMutation.isPending}
    onTypingStart={startTyping}
    onTypingStop={stopTyping}
  />
)}
```

**Test**:
- A blocks B → A sees "You blocked B" + Unblock button
- B opens chat with A → B sees "A blocked you" (no unblock)

---

### 4. Block Check in Reactions
**Status**: 🔄 TODO
**Files to Change**:
- `backend/src/modules/reactions/reactions.service.ts`

```typescript
// Add BlocksService dependency
constructor(
  private prisma: PrismaService,
  private blocks: BlocksService, // 👈 ADD THIS
) {}

// Update toggle method
async toggle(userId: string, messageId: string, emoji: string) {
  // 1. Get message
  const msg = await this.prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true, deletedAt: true },
  });
  if (!msg || msg.deletedAt) {
    throw new NotFoundException('Message not found');
  }

  // 2. Check if blocked
  const blocked = await this.blocks.isBlockedEither(userId, msg.senderId);
  if (blocked) {
    throw new ForbiddenException('Cannot react to messages from blocked users');
  }

  // 3. Continue with original logic...
}
```

**Test**:
- A blocks B → B tries to react to A's message → Should get 403 error
- Frontend should show toast: "Cannot react to this message"

---

### 5. Mobile Actions Menu (Three Dots)
**Status**: 🔄 TODO
**Implementation**: Option C - Three Dots Menu (Simplest)

**Files to Create/Change**:

**A. Create MessageActionsMenu Component**
```tsx
// frontend/src/components/chat/MessageActionsMenu.tsx
import { Edit, Trash, Flag, Ban, Copy, MoreVertical } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';

interface MessageActionsMenuProps {
  isOwn: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  onCopy?: () => void;
}

export function MessageActionsMenu({
  isOwn,
  onEdit,
  onDelete,
  onReport,
  onBlock,
  onCopy,
}: MessageActionsMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        {isOwn ? (
          <>
            {onEdit && (
              <MenuItem icon={<Edit />} onClick={onEdit}>
                Edit Message
              </MenuItem>
            )}
            {onDelete && (
              <MenuItem icon={<Trash />} onClick={onDelete} variant="danger">
                Delete Message
              </MenuItem>
            )}
          </>
        ) : (
          <>
            {onReport && (
              <MenuItem icon={<Flag />} onClick={onReport}>
                Report Message
              </MenuItem>
            )}
            {onBlock && (
              <MenuItem icon={<Ban />} onClick={onBlock} variant="danger">
                Block User
              </MenuItem>
            )}
          </>
        )}
        {onCopy && (
          <MenuItem icon={<Copy />} onClick={onCopy}>
            Copy Text
          </MenuItem>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MenuItem({ icon, children, onClick, variant = 'default' }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-100',
        variant === 'danger' && 'text-red-600 hover:bg-red-50'
      )}
    >
      {icon}
      {children}
    </button>
  );
}
```

**B. Update MessageItem.tsx**
```tsx
// Replace the hover actions with MessageActionsMenu

// Remove this:
<div className="mt-1 flex items-center gap-3 opacity-0 group-hover:opacity-100">
  {/* Edit, Delete, Report, Block buttons */}
</div>

// Add this (always visible):
<div className="mt-1">
  <MessageActionsMenu
    isOwn={isOwn}
    onEdit={isOwn ? handleStartEdit : undefined}
    onDelete={isOwn && onDelete ? () => onDelete(message.id) : undefined}
    onReport={!isOwn ? () => setReportModalOpen(true) : undefined}
    onBlock={!isOwn ? () => setBlockModalOpen(true) : undefined}
    onCopy={() => navigator.clipboard.writeText(message.content || '')}
  />
</div>
```

**Test**:
- Mobile: Three dots menu visible on all messages
- Click dots → Menu opens with correct actions
- Own message → Edit, Delete, Copy
- Other's message → Report, Block, Copy
- Click action → Executes correctly

---

### 6. Admin Panel for Reports
**Status**: ⚠️ FUTURE (Not urgent)
**Reason**: Reports can be viewed via backend API for now

**Quick Admin Solution** (until full panel built):
```bash
# View all reports
curl http://localhost:3000/moderation/reports \
  -H "X-Admin: 1"

# Resolve report
curl -X POST http://localhost:3000/moderation/reports/REPORT_ID/resolve \
  -H "Content-Type: application/json" \
  -H "X-Admin: 1" \
  -H "X-User-Id: ADMIN_USER_ID" \
  -d '{
    "action": "DELETE_MESSAGE",
    "resolutionNotes": "Inappropriate content removed"
  }'
```

**When building Admin Panel**:
- Create `/admin` route (protected)
- ReportsList component with filters
- ReportDetailModal for resolution
- Quick actions: Resolve, Reject, Ban, Delete

---

## 📋 NEXT STEPS (Priority Order)

### HIGH (Do Now - 1-2 hours)
1. ✅ Pin visual indicator
2. 🔄 **Integrate BlockedBanner in ChatPage** (30 mins)
3. 🔄 **Add block check in reactions.service** (15 mins)
4. 🔄 **Create MessageActionsMenu** (45 mins)

### MEDIUM (Next Sprint)
5. ⚠️ Admin panel for reports (2-3 hours)
6. Mobile UX improvements (long press menu)

### LOW (Nice to Have)
- Block expiry notifications
- Mute feature (less severe than block)
- Report statistics

---

## 🧪 TESTING CHECKLIST

### Block UI
- [ ] A blocks B → A sees "You blocked B" banner ✅
- [ ] A blocks B → Input hidden for A ✅
- [ ] A can unblock via banner button ✅
- [ ] B sees "A blocked you" banner (no unblock) ✅
- [ ] Input hidden for B ✅
- [ ] Unblock → Input reappears immediately ✅

### Reaction Block
- [ ] A blocks B → B cannot react to A's messages
- [ ] A blocks B → A cannot react to B's messages  
- [ ] Error toast shown: "Cannot react to blocked user"
- [ ] Unblock → Can react again

### Mobile Menu
- [ ] Three dots visible on all messages
- [ ] Menu opens correctly
- [ ] Own message: Edit, Delete, Copy
- [ ] Other's message: Report, Block, Copy
- [ ] Actions execute correctly
- [ ] Menu closes after action

---

## 📝 NOTES

- BlockedBanner matches Messenger's gray banner style ✅
- Block check uses existing `isBlockedEither` API ✅
- Mobile menu uses shadcn Popover component
- Admin panel postponed (can use curl for now)
- Consider adding "Mute" feature later (less severe)

