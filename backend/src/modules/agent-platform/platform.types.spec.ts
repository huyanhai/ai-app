import { idKey, serviceToken } from './platform.types';

describe('Agent development defaults', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('matches agent/src/dev.ts exactly', () => {
    delete process.env.AGENT_SERVICE_TOKEN;
    delete process.env.AGENT_ID_KEY;
    delete process.env.APP_SERVER_ID_KEY;
    process.env.NODE_ENV = 'development';
    expect(serviceToken()).toBe('development-only-agent-token-0123456789abcdef');
    expect(idKey()).toBe('development-only');
  });

  it('requires explicit secrets in production', () => {
    delete process.env.AGENT_SERVICE_TOKEN;
    delete process.env.AGENT_ID_KEY;
    delete process.env.APP_SERVER_ID_KEY;
    process.env.NODE_ENV = 'production';
    expect(() => serviceToken()).toThrow('AGENT_SERVICE_TOKEN');
    expect(() => idKey()).toThrow('AGENT_ID_KEY');
  });
});
