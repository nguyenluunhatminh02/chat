Tới **PHẦN 8 — Edit & Delete (soft-delete) + realtime events**. Phần này nhỏ, không đụng Kafka. Làm xong bạn có thể **sửa nội dung tin** và **xóa mềm** rồi phát WS: `message.updated` / `message.deleted`.

> Ghi chú: Prisma `Message` đã có `editedAt`, `deletedAt` từ Phần 4 → không cần migrate.

---

## 1) DTO cho chỉnh sửa

**`src/modules/messages/dto/update-message.dto.ts`**

```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string; // cho TEXT/caption
}
```

---

## 2) Service: edit & soft-delete (kèm kiểm quyền)

Cập nhật **`src/modules/messages/messages.service.ts`** (thêm 2 method `edit` và `softDelete`):

```ts
import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingGateway } from '../../websockets/messaging.gateway';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gateway: MessagingGateway,
  ) {}

  async list(conversationId: string, cursor?: string, limit = 30) {
    return this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  async send(userId: string, dto: SendMessageDto) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: dto.conversationId, userId } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Not a member');

    const [msg] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: dto.conversationId,
          senderId: userId,
          type: dto.type as any,
          content: dto.content ?? null,
          parentId: dto.parentId ?? null,
        },
      }),
      this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    this.gateway.emitToConversation(dto.conversationId, 'message.created', { message: msg });
    return msg;
  }

  // ====== NEW: Edit message ======
  async edit(userId: string, messageId: string, dto: UpdateMessageDto) {
    if (!dto.content?.trim()) throw new BadRequestException('Content required');

    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, conversationId: true, deletedAt: true },
    });
    if (!msg) throw new NotFoundException('Message not found');

    // chỉ cho chính người gửi sửa
    if (msg.senderId !== userId) throw new ForbiddenException('Only sender can edit');
    if (msg.deletedAt) throw new BadRequestException('Message already deleted');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: dto.content, editedAt: new Date() },
    });

    this.gateway.emitToConversation(msg.conversationId, 'message.updated', {
      id: updated.id,
      content: updated.content,
      editedAt: updated.editedAt,
    });

    return updated;
  }

  // ====== NEW: Soft delete ======
  async softDelete(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, conversationId: true, deletedAt: true },
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.deletedAt) return msg; // idempotent

    // cho phép: chính sender hoặc member có role ADMIN/OWNER
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: msg.conversationId, userId } },
      select: { role: true },
    });
    if (!member) throw new ForbiddenException('Not a member');

    const isSender = msg.senderId === userId;
    const canAdmin = member.role === 'ADMIN' || member.role === 'OWNER';
    if (!isSender && !canAdmin) throw new ForbiddenException('No permission to delete');

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), content: null }, // xóa nội dung hiển thị
    });

    this.gateway.emitToConversation(msg.conversationId, 'message.deleted', {
      id: deleted.id,
      deletedAt: deleted.deletedAt,
    });

    return deleted;
  }
}
```

---

## 3) Controller: endpoints PATCH & DELETE

Cập nhật **`src/modules/messages/messages.controller.ts`**:

```ts
import { Body, Controller, Get, Param, Post, Patch, Delete, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('messages')
export class MessagesController {
  constructor(private svc: MessagesService) {}

  @Get(':conversationId')
  list(@Param('conversationId') cid: string, @Query('cursor') cursor?: string, @Query('limit') limit = 30) {
    return this.svc.list(cid, cursor, Number(limit));
  }

  @Post()
  send(@UserId() userId: string, @Body() dto: SendMessageDto) {
    return this.svc.send(userId, dto);
  }

  // ====== NEW: Edit ======
  @Patch(':id')
  edit(@UserId() userId: string, @Param('id') id: string, @Body() dto: UpdateMessageDto) {
    return this.svc.edit(userId, id, dto);
  }

  // ====== NEW: Soft delete ======
  @Delete(':id')
  delete(@UserId() userId: string, @Param('id') id: string) {
    return this.svc.softDelete(userId, id);
  }
}
```

> `GET /messages/:conversationId` đã lọc `deletedAt: null`, nên tin đã xóa sẽ không còn trong danh sách. Clients nhận `message.deleted` để ẩn ngay lập tức.

---

## 4) Test nhanh (Windows-friendly)

### 4.1 Sửa tin nhắn

**PowerShell**

```powershell
curl.exe -X PATCH http://localhost:3000/messages/<MID> `
  -H 'Content-Type: application/json' `
  -H 'X-User-Id: u1' `
  -d '{"content":"(edited) new content"}'
```

**CMD**

```bat
curl -X PATCH http://localhost:3000/messages/<MID> ^
 -H "Content-Type: application/json" ^
 -H "X-User-Id: u1" ^
 -d "{\"content\":\"(edited) new content\"}"
```

> `<MID>` là id message do **u1** gửi.
> Hai tab đã join room `c:<CID>` (Phần 5) sẽ nhận WS sự kiện:

```js
// event name: 'message.updated'
{ id: "<MID>", content: "(edited) new content", editedAt: "..." }
```

### 4.2 Xóa mềm

**PowerShell**

```powershell
curl.exe -X DELETE http://localhost:3000/messages/<MID> -H 'X-User-Id: u1'
```

**CMD**

```bat
curl -X DELETE http://localhost:3000/messages/<MID> -H "X-User-Id: u1"
```

Clients nhận:

```js
// event name: 'message.deleted'
{ id: "<MID>", deletedAt: "..." }
```

`GET /messages/<CID>` sẽ không còn thấy tin này.

---

## ✅ Tiêu chí hoàn thành Phần 8

* Sửa tin: `PATCH /messages/:id` (chỉ **sender** được sửa, không sửa tin đã xóa).
* Xóa mềm: `DELETE /messages/:id` (sender **hoặc** ADMIN/OWNER).
* Realtime: phát `message.updated` / `message.deleted` tới room của conversation.
* Danh sách tin đã loại bỏ tin xóa.

Bạn muốn **PHẦN 9** tiếp theo không? Đề xuất: **Reactions + Reply/Thread** (nhẹ) **hoặc** **Idempotency-Key** để chống gửi trùng (và chuẩn bị lên Outbox/Kafka). Chọn một hướng nhé!
