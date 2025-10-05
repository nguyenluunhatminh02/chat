import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private prisma: PrismaService) {
    // Configure VAPID details
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.logger.log('VAPID configured successfully');
    } else {
      this.logger.warn('VAPID keys not configured - Web Push will not work');
    }
  }

  getPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY || '';
  }

  async subscribe(userId: string, subscription: PushSubscription) {
    const { endpoint, keys } = subscription;

    // Upsert: update userId if endpoint exists, or create new
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return { ok: true };
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.pushSubscription
      .delete({ where: { endpoint } })
      .catch(() => {
        // Ignore if not found
      });
    return { ok: true };
  }

  async sendToUser(userId: string, payload: any): Promise<{ sent: number }> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (!subscriptions.length) {
      return { sent: 0 };
    }

    let sent = 0;
    const promises = subscriptions.map(async (sub) => {
      const wpSub: PushSubscription = {
        endpoint: sub.endpoint,
        expirationTime: null,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(wpSub, JSON.stringify(payload));
        sent++;
        this.logger.debug(
          `Push sent to ${userId} (${sub.endpoint.slice(0, 50)}...)`,
        );
      } catch (error: any) {
        // If subscription is dead (410 Gone or 404 Not Found), remove it
        if (error?.statusCode === 410 || error?.statusCode === 404) {
          this.logger.warn(
            `Removing dead subscription: ${sub.endpoint.slice(0, 50)}...`,
          );
          await this.prisma.pushSubscription
            .delete({ where: { endpoint: sub.endpoint } })
            .catch(() => {});
        } else {
          this.logger.error(`Push failed: ${error?.message || error}`);
        }
      }
    });

    await Promise.all(promises);
    return { sent };
  }
}
