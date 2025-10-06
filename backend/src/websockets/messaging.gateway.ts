import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PresenceService } from 'src/modules/presence/presence.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(private presence: PresenceService) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId;
    if (!userId) return client.disconnect(true);
    await this.presence.heartbeat(userId);
    client.join(`u:${userId}`);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.handshake.auth?.userId as string | undefined;
    if (userId) await this.presence.setLastSeen(userId);
  }

  @SubscribeMessage('join.conversation')
  joinConversation(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const cid = body?.conversationId;
    if (!cid) return;
    client.join(`c:${cid}`);
  }

  @SubscribeMessage('presence.heartbeat')
  async wsHeartbeat(@MessageBody() _b: any, @ConnectedSocket() client: Socket) {
    const userId = client.handshake.auth?.userId as string | undefined;
    if (userId) await this.presence.heartbeat(userId);
  }

  // ===== NEW: typing.start / typing.stop / typing.heartbeat =====
  @SubscribeMessage('typing.start')
  async typingStart(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.handshake.auth?.userId as string | undefined;
    const cid = body?.conversationId;
    if (!userId || !cid) return;
    await this.presence.typingStart(userId, cid);
    const list = await this.presence.getTyping(cid);
    this.server
      .to(`c:${cid}`)
      .emit('typing.update', { conversationId: cid, typing: list });
  }

  @SubscribeMessage('typing.stop')
  async typingStop(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.handshake.auth?.userId as string | undefined;
    const cid = body?.conversationId;
    if (!userId || !cid) return;
    await this.presence.typingStop(userId, cid);
    const list = await this.presence.getTyping(cid);
    this.server
      .to(`c:${cid}`)
      .emit('typing.update', { conversationId: cid, typing: list });
  }

  // Khi user vẫn đang gõ, client gửi đều 2–3s/lần để refresh TTL
  @SubscribeMessage('typing.heartbeat')
  async typingHeartbeat(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.handshake.auth?.userId as string | undefined;
    const cid = body?.conversationId;
    if (!userId || !cid) return;
    await this.presence.typingStart(userId, cid); // giống start: gia hạn TTL
    // Có thể không cần emit mỗi nhịp để tránh spam UI. Client tự tắt sau 6s nếu không thấy update.
  }

  emitToConversation(conversationId: string, event: string, payload: any) {
    this.server.to(`c:${conversationId}`).emit(event, payload);
  }
  emitToUsers(userIds: string[], event: string, payload: any) {
    userIds.forEach((uid) => this.server.to(`u:${uid}`).emit(event, payload));
  }

  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(`u:${userId}`).emit(event, payload);
  }
}
