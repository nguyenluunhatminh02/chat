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
const TX_MAX_RETRIES = 5;
const TX_BASE_DELAY_MS = 100;

@Injectable()
export class OutboxForwarder implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OutboxForwarder.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('outbox') private readonly queue: Queue,
  ) {}

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isTransactionTimeoutError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2028'
    );
  }

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

  private async claimBatch() {
    for (let attempt = 1; attempt <= TX_MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
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
          },
          {
            maxWait: 2_000,
            timeout: 7_000,
          },
        );
      } catch (error) {
        if (this.isTransactionTimeoutError(error)) {
          const backoff = TX_BASE_DELAY_MS * attempt ** 2;
          this.log.warn(
            `Transaction contention (P2028) while claiming outbox events. Retry ${attempt}/${TX_MAX_RETRIES} after ${backoff}ms`,
          );
          await this.sleep(backoff);
          continue;
        }

        throw error;
      }
    }

    this.log.error(
      `Failed to claim outbox batch after ${TX_MAX_RETRIES} retries due to transaction contention`,
    );
    return [] as Awaited<ReturnType<typeof this.prisma.outbox.findMany>>;
  }

  private async tick() {
    const batch = await this.claimBatch();

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
