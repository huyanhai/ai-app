import { Injectable } from '@nestjs/common';
import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { encodeAgentId } from './id-codec';
import { idKey } from './platform.types';

export type AgentRelayEvent = {
  user_id: string;
  session_id: string;
  canvas_id: string;
  run_id: string;
  seq: number;
  type: string;
  data: unknown;
  created_at: string;
};

type AgentSocket = WebSocket & { canvasId: string; alive: boolean };

@Injectable()
export class AgentEventsGateway {
  private wss?: WebSocketServer;

  attach(server: HttpServer) {
    if (this.wss) return;
    const wss = new WebSocketServer({ noServer: true });
    this.wss = wss;
    server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(request.url || '/', 'http://localhost');
      if (!['/agent/events', '/api/v1/agent/events'].includes(url.pathname)) return;
      wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit('connection', client, request);
      });
    });
    wss.on('connection', (client: AgentSocket, request: IncomingMessage) => {
      const url = new URL(request.url || '/', 'http://localhost');
      client.canvasId = url.searchParams.get('canvasId') || '';
      client.alive = true;
      if (!client.canvasId) {
        client.close(1008, 'canvasId required');
        return;
      }
      client.on('pong', () => { client.alive = true; });
      client.on('error', () => client.terminate());
    });
    const heartbeat = setInterval(() => {
      for (const client of wss.clients as Set<AgentSocket>) {
        if (!client.alive) {
          client.terminate();
          continue;
        }
        client.alive = false;
        client.ping();
      }
    }, 30_000);
    server.on('close', () => {
      clearInterval(heartbeat);
      wss.close();
    });
  }

  publish(events: AgentRelayEvent[]) {
    if (!this.wss) return;
    const key = idKey();
    for (const event of events) {
      const canvasId = event.canvas_id === '0' ? '' : encodeAgentId(event.canvas_id, key);
      const message = JSON.stringify({
        session_id: encodeAgentId(event.session_id, key),
        canvas_id: canvasId,
        run_id: event.run_id === '0' ? null : encodeAgentId(event.run_id, key),
        seq: event.seq,
        type: event.type,
        data: event.data ?? {},
        created_at: event.created_at,
      });
      for (const client of this.wss.clients as Set<AgentSocket>) {
        const channel = event.canvas_id === '0' ? '0' : canvasId;
        if (client.readyState === WebSocket.OPEN && client.canvasId === channel) {
          client.send(message);
        }
      }
    }
  }
}
