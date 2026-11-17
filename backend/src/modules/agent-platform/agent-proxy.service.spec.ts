import { PassThrough } from 'node:stream';
import { AgentProxyService } from './agent-proxy.service';

describe('AgentProxyService', () => {
  const oldUrl = process.env.AGENT_SERVICE_URL;
  const oldToken = process.env.AGENT_SERVICE_TOKEN;
  const originalFetch = global.fetch;
  afterEach(() => {
    process.env.AGENT_SERVICE_URL = oldUrl;
    process.env.AGENT_SERVICE_TOKEN = oldToken;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('forwards new canvas session paths with trusted identity headers', async () => {
    process.env.AGENT_SERVICE_URL = 'http://agent:8090';
    process.env.AGENT_SERVICE_TOKEN = 's'.repeat(40);
    let requestUrl = '';
    let init: RequestInit;
    global.fetch = jest.fn(async (url, options) => {
      requestUrl = String(url);
      init = options;
      return new Response(JSON.stringify({ code: 0, msg: 'success', data: [] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }) as any;
    const req = {
      originalUrl: '/canvas/canvas-uuid/agent/sessions?limit=20', url: '/', method: 'POST',
      headers: { authorization: 'Bearer user', cookie: 'secret', 'content-type': 'application/json' },
      body: { title: '新会话' },
    } as any;
    const res = new PassThrough() as any;
    res.status = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn();
    res.headersSent = false;
    const done = new Promise<void>((resolve) => res.on('finish', resolve));
    await new AgentProxyService().forward(req, res);
    await done;
    expect(requestUrl).toBe('http://agent:8090/canvas/canvas-uuid/agent/sessions?limit=20');
    const headers = init.headers as Headers;
    expect(headers.get('x-agent-service-token')).toBe('s'.repeat(40));
    expect(headers.get('x-agent-user')).toBe('1');
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('cookie')).toBeNull();
    expect(init.body).toBe(JSON.stringify({ title: '新会话' }));
  });

  it('maps the frontend /agent/canvas prefix to the runtime canvas route', async () => {
    process.env.AGENT_SERVICE_URL = 'http://agent:8090';
    process.env.AGENT_SERVICE_TOKEN = 's'.repeat(40);
    let requestUrl = '';
    global.fetch = jest.fn(async (url) => {
      requestUrl = String(url);
      return new Response(null, { status: 204 });
    }) as any;
    const req = {
      originalUrl: '/agent/canvas/canvas-uuid/agent/sessions', url: '/', method: 'GET', headers: {},
    } as any;
    const res = new PassThrough() as any;
    res.status = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn();
    res.headersSent = false;
    const done = new Promise<void>((resolve) => res.on('finish', resolve));
    await new AgentProxyService().forward(req, res);
    await done;
    expect(requestUrl).toBe('http://agent:8090/canvas/canvas-uuid/agent/sessions');
  });
});
