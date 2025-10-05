import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private r: RedisClientType;
  private ttlSec = 60; // presence heartbeat TTL
  private typingTtlSec = 6; // hiển thị "đang gõ" ~ 6s sau mỗi ping

  constructor() {
    this.r = createClient({ url: process.env.REDIS_URL });
  }

  async onModuleInit() {
    await this.r.connect();
  }
  async onModuleDestroy() {
    await this.r.quit();
  }

  // ===== Presence (đã có từ phần 6) =====
  async heartbeat(userId: string) {
    await this.r.set(`presence:${userId}`, '1', { EX: this.ttlSec });
  }

  async setLastSeen(userId: string) {
    await this.r.set(`lastseen:${userId}`, Date.now().toString());
  }

  async isOnline(userId: string) {
    return (await this.r.exists(`presence:${userId}`)) === 1;
  }

  async lastSeen(userId: string) {
    const v = await this.r.get(`lastseen:${userId}`);
    return v ? new Date(Number(v)) : null;
  }

  // ===== Typing (mới) =====
  // Key phụ: typing:conv:<cid> (SET các user đang gõ) + typing:conv:<cid>:<uid> (TTL)
  async typingStart(userId: string, conversationId: string) {
    const setKey = `typing:conv:${conversationId}`;
    const userKey = `typing:conv:${conversationId}:${userId}`;
    await this.r.sAdd(setKey, userId);
    await this.r.set(userKey, '1', { EX: this.typingTtlSec }); // tự hết hạn nếu không ping
  }

  async typingStop(userId: string, conversationId: string) {
    const setKey = `typing:conv:${conversationId}`;
    const userKey = `typing:conv:${conversationId}:${userId}`;
    await this.r.del(userKey);
    await this.r.sRem(setKey, userId);
  }

  // Lấy danh sách còn hiệu lực (lọc theo TTL key)
  async getTyping(conversationId: string): Promise<string[]> {
    const setKey = `typing:conv:${conversationId}`;
    const members = await this.r.sMembers(setKey);
    if (!members.length) return [];
    // filter: chỉ giữ user còn TTL key tồn tại
    const exists = await Promise.all(
      members.map((uid) =>
        this.r.exists(`typing:conv:${conversationId}:${uid}`),
      ),
    );
    const alive = members.filter((uid, i) => exists[i] === 1);
    // dọn rác: xoá khỏi SET các uid đã hết hạn
    const garbage = members.filter((uid, i) => exists[i] === 0);
    if (garbage.length) await this.r.sRem(setKey, garbage);
    return alive;
  }
}
