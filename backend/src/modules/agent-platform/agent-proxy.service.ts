import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { serviceToken } from './platform.types';

@Injectable()
export class AgentProxyService {
  async forward(req: Request, res: Response) {
    const target = process.env.AGENT_SERVICE_URL || 'http://127.0.0.1:8090';
    let base: URL;
    try {
      base = new URL(target);
      if (!['http:', 'https:'].includes(base.protocol)) throw new Error();
    } catch {
      throw new ServiceUnavailableException('Agent 服务地址必须是 http(s) URL');
    }
    const original = req.originalUrl || req.url;
    const path = original
      .replace(/^\/api\/v1(?=\/)/, '')
      .replace(/^\/agent\/canvas(?=\/)/, '/canvas');
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (['host', 'authorization', 'cookie', 'content-length', 'connection', 'transfer-encoding'].includes(name)) continue;
      if (typeof value === 'string') headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(', '));
    }
    headers.set('X-Agent-Service-Token', serviceToken());
    headers.set('X-Agent-User', '1');
    headers.set('X-Agent-Role', '');
    let body: string | undefined;
    if (!['GET', 'HEAD'].includes(req.method) && req.body !== undefined) {
      body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }
    let upstream: globalThis.Response;
    try {
      upstream = await fetch(new URL(path, base), {
        method: req.method, headers, body, redirect: 'manual',
      });
    } catch {
      if (!res.headersSent) res.status(503).json({ code: 503, msg: 'Agent 服务暂时不可用' });
      return;
    }
    res.status(upstream.status);
    upstream.headers.forEach((value, name) => {
      if (!['content-length', 'transfer-encoding', 'connection', 'content-encoding'].includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });
    if (!upstream.body) {
      res.end();
      return;
    }
    const stream = Readable.fromWeb(upstream.body as any);
    stream.on('error', () => {
      if (!res.writableEnded) res.end();
    });
    stream.pipe(res);
  }
}
