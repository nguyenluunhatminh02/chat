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
import { FilesModule } from './modules/files/files.module';
import { SearchModule } from './modules/search/search.module';
import { BullModule } from '@nestjs/bullmq';
import { WebsocketsModule } from './websockets/websockets.module';
import { BlocksModule } from './modules/blocks/blocks.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { PushModule } from './modules/push/push.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      prefix: process.env.BULL_PREFIX || 'app',
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    PresenceModule,
    ReceiptsModule,
    ReactionsModule,
    OutboxModule,
    FilesModule,
    SearchModule,
    WebsocketsModule,
    BlocksModule,
    ModerationModule,
    PushModule,
    NotificationsModule,
  ],
})
export class AppModule {}
