import { io, Socket } from 'socket.io-client';

export class RealtimeClient {
  private socket?: Socket;
  private hbTimer?: ReturnType<typeof setInterval>;

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

  on<T = unknown>(event: string, handler: (payload: T) => void) {
    this.socket?.on(event, handler);
  }

  off<T = unknown>(event: string, handler?: (payload: T) => void) {
    if (!this.socket) return;
    if (handler) {
      this.socket.off(event, handler);
    } else {
      this.socket.removeAllListeners(event);
    }
  }

  emit(event: string, data?: unknown) {
    this.socket?.emit(event, data);
  }

  disconnect() {
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.hbTimer = undefined;
    this.socket?.disconnect();
    this.socket = undefined;
  }
}

export const realtime = new RealtimeClient();
