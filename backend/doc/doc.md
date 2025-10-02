Tới **PHẦN 5 — WebSocket realtime (Socket.IO) phát `message.created` khi POST /messages`**. Nhỏ gọn, không cần Redis/Kafka.

---

## 0) Cài thêm package

```bash
pnpm add @nestjs/websockets @nestjs/platform-socket.io
```

---

## 1) Tạo Gateway

**`src/websockets/messaging.gateway.ts`**

```ts
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  async handleConnection(client: Socket) {
    // Nhận userId từ handshake.auth.userId (client gửi lên)
    const userId = client.handshake.auth?.userId;
    if (!userId) return client.disconnect(true);
    client.join(`u:${userId}`); // room riêng cho user nếu cần
  }

  async handleDisconnect(_client: Socket) {
    // có thể log/cleanup nếu cần
  }

  @SubscribeMessage('join.conversation')
  joinConversation(@MessageBody() body: any, @ConnectedSocket() client: Socket) {
    const cid = body?.conversationId;
    if (!cid) return;
    client.join(`c:${cid}`);
  }

  emitToConversation(conversationId: string, event: string, payload: any) {
    this.server.to(`c:${conversationId}`).emit(event, payload);
  }
}
```

---

## 2) Đăng ký Gateway vào AppModule

Mở **`src/app.module.ts`** và thêm provider:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './modules/users/users.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { MessagingGateway } from './websockets/messaging.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
  ],
  providers: [MessagingGateway], // <— thêm dòng này
})
export class AppModule {}
```

---

## 3) Sửa MessagesService để phát WS sau khi tạo tin

**`src/modules/messages/messages.service.ts`** (chỉ khác: inject `MessagingGateway` và emit sau khi create)

```ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingGateway } from '../../websockets/messaging.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gateway: MessagingGateway,        // <— inject gateway
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

    // 🔔 Phát realtime tới room của conversation
    this.gateway.emitToConversation(dto.conversationId, 'message.created', { message: msg });

    return msg;
  }
}
```

---

## 4) Test nhanh realtime (2 tab trình duyệt)

### Cách nạp Socket.IO client trong console

Mở **2 tab** tới bất kỳ trang (hoặc `about:blank`), mở DevTools Console và chạy:

**Tab A (u1)**

```js
var s=document.createElement('script');s.src='https://cdn.socket.io/4.7.2/socket.io.min.js';document.head.appendChild(s);
setTimeout(()=>{
  window.s1 = io("http://localhost:3000",{ transports:['websocket'], auth:{ userId:'u1' }});
  s1.emit('join.conversation',{ conversationId:'<CID>' }); // thay <CID> = id conversation
  s1.on('message.created', (e)=>console.log('A got:', e));
}, 800);
```

**Tab B (u2)**

```js
var s=document.createElement('script');s.src='https://cdn.socket.io/4.7.2/socket.io.min.js';document.head.appendChild(s);
setTimeout(()=>{
  window.s2 = io("http://localhost:3000",{ transports:['websocket'], auth:{ userId:'u2' }});
  s2.emit('join.conversation',{ conversationId:'<CID>' });
  s2.on('message.created', (e)=>console.log('B got:', e));
}, 800);
```

> `<CID>` là `conversation.id` bạn tạo ở phần 3.

### Gửi tin bằng cURL (Windows)

**PowerShell**

```powershell
curl.exe -X POST http://localhost:3000/messages `
  -H 'Content-Type: application/json' `
  -H 'X-User-Id: u1' `
  -d '{"conversationId":"<CID>","type":"TEXT","content":"Hello realtime!"}'
```

**Windows CMD**

```bat
curl -X POST http://localhost:3000/messages ^
 -H "Content-Type: application/json" ^
 -H "X-User-Id: u1" ^
 -d "{\"conversationId\":\"<CID>\",\"type\":\"TEXT\",\"content\":\"Hello realtime!\"}"
```

Cả **Tab A** và **Tab B** sẽ log `message.created`.

---

## ✅ Tiêu chí hoàn thành Phần 5

* Socket.IO Gateway hoạt động, client join room `c:<conversationId>`.
* Khi POST `/messages`, server **emit** `message.created` đến room đó.
* Test thành công với 2 tab, 2 user khác nhau.

Bạn muốn **Phần 6** không? Gợi ý tiếp theo: **Presence đơn giản (online/last seen) bằng Redis TTL** hoặc **Edit/Delete + Read Receipts** (không cần Redis). Chọn một nhánh để mình viết tiếp nha.
