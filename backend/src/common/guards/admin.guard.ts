import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req: any = ctx.switchToHttp().getRequest();
    // DEMO: header X-Admin: 1
    if (req.headers['x-admin'] === '1') return true;
    throw new ForbiddenException('Admin only');
  }
}
