import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req: any = ctx.switchToHttp().getRequest();
    return req.workspaceId as string | undefined;
  },
);
