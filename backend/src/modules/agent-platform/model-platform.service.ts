import { BadRequestException, Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { ModelsService } from '../models/models.service';
import { AgentPlatformService } from './agent-platform.service';
import { RunContext } from './platform.types';

@Injectable()
export class ModelPlatformService {
  constructor(
    private readonly models: ModelsService,
    private readonly platform: AgentPlatformService,
  ) {}

  async chatCompletions(rc: RunContext, body: Record<string, any>, req: Request, res: Response) {
    if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) {
      throw new BadRequestException('OpenAI 请求需要 messages 数组');
    }
    const runtime = await this.models.runtime(rc.model_key, 'text');
    const callId = this.platform.beginModelCall(rc);
    const abort = new AbortController();
    const abortUpstream = () => {
      if (!res.writableEnded) abort.abort();
    };
    req.once('aborted', abortUpstream);
    res.once('close', abortUpstream);
    try {
      const upstream = await fetch(`${runtime.baseURL.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${runtime.apiKey}`,
          'content-type': 'application/json',
          accept: body.stream ? 'text/event-stream' : 'application/json',
        },
        body: JSON.stringify({
          ...body,
          model: runtime.modelId,
          ...(body.stream ? { stream_options: { include_usage: true, ...body.stream_options } } : {}),
        }),
        signal: abort.signal,
      });
      res.status(upstream.status);
      upstream.headers.forEach((value, name) => {
        if (!['content-length', 'transfer-encoding', 'connection', 'content-encoding'].includes(name.toLowerCase())) {
          res.setHeader(name, value);
        }
      });
      res.setHeader('X-Agent-Call-Id', callId);
      if (!upstream.ok || !upstream.body) {
        const error = await upstream.text();
        this.platform.settleModelCall(rc, callId, {}, `HTTP ${upstream.status}`);
        res.send(error);
        return;
      }
      if (!body.stream) {
        const raw = await upstream.text();
        try {
          const payload = JSON.parse(raw);
          this.platform.settleModelCall(rc, callId, payload.usage || {});
        } catch {
          this.platform.settleModelCall(rc, callId, {}, '模型返回的不是 JSON');
        }
        res.send(raw);
        return;
      }
      let captured = '';
      const stream = Readable.fromWeb(upstream.body as any);
      stream.on('data', (chunk) => {
        if (captured.length < 4 * 1024 * 1024) captured += chunk.toString();
      });
      stream.on('end', () => {
        const usage = this.streamUsage(captured);
        this.platform.settleModelCall(rc, callId, usage || {});
      });
      stream.on('error', (error) => {
        this.platform.settleModelCall(rc, callId, {}, error.message);
        if (!res.writableEnded) res.end();
      });
      stream.pipe(res);
    } catch (error) {
      this.platform.settleModelCall(rc, callId, {}, error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      req.off('aborted', abortUpstream);
      res.off('close', abortUpstream);
    }
  }

  private streamUsage(raw: string) {
    let usage: Record<string, unknown> | undefined;
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
      try {
        const event = JSON.parse(line.slice(5).trim());
        if (event.usage) usage = event.usage;
      } catch {
        // Usage is optional; partial SSE chunks never block the model stream.
      }
    }
    return usage;
  }
}
