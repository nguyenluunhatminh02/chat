import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private svc: WorkspacesService) {}

  @Post()
  create(@UserId() userId: string, @Body() body: { name: string }) {
    return this.svc.create(userId, body.name);
  }

  @Get('mine')
  my(@UserId() userId: string) {
    return this.svc.myWorkspaces(userId);
  }

  @Post(':id/members')
  addMember(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() body: { userId: string; role?: 'MEMBER' | 'ADMIN' },
  ) {
    return this.svc.addMember(userId, id, body.userId, body.role ?? 'MEMBER');
  }

  @Get(':id/members')
  listMembers(@UserId() userId: string, @Param('id') id: string) {
    return this.svc.listMembers(userId, id);
  }
}
