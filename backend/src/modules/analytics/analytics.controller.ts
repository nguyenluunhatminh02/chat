import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { UserId } from '../../common/decorators/user-id.decorator';
import { WorkspaceId } from '../../common/decorators/workspace-id.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';

@Controller('analytics')
@UseGuards(WorkspaceGuard)
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}

  // DAU/WAU/MAU => change granularity=day|week|month
  @Get('active')
  active(
    @UserId() userId: string,
    @WorkspaceId() wsId: string,
    @Query('granularity') granularity?: 'day' | 'week' | 'month',
    @Query('range') range?: string, // "30d" | "2025-09-01|2025-10-02"
    @Query('tz') tz?: string,
  ) {
    return this.svc.activeUsers({
      userId,
      workspaceId: wsId,
      granularity,
      range,
      tz,
    });
  }

  // Retention weekly: cohorts & matrix
  @Get('retention')
  retention(
    @UserId() userId: string,
    @WorkspaceId() wsId: string,
    @Query('weeks') weeks?: string,
    @Query('range') range?: string,
    @Query('tz') tz?: string,
  ) {
    const n = weeks ? Number(weeks) : undefined;
    return this.svc.retentionWeekly({
      userId,
      workspaceId: wsId,
      weeks: n,
      tz,
      range,
    });
  }

  // Top conversations
  @Get('top-conversations')
  top(
    @UserId() userId: string,
    @WorkspaceId() wsId: string,
    @Query('range') range?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.topConversations({
      userId,
      workspaceId: wsId,
      range,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
