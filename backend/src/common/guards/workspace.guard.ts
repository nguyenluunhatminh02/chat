import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private ws: WorkspacesService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<{
      user?: { id: string };
      headers: Record<string, string | string[] | undefined>;
      query: Record<string, string | undefined>;
      params: Record<string, string | undefined>;
      userId?: string;
      workspaceId?: string;
    }>();

    // Lấy userId từ JWT (nếu có) hoặc header
    let userId: string | undefined =
      req.user?.id ?? (req.headers['x-user-id'] as string | undefined);
    if (userId?.startsWith('"') && userId.endsWith('"'))
      userId = userId.slice(1, -1);
    if (!userId) throw new UnauthorizedException('Missing auth userId');

    // Lấy workspaceId từ header/query, nếu không có thì suy ra từ :id (conversationId)
    let workspaceId: string | undefined =
      (req.headers['x-workspace-id'] as string | undefined) ??
      req.query['workspaceId'];
    if (workspaceId?.startsWith('"') && workspaceId.endsWith('"'))
      workspaceId = workspaceId.slice(1, -1);

    if (!workspaceId) {
      const conversationId: string | undefined =
        req.params?.id ?? req.params?.conversationId;
      if (!conversationId) {
        throw new ForbiddenException(
          'Missing workspace: provide X-Workspace-Id or a conversation id param',
        );
      }
      const convWs =
        await this.ws.getWorkspaceIdByConversationId(conversationId);
      if (!convWs) throw new NotFoundException('Conversation not found');
      workspaceId = convWs;
    }

    await this.ws.assertMember(userId, workspaceId); // sẽ throw nếu không phải member
    req.userId = userId;
    req.workspaceId = workspaceId;
    return true;
  }
}
