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
    // Nhận userId từ handshake.auth.userId (client gửi lên)
    const userId = client.handshake.auth?.userId;
    if (!userId) return client.disconnect(true);
    await this.presence.heartbeat(userId);
    client.join(`u:${userId}`); // room riêng cho user nếu cần
  }

  async handleDisconnect(client: Socket) {
    const userId = client.handshake.auth?.userId as string | undefined;
    if (userId) await this.presence.setLastSeen(userId);
    // có thể log/cleanup nếu cần
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

  // Heartbeat qua WS (thay cho REST nếu muốn)
  @SubscribeMessage('presence.heartbeat')
  async wsHeartbeat(@MessageBody() _b: any, @ConnectedSocket() client: Socket) {
    const userId = client.handshake.auth?.userId as string | undefined;
    if (userId) await this.presence.heartbeat(userId);
  }

  emitToConversation(conversationId: string, event: string, payload: any) {
    this.server.to(`c:${conversationId}`).emit(event, payload);
  }
  emitToUsers(userIds: string[], event: string, payload: any) {
    userIds.forEach((uid) => this.server.to(`u:${uid}`).emit(event, payload));
  }
}
