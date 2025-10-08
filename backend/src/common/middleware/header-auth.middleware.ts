import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HeaderUserMiddleware implements NestMiddleware {
  use(req: Request & { user?: any }, _res: Response, next: NextFunction) {
    const userId = req.header('X-User-Id');
    const workspaceId = req.header('X-Workspace-Id') || 'ws_default';
    if (userId) {
      req.user = { userId, workspaceId };
    }
    next();
  }
}
