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

@WebSocketGateway({ cors: { origin: '*' } })
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
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
  joinConversation(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const cid = body?.conversationId;
    if (!cid) return;
    client.join(`c:${cid}`);
  }

  emitToConversation(conversationId: string, event: string, payload: any) {
    this.server.to(`c:${conversationId}`).emit(event, payload);
  }
}
