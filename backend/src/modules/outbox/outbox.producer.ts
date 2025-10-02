import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
type Tx = Prisma.TransactionClient;

@Injectable()
export class OutboxProducer {
  constructor(private prisma: PrismaService) {}
  // ngoài transaction
  emit(topic: string, payload: any, eventKey?: string) {
    return this.prisma.outbox.create({
      data: { topic, payload, eventKey: eventKey ?? null },
    });
  }
  // trong transaction
  emitInTx(tx: Tx, topic: string, eventKey: string | null, payload: any) {
    return tx.outbox.create({ data: { topic, eventKey, payload } });
  }
}
