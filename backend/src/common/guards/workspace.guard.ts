import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private ws: WorkspacesService) {}

  async canActivate(ctx: ExecutionContext) {
    const req: any = ctx.switchToHttp().getRequest();
    const userId = req.headers['x-user-id'] as string;
    const workspaceId =
      (req.headers['x-workspace-id'] as string) || req.query['workspaceId'];

    if (!userId || !workspaceId) return false;

    await this.ws.assertMember(userId, workspaceId); // throw nếu không phải member
    req.workspaceId = workspaceId;
    return true;
  }
}
