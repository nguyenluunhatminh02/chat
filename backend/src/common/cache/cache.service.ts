// src/common/cache/cache.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

type MaybePromise<T> = T | Promise<T>;

@Injectable()
export class CacheService {
  private clientCache: any | null = null;

  constructor(@InjectQueue('outbox') private queue: Queue) {}

  /** Resolve client Redis từ BullMQ, cache sau lần đầu */
  private async getClient(): Promise<any> {
    if (this.clientCache) return this.clientCache;

    // BullMQ thường expose queue.client là Promise<Redis>
    let c: MaybePromise<any> = (this.queue as any).client;
    if (c && typeof c.then === 'function') {
      c = await (c as Promise<any>);
    }

    // Fallback: cấu hình connection
    if (!c || typeof c.get !== 'function') {
      c = (this.queue as any).opts?.connection;
    }

    if (!c || typeof c.get !== 'function') {
      throw new Error(
        '[CacheService] Redis client not available from BullMQ queue',
      );
    }

    this.clientCache = c;
    return c;
  }

  /** GET (parse JSON nếu có) */
  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = await this.getClient();
      const val = await redis.get(key);
      if (val == null) return null;
      try {
        return JSON.parse(val as string) as T;
      } catch {
        // nếu value không phải JSON
        return val as unknown as T;
      }
    } catch {
      return null;
    }
  }

  /** SET với TTL (tương thích ioredis & node-redis v4) */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const redis = await this.getClient();
      const str = JSON.stringify(value);

      if (!ttlSeconds || ttlSeconds <= 0) {
        await redis.set(key, str);
        return;
      }

      // node-redis v4 có setEx
      if (typeof redis.setEx === 'function') {
        await redis.setEx(key, ttlSeconds, str);
        return;
      }
      // ioredis có setex
      if (typeof redis.setex === 'function') {
        await redis.setex(key, ttlSeconds, str);
        return;
      }

      // Fallback: cả hai lib đều hiểu một trong hai cách dưới
      try {
        await redis.set(key, str, { EX: ttlSeconds }); // node-redis v4
      } catch {
        await redis.set(key, str, 'EX', ttlSeconds); // ioredis
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /** DEL */
  async del(key: string): Promise<void> {
    try {
      const redis = await this.getClient();
      await redis.del(key);
    } catch (error) {
      console.error('Cache del error:', error);
    }
  }

  /** Tiện ích: get-or-set */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const val = await loader();
    await this.set(key, val, ttlSeconds);
    return val;
  }
}
