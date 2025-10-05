// src/modules/outbox/outbox.producer.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class OutboxProducer {
  constructor(private prisma: PrismaService) {}

  /** Emit ngoài transaction — idempotent theo (topic,eventKey) */
  async emit(
    topic: string,
    payload: any,
    eventKey?: string | null,
  ): Promise<void> {
    if (eventKey) {
      await this.prisma.outbox.createMany({
        data: [{ topic, eventKey, payload }],
        skipDuplicates: true, // ✅ không throw nếu trùng
      });
      return;
    }
    // eventKey null: cho phép nhiều bản ghi
    await this.prisma.outbox.create({
      data: { topic, eventKey: null, payload },
    });
  }

  /** Emit trong transaction — idempotent, không làm abort txn */
  async emitInTx(
    tx: Tx,
    topic: string,
    eventKey: string | null,
    payload: any,
  ): Promise<void> {
    if (eventKey) {
      await tx.outbox.createMany({
        data: [{ topic, eventKey, payload }],
        skipDuplicates: true, // ✅ không throw nếu trùng
      });
      return;
    }
    await tx.outbox.create({ data: { topic, eventKey: null, payload } });
  }
}
