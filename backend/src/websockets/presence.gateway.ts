import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserPresenceService } from '../modules/user-presence/user-presence.service';

@WebSocketGateway({ cors: true, namespace: '/presence' })
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Map socket ID to user ID
  private socketToUser = new Map<string, string>();
  // Map user ID to socket IDs (multiple connections)
  private userToSockets = new Map<string, Set<string>>();

  constructor(private presenceService: UserPresenceService) {}

  async handleConnection(client: Socket) {
    try {
      // Get user ID from auth token
      const userId = this.getUserIdFromSocket(client);

      if (!userId) {
        client.disconnect();
        return;
      }

      // Track socket
      this.socketToUser.set(client.id, userId);
      if (!this.userToSockets.has(userId)) {
        this.userToSockets.set(userId, new Set());
      }
      this.userToSockets.get(userId)!.add(client.id);

      // Set user online
      await this.presenceService.setOnline(userId);

      // Broadcast to others
      this.broadcastPresenceUpdate(userId);

      console.log(`User ${userId} connected (socket: ${client.id})`);
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);

    if (!userId) return;

    // Remove socket
    this.socketToUser.delete(client.id);
    const userSockets = this.userToSockets.get(userId);

    if (userSockets) {
      userSockets.delete(client.id);

      // If user has no more connections, set offline
      if (userSockets.size === 0) {
        this.userToSockets.delete(userId);
        await this.presenceService.setOffline(userId);
        this.broadcastPresenceUpdate(userId);
        console.log(`User ${userId} disconnected (all sockets closed)`);
      } else {
        console.log(
          `User ${userId} disconnected (socket: ${client.id}), but still has ${userSockets.size} connection(s)`,
        );
      }
    }
  }

  @SubscribeMessage('presence:update')
  async handleUpdatePresence(
    @MessageBody()
    data: { status: 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY' | 'DO_NOT_DISTURB' },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.socketToUser.get(client.id);
    if (!userId) return;

    await this.presenceService.updatePresence(userId, data.status);
    this.broadcastPresenceUpdate(userId);
  }

  @SubscribeMessage('presence:custom_status')
  async handleUpdateCustomStatus(
    @MessageBody() data: { customStatus: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.socketToUser.get(client.id);
    if (!userId) return;

    await this.presenceService.updateCustomStatus(userId, data.customStatus);
    this.broadcastPresenceUpdate(userId);
  }

  @SubscribeMessage('presence:clear_custom_status')
  async handleClearCustomStatus(@ConnectedSocket() client: Socket) {
    const userId = this.socketToUser.get(client.id);
    if (!userId) return;

    await this.presenceService.clearCustomStatus(userId);
    this.broadcastPresenceUpdate(userId);
  }

  @SubscribeMessage('presence:heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = this.socketToUser.get(client.id);
    if (!userId) return;

    await this.presenceService.heartbeat(userId);
  }

  @SubscribeMessage('presence:subscribe_workspace')
  async handleSubscribeWorkspace(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Join workspace room to receive presence updates
    client.join(`workspace:${data.workspaceId}`);

    // Send current online users
    const online = await this.presenceService.getOnlineUsersInWorkspace(
      data.workspaceId,
    );
    client.emit('presence:workspace_online', { users: online });
  }

  @SubscribeMessage('presence:unsubscribe_workspace')
  handleUnsubscribeWorkspace(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`workspace:${data.workspaceId}`);
  }

  /**
   * Broadcast presence update to workspace members
   */
  private async broadcastPresenceUpdate(userId: string) {
    const presence = await this.presenceService.getPresence(userId);

    // In a real app, you'd get the user's workspaces and broadcast to those rooms
    // For now, broadcast to all
    this.server.emit('presence:user_updated', {
      userId,
      presence,
    });
  }

  /**
   * Extract user ID from socket authentication
   * In production, validate JWT token from handshake
   */
  private getUserIdFromSocket(socket: Socket): string | null {
    // Option 1: From query params
    const userId = socket.handshake.query.userId as string;
    if (userId) return userId;

    // Option 2: From auth token (JWT)
    // const token = socket.handshake.auth.token;
    // const decoded = this.jwtService.verify(token);
    // return decoded.userId;

    // Option 3: From headers
    // const token = socket.handshake.headers.authorization?.split(' ')[1];
    // ...

    return null;
  }

  /**
   * Check if user is currently connected
   */
  isUserConnected(userId: string): boolean {
    return this.userToSockets.has(userId);
  }

  /**
   * Get number of connections for a user
   */
  getUserConnectionCount(userId: string): number {
    return this.userToSockets.get(userId)?.size || 0;
  }
}
