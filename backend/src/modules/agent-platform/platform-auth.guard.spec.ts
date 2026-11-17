import { UnauthorizedException } from '@nestjs/common';
import { PlatformAuthGuard } from './platform-auth.guard';

describe('PlatformAuthGuard', () => {
  const oldToken = process.env.AGENT_SERVICE_TOKEN;
  afterEach(() => { process.env.AGENT_SERVICE_TOKEN = oldToken; });

  it('accepts only the configured service token', () => {
    process.env.AGENT_SERVICE_TOKEN = 't'.repeat(40);
    const guard = new PlatformAuthGuard();
    const context = (token: string) => ({
      switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-agent-service-token': token } }) }),
    }) as any;
    expect(guard.canActivate(context('t'.repeat(40)))).toBe(true);
    expect(() => guard.canActivate(context('wrong'))).toThrow(UnauthorizedException);
  });
});
