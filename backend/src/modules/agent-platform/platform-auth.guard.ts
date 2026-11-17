import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { serviceToken } from './platform.types';

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const actual = Buffer.from(String(request.headers['x-agent-service-token'] ?? ''));
    const expected = Buffer.from(serviceToken());
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException('Agent 服务令牌无效');
    }
    return true;
  }
}
