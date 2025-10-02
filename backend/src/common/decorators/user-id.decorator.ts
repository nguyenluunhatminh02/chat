import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return (req.headers['x-user-id'] as string) || 'u1'; // tạm thời: mặc định u1 cho dev
  },
);
