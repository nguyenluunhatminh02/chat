import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private r: RedisClientType;
  private ttlSec = 60; // client heartbeat ~30–45s

  constructor() {
    this.r = createClient({ url: process.env.REDIS_URL });
  }

  async onModuleInit() {
    await this.r.connect();
  }
  async onModuleDestroy() {
    await this.r.quit();
  }

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
}
