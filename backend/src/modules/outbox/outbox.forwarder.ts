import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';

const FORWARDER_ID = `outbox-forwarder:${process.pid}`;

@Injectable()
export class OutboxForwarder implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OutboxForwarder.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('outbox') private readonly queue: Queue,
  ) {}

  onModuleInit() {
    this.timer = setInterval(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      () => this.tick().catch((e) => this.log.error(e)),
      400,
    );
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private safeJobId(s: string) {
    // BullMQ cấm dấu ":"
    return s.replace(/:/g, '_');
  }

  private buildJobId(ev: {
    topic: string;
    id: string;
    eventKey?: string | null;
  }) {
    const raw = ev.eventKey ?? `${ev.topic}__${ev.id}`; // dùng __ thay cho :
    return this.safeJobId(raw);
  }

  private async tick() {
    const batch = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.outbox.findMany({
        where: {
          publishedAt: null,
          OR: [
            { claimedAt: null },
            { claimedAt: { lt: new Date(Date.now() - 30_000) } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      if (!rows.length) return [] as typeof rows;

      const ids = rows.map((r) => r.id);
      await tx.outbox.updateMany({
        where: { id: { in: ids } },
        data: { claimedAt: new Date(), claimedBy: FORWARDER_ID },
      });
      return rows;
    });

    if (!batch.length) return;

    for (const ev of batch) {
      try {
        const jobId = this.buildJobId(ev);
        const opts: JobsOptions = {
          jobId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 24 * 3600 },
        };
        await this.queue.add(ev.topic, ev.payload as any, opts);

        await this.prisma.outbox.update({
          where: { id: ev.id },
          data: {
            publishedAt: new Date(),
            lastError: null,
            attempts: { increment: 1 },
          },
        });
      } catch (err: any) {
        await this.prisma.outbox.update({
          where: { id: ev.id },
          data: {
            attempts: { increment: 1 },
            lastError: String(err?.message ?? err),
          },
        });
      }
    }
  }
}
