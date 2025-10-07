import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    let userId = (req.headers['x-user-id'] as string) || 'u1';

    // Fix double-quoted userId from localStorage
    if (userId.startsWith('"') && userId.endsWith('"')) {
      userId = userId.slice(1, -1);
    }

    return userId;
  },
);
