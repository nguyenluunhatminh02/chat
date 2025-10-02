Ok, tới **PHẦN 11 — Outbox (DB) + Relay (phát sự kiện)**.
Mục tiêu: thay vì phát WS trực tiếp trong `MessagesService`, ta **ghi sự kiện vào bảng Outbox** trong **cùng transaction**, sau đó **Relay** đọc Outbox và phát `message.created`. Cách này chuẩn bị sẵn để nối Kafka/Redpanda về sau.

> Phần này **nhỏ** và không cài thêm package.

---

## 1) Cập nhật Prisma schema

Mở `prisma/schema.prisma` và **thêm** model `Outbox`:

```prisma
model Outbox {
  id          String   @id @default(cuid())
  topic       String
  eventKey    String?
  payload     Json
  createdAt   DateTime @default(now())
  publishedAt DateTime?
  attempts    Int      @default(0)
  lastError   String?
  
  @@index([topic, createdAt])
}
```

Chạy migrate:

```bash
pnpm dlx prisma migrate dev -n outbox_init && pnpm dlx prisma generate
```

---

## 2) Tạo OutboxProducer (ghi sự kiện trong transaction)

**`src/modules/outbox/outbox.producer.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
type Tx = Prisma.TransactionClient;

@Injectable()
export class OutboxProducer {
  constructor(private prisma: PrismaService) {}
  // ngoài transaction
  emit(topic: string, payload: any, eventKey?: string) {
    return this.prisma.outbox.create({ data: { topic, payload, eventKey: eventKey ?? null } });
  }
  // trong transaction
  emitInTx(tx: Tx, topic: string, eventKey: string | null, payload: any) {
    return tx.outbox.create({ data: { topic, eventKey, payload } });
  }
}
```

---

## 3) Tạo RelayService (đọc Outbox → phát WS rồi “đánh dấu đã phát”)

**`src/modules/outbox/outbox.relay.ts`**

```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MessagingGateway } from '../../websockets/messaging.gateway';

@Injectable()
export class OutboxRelay implements OnModuleInit {
  private log = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private gw: MessagingGateway) {}

  onModuleInit() {
    // tick mỗi 500ms là đủ cho dev; sau này có thể dùng @nestjs/schedule
    this.timer = setInterval(() => this.tick().catch(e => this.log.error(e)), 500);
  }

  async tick() {
    // lấy một mớ record chưa publish
    const batch = await this.prisma.outbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    if (batch.length === 0) return;

    for (const ev of batch) {
      try {
        switch (ev.topic) {
          case 'messaging.message_created': {
            const { messageId, conversationId } = ev.payload as any;
            // lấy message đầy đủ để push cho client
            const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
            if (!msg) throw new Error('Message not found for outbox event');
            this.gw.emitToConversation(conversationId, 'message.created', { message: msg });
            break;
          }
          // có thể thêm các topic khác ở đây (reaction, receipt, v.v.)
          default:
            // chưa hỗ trợ thì bỏ qua (hoặc log)
            this.log.warn(`Unhandled topic: ${ev.topic}`);
        }

        await this.prisma.outbox.update({
          where: { id: ev.id },
          data: { publishedAt: new Date(), attempts: { increment: 1 }, lastError: null },
        });
      } catch (err: any) {
        await this.prisma.outbox.update({
          where: { id: ev.id },
          data: { attempts: { increment: 1 }, lastError: String(err?.message ?? err) },
        });
      }
    }
  }
}
```

---

## 4) OutboxModule

**`src/modules/outbox/outbox.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { OutboxProducer } from './outbox.producer';
import { OutboxRelay } from './outbox.relay';

@Module({
  providers: [OutboxProducer, OutboxRelay],
  exports: [OutboxProducer],
})
export class OutboxModule {}
```

---

## 5) Ghép vào AppModule

Mở **`src/app.module.ts`**, import `OutboxModule` (và đảm bảo `MessagingGateway` là provider như từ Phần 5):

```ts
import { OutboxModule } from './modules/outbox/outbox.module';

@Module({
  imports: [
    // ...
    OutboxModule,
  ],
})
export class AppModule {}
```

---

## 6) Sửa `MessagesService` để **không** phát WS trực tiếp, mà ghi Outbox

Mở **`src/modules/messages/messages.service.ts`**, thay vì `this.gateway.emitToConversation(...)`, ta ghi Outbox trong **cùng transaction**:

```ts
// thêm import:
import { OutboxProducer } from '../outbox/outbox.producer';

// trong constructor:
constructor(
  private prisma: PrismaService,
  private gateway: MessagingGateway, // vẫn có thể giữ nếu nơi khác dùng
  private outbox: OutboxProducer,    // <-- thêm
) {}

// trong method send(...):
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

// 🔁 Thay vì phát WS ngay, ta ghi Outbox trong transaction riêng (hoặc dùng $transaction hiện tại nếu bạn wrap khác)
await this.outbox.emit('messaging.message_created', {
  messageId: msg.id,
  conversationId: dto.conversationId,
});

return msg;
```

> Nếu bạn muốn **chặt chẽ hơn** (đảm bảo “đã tạo message” và “đã ghi outbox” nằm trong **cùng transaction**), bạn có thể gói cả `message.create`, `conversation.update` **và** `outbox.emitInTx(tx, ...)` trong **một** `$transaction(async (tx)=>{...})`. Với code hiện tại, do `emit` gọi DB riêng sau transaction trước kết thúc nên vẫn ok trong dev; bản enterprise dùng `emitInTx`.

**Ví dụ dùng `emitInTx` trong cùng tx** (chặt chẽ hơn):

```ts
const msg = await this.prisma.$transaction(async (tx) => {
  const m = await tx.message.create({ data: { conversationId: dto.conversationId, senderId: userId, type: dto.type as any, content: dto.content ?? null, parentId: dto.parentId ?? null } });
  await tx.conversation.update({ where: { id: dto.conversationId }, data: { updatedAt: new Date() } });
  await this.outbox.emitInTx(tx, 'messaging.message_created', m.id, { messageId: m.id, conversationId: dto.conversationId });
  return m;
});
return msg;
```

> **Quan trọng:** Hãy **xóa/dời** đoạn `this.gateway.emitToConversation(...)` cũ để tránh phát **trùng**.

---

## 7) Test nhanh

1. Khởi động:

```bash
pnpm start:dev
```

2. Mở 2 tab trình duyệt và join room (giống Phần 5) — thay `<CID>` bằng id hội thoại:

```js
var s=document.createElement('script');s.src='https://cdn.socket.io/4.7.2/socket.io.min.js';document.head.appendChild(s);
setTimeout(()=>{
  window.s1 = io("http://localhost:3000",{ transports:['websocket'], auth:{ userId:'u1' }});
  s1.emit('join.conversation',{ conversationId:'<CID>' });
  s1.on('message.created', (e)=>console.log('A got:', e));
},800);
setTimeout(()=>{
  window.s2 = io("http://localhost:3000",{ transports:['websocket'], auth:{ userId:'u2' }});
  s2.emit('join.conversation',{ conversationId:'<CID>' });
  s2.on('message.created', (e)=>console.log('B got:', e));
},900);
```

3. Gửi tin (PowerShell):

```powershell
curl.exe -X POST http://localhost:3000/messages `
  -H 'Content-Type: application/json' -H 'X-User-Id: u1' `
  -d '{"conversationId":"<CID>","type":"TEXT","content":"Hello via Outbox"}'
```

Kết quả:

* Tab A/B vẫn nhận `message.created` — nhưng lần này là do **Relay** đọc từ **Outbox** và phát.
* Mở **Prisma Studio** để thấy bản ghi outbox đã có `publishedAt`:

```bash
pnpm dlx prisma studio
```

---

## ✅ Tiêu chí hoàn thành Phần 11

* Có bảng **Outbox** để lưu sự kiện.
* `MessagesService.send` **không** phát WS trực tiếp; thay vào đó **ghi Outbox** trong transaction.
* **Relay** đọc Outbox, phát `message.created`, đánh dấu `publishedAt`.
* Sẵn sàng cắm Kafka/Redpanda (chỉ cần thay `Relay` publish lên Kafka thay vì phát WS trực tiếp).

---

Bạn muốn **PHẦN 12** tiếp tục không?
Gợi ý: **File upload (MinIO) — presign POST + attach vào message** (nhẹ, chạy được ngay), hoặc **Meilisearch (search message/convo)**. Chọn 1 để mình viết tiếp từng bước nhỏ nghen!
