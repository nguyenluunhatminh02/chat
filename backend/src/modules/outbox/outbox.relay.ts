// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { MessagingGateway } from '../../websockets/messaging.gateway';
// import { SearchService } from '../search/search.service';
// import { PrismaService } from 'src/prisma/prisma.service';

// @Injectable()
// export class OutboxRelay implements OnModuleInit {
//   private log = new Logger(OutboxRelay.name);
//   private timer?: NodeJS.Timeout;

//   constructor(
//     private prisma: PrismaService,
//     private gw: MessagingGateway,
//     private search: SearchService, // <— inject SearchService
//   ) {}

//   onModuleInit() {
//     this.timer = setInterval(
//       // eslint-disable-next-line @typescript-eslint/no-misused-promises
//       () => this.tick().catch((e) => this.log.error(e)),
//       500,
//     );
//   }

//   async tick() {
//     const batch = await this.prisma.outbox.findMany({
//       where: { publishedAt: null },
//       orderBy: { createdAt: 'asc' },
//       take: 20,
//     });
//     if (!batch.length) return;

//     for (const ev of batch) {
//       try {
//         switch (ev.topic) {
//           case 'messaging.message_created': {
//             const { messageId, conversationId } = ev.payload as any;
//             const msg = await this.prisma.message.findUnique({
//               where: { id: messageId },
//             });
//             if (!msg) throw new Error('Message not found for outbox event');

//             // WS
//             this.gw.emitToConversation(conversationId, 'message.created', {
//               message: msg,
//             });

//             // Search index
//             await this.search.indexMessage({
//               id: msg.id,
//               conversationId: msg.conversationId,
//               senderId: msg.senderId,
//               type: msg.type,
//               content: msg.content,
//               createdAt: msg.createdAt.toISOString(),
//             });
//             break;
//           }

//           case 'messaging.message_updated': {
//             const { messageId } = ev.payload as any;
//             const msg = await this.prisma.message.findUnique({
//               where: { id: messageId },
//             });
//             if (!msg) throw new Error('Message not found for update');
//             // reindex (nếu content rỗng sẽ tự skip)
//             await this.search.indexMessage({
//               id: msg.id,
//               conversationId: msg.conversationId,
//               senderId: msg.senderId,
//               type: msg.type,
//               content: msg.content,
//               createdAt: msg.createdAt.toISOString(),
//             });
//             break;
//           }

//           case 'messaging.message_deleted': {
//             const { messageId } = ev.payload as any;
//             await this.search.removeMessage(messageId);
//             break;
//           }

//           default:
//             // Không làm gì, nhưng không fail batch
//             break;
//         }

//         await this.prisma.outbox.update({
//           where: { id: ev.id },
//           data: {
//             publishedAt: new Date(),
//             attempts: { increment: 1 },
//             lastError: null,
//           },
//         });
//       } catch (err: any) {
//         await this.prisma.outbox.update({
//           where: { id: ev.id },
//           data: {
//             attempts: { increment: 1 },
//             lastError: String(err?.message ?? err),
//           },
//         });
//       }
//     }
//   }
// }
