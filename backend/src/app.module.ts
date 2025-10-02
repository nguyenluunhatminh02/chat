import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { MessagingGateway } from './websockets/messaging.gateway';
import { PresenceModule } from './modules/presence/presence.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { ReactionsModule } from './modules/reactions/reactions.module';
import { OutboxModule } from './modules/outbox/outbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    PresenceModule,
    ReceiptsModule,
    ReactionsModule,
    OutboxModule,
  ],
  providers: [MessagingGateway],
})
export class AppModule {}
