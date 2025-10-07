import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { PresenceModule } from './modules/presence/presence.module';
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
import { PinsModule } from './modules/pins/pins.module';
import { ReadsModule } from './modules/reads/reads.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { MentionsModule } from './modules/mentions/mentions.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { LinkPreviewModule } from './modules/link-preview/link-preview.module';
import { CacheModule } from './common/cache/cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule,
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
    ReactionsModule,
    OutboxModule,
    FilesModule,
    SearchModule,
    WebsocketsModule,
    BlocksModule,
    ModerationModule,
    PushModule,
    NotificationsModule,
    PinsModule,
    ReadsModule,
    WorkspacesModule,
    MentionsModule,
    TransferModule,
    AnalyticsModule,
    LinkPreviewModule,
  ],
})
export class AppModule {}
