import { io, Socket } from 'socket.io-client';

export class RealtimeClient {
  private socket?: Socket;
  private hbTimer?: any;

  connect(apiUrl: string, userId: string) {
    if (this.socket) this.disconnect();
    this.socket = io(apiUrl, {
      transports: ['websocket'],
      auth: { userId },
    });
    // gửi heartbeat mỗi 30s
    this.hbTimer = setInterval(() => this.socket?.emit('presence.heartbeat', {}), 30000);
    return this.socket;
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('join.conversation', { conversationId });
  }

  on<T = any>(event: string, handler: (payload: T) => void) {
    this.socket?.on(event, handler);
  }

  off(event: string, handler?: (...args: any[]) => void) {
    if (!this.socket) return;
    handler ? this.socket.off(event, handler) : this.socket.removeAllListeners(event);
  }

  disconnect() {
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.hbTimer = undefined;
    this.socket?.disconnect();
    this.socket = undefined;
  }
}

export const realtime = new RealtimeClient();
