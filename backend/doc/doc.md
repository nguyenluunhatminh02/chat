Ok, tới **PHẦN 13 — Search (Meilisearch) cho tin nhắn**.
Mục tiêu: index tin nhắn khi **tạo/sửa/xoá** (qua Outbox Relay) và có API `GET /search/messages` để tìm theo từ khoá, có filter theo conversation.

---

# 0) Chạy Meilisearch (dev)

**Docker (Windows PowerShell/CMD):**

```bat
docker run --name chat-meili -p 7700:7700 -e MEILI_NO_ANALYTICS=true -e MEILI_MASTER_KEY=meili_master -d getmeili/meilisearch:v1.7
```

`.env`:

```env
MEILI_HOST=http://localhost:7700
MEILI_API_KEY=meili_master
MEILI_INDEX_MESSAGES=messages
```

Cài SDK:

```bash
pnpm add meilisearch
```

---

# 1) SearchModule (service + controller)

### `src/modules/search/search.module.ts`

```ts
import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  providers: [SearchService],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
```

### `src/modules/search/search.service.ts`

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';

export type SearchableMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  content: string | null;
  createdAt: string; // ISO
};

@Injectable()
export class SearchService implements OnModuleInit {
  private client = new MeiliSearch({
    host: process.env.MEILI_HOST!,
    apiKey: process.env.MEILI_API_KEY!,
  });
  private indexName = process.env.MEILI_INDEX_MESSAGES || 'messages';

  async onModuleInit() {
    // tạo index nếu chưa có + cấu hình attributes
    const idx = await this.client.index(this.indexName);
    try {
      await this.client.getIndex(this.indexName);
    } catch {
      await this.client.createIndex(this.indexName, { primaryKey: 'id' });
    }
    await idx.updateSettings({
      searchableAttributes: ['content'],
      filterableAttributes: ['conversationId', 'senderId', 'type', 'createdAt'],
      sortableAttributes: ['createdAt'],
      typoTolerance: { enabled: true },
    });
  }

  async indexMessage(doc: SearchableMessage) {
    // chỉ index khi có content (TEXT/caption). FILE/IMAGE không content thì bỏ qua
    if (!doc.content || !doc.content.trim()) return;
    await this.client.index(this.indexName).addDocuments([doc], { primaryKey: 'id' });
  }

  async removeMessage(id: string) {
    await this.client.index(this.indexName).deleteDocument(id).catch(() => {});
  }

  async searchMessages(q: string, opts?: { conversationId?: string; limit?: number; offset?: number }) {
    const filters: string[] = [];
    if (opts?.conversationId) filters.push(`conversationId = "${opts.conversationId}"`);

    const res = await this.client.index(this.indexName).search(q, {
      limit: opts?.limit ?? 20,
      offset: opts?.offset ?? 0,
      filter: filters.length ? filters.join(' AND ') : undefined,
      attributesToHighlight: ['content'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      sort: ['createdAt:desc'],
    });

    return {
      query: q,
      limit: res.limit,
      offset: res.offset,
      estimatedTotalHits: res.estimatedTotalHits,
      hits: res.hits.map((h: any) => ({
        id: h.id,
        conversationId: h.conversationId,
        senderId: h.senderId,
        type: h.type,
        content: h.content,
        createdAt: h.createdAt,
        highlight: h._formatted?.content ?? null,
      })),
    };
  }
}
```

### `src/modules/search/search.controller.ts`

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get('messages')
  messages(
    @Query('q') q: string,
    @Query('conversationId') conversationId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = limit ? Number(limit) : undefined;
    const off = offset ? Number(offset) : undefined;
    return this.svc.searchMessages(q ?? '', { conversationId, limit: lim, offset: off });
  }
}
```

---

# 2) Ghép vào AppModule

**`src/app.module.ts`** (thêm `SearchModule`):

```ts
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [
    // ...
    SearchModule,
  ],
})
export class AppModule {}
```

---

# 3) Bắt sự kiện từ Outbox để **index** (create/update/delete)

Chúng ta đã có **OutboxRelay** ở PHẦN 11. Ta mở rộng để:

* Khi `messaging.message_created` → emit WS (đang có) **và** index.
* Thêm xử lý `messaging.message_updated` → index lại.
* Thêm xử lý `messaging.message_deleted` → remove khỏi index.

### Sửa `src/modules/outbox/outbox.relay.ts`

```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MessagingGateway } from '../../websockets/messaging.gateway';
import { SearchService } from '../search/search.service';

@Injectable()
export class OutboxRelay implements OnModuleInit {
  private log = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private gw: MessagingGateway,
    private search: SearchService,          // <— inject SearchService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick().catch(e => this.log.error(e)), 500);
  }

  async tick() {
    const batch = await this.prisma.outbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    if (!batch.length) return;

    for (const ev of batch) {
      try {
        switch (ev.topic) {
          case 'messaging.message_created': {
            const { messageId, conversationId } = ev.payload as any;
            const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
            if (!msg) throw new Error('Message not found for outbox event');

            // WS
            this.gw.emitToConversation(conversationId, 'message.created', { message: msg });

            // Search index
            await this.search.indexMessage({
              id: msg.id,
              conversationId: msg.conversationId,
              senderId: msg.senderId,
              type: msg.type,
              content: msg.content,
              createdAt: msg.createdAt.toISOString(),
            });
            break;
          }

          case 'messaging.message_updated': {
            const { messageId } = ev.payload as any;
            const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
            if (!msg) throw new Error('Message not found for update');
            // reindex (nếu content rỗng sẽ tự skip)
            await this.search.indexMessage({
              id: msg.id,
              conversationId: msg.conversationId,
              senderId: msg.senderId,
              type: msg.type,
              content: msg.content,
              createdAt: msg.createdAt.toISOString(),
            });
            break;
          }

          case 'messaging.message_deleted': {
            const { messageId } = ev.payload as any;
            await this.search.removeMessage(messageId);
            break;
          }

          default:
            // Không làm gì, nhưng không fail batch
            break;
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

> Nếu `constructor` báo DI error, đảm bảo `SearchModule` export `SearchService` (đã export) và `OutboxModule` nằm sau `SearchModule` trong `AppModule` **hoặc** cả hai cùng được Nest tự resolve.

---

# 4) Phát Outbox khi **edit** / **delete**

Ở **PHẦN 8**, ta đã sửa/xoá và emit WS trực tiếp. Giờ thêm **ghi Outbox** để Indexer biết.

### Sửa `src/modules/messages/messages.service.ts` (thêm 2 dòng `outbox.emit(...)`)

```ts
// imports:
import { OutboxProducer } from '../outbox/outbox.producer';

// constructor:
constructor(
  private prisma: PrismaService,
  private gateway: MessagingGateway,
  private outbox: OutboxProducer,   // <— thêm
) {}

// trong edit(...)
const updated = await this.prisma.message.update({
  where: { id: messageId },
  data: { content: dto.content, editedAt: new Date() },
});
this.gateway.emitToConversation(msg.conversationId, 'message.updated', {
  id: updated.id, content: updated.content, editedAt: updated.editedAt,
});
// NEW: outbox cho search
await this.outbox.emit('messaging.message_updated', { messageId: updated.id });

return updated;

// trong softDelete(...)
const deleted = await this.prisma.message.update({
  where: { id: messageId },
  data: { deletedAt: new Date(), content: null },
});
this.gateway.emitToConversation(msg.conversationId, 'message.deleted', {
  id: deleted.id, deletedAt: deleted.deletedAt,
});
// NEW: outbox cho search
await this.outbox.emit('messaging.message_deleted', { messageId: deleted.id });

return deleted;
```

> Với `send(...)`, bạn đã ghi `messaging.message_created` ở PHẦN 11 — giữ nguyên.

---

# 5) Test nhanh

## 5.1 Reindex tự động khi tạo tin

* Chạy Meilisearch + server:

  ```bash
  pnpm start:dev
  ```
* Gửi tin TEXT:

  ```powershell
  curl.exe -X POST http://localhost:3000/messages `
    -H 'Content-Type: application/json' -H 'X-User-Id: u1' `
    -d '{"conversationId":"<CID>","type":"TEXT","content":"Xin chào thế giới realtime search"}'
  ```
* Tìm:

  ```powershell
  curl.exe "http://localhost:3000/search/messages?q=ch\u00e0o"
  ```

## 5.2 Edit → reindex

```powershell
curl.exe -X PATCH http://localhost:3000/messages/<MID> `
  -H 'Content-Type: application/json' -H 'X-User-Id: u1' `
  -d '{"content":"Xin ch\u00e0o *NestJS* si\u00eau t\u1ed1c"}'

curl.exe "http://localhost:3000/search/messages?q=NestJS"
```

## 5.3 Delete → remove khỏi index

```powershell
curl.exe -X DELETE http://localhost:3000/messages/<MID> -H 'X-User-Id: u1'
curl.exe "http://localhost:3000/search/messages?q=NestJS"
```

---

# 6) Ghi chú & best practices

* **Filter theo room**: thêm `?conversationId=<CID>` để chỉ tìm trong 1 cuộc trò chuyện.
* **Chỉ index TEXT/caption**: messages `FILE/IMAGE` có `content=null` sẽ **không** vào index (có thể đổi nếu bạn muốn).
* **Khởi tạo index một lần**: `onModuleInit` đã đảm bảo index + settings tồn tại.
* **Bảo mật**: Meilisearch có key — đừng lộ `MEILI_API_KEY` cho client. API `/search/messages` nằm trong server của bạn.
* **Unicode & dấu tiếng Việt**: Meili hỗ trợ normalize cơ bản. Nếu muốn không phân biệt dấu sâu hơn, có thể bật `diacritics` plugin ở Meili (phiên bản mới) hoặc lưu thêm trường `content_no_diacritic`.

---

## ✅ Tiêu chí hoàn thành PHẦN 13

* Meilisearch chạy tại `:7700` với master key.
* OutboxRelay index `message_created/updated/deleted`.
* API `GET /search/messages` hoạt động, trả highlight.

Bạn muốn đi tiếp **PHẦN 14** không? Gợi ý: **Notifications** (web push/FCM) hoặc **Typing indicators** + **Presence nâng cao (who is typing)**.
