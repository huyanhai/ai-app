import { WebSocket } from 'ws';
import { AgentEventsGateway } from './agent-events.gateway';
import { encodeAgentId } from './id-codec';

describe('AgentEventsGateway', () => {
  it('encodes relay ids and only sends to the matching canvas channel', () => {
    process.env.AGENT_ID_KEY = 'test-key';
    const gateway = new AgentEventsGateway();
    const canvasId = encodeAgentId('7', 'test-key');
    const matching = { readyState: WebSocket.OPEN, canvasId, send: jest.fn() };
    const other = { readyState: WebSocket.OPEN, canvasId: 'other-canvas', send: jest.fn() };
    (gateway as any).wss = { clients: new Set([matching, other]) };

    gateway.publish([{
      user_id: '1', session_id: '11', canvas_id: '7', run_id: '0', seq: 2,
      type: 'message.done', data: { text: 'done' }, created_at: new Date().toISOString(),
    }]);

    expect(other.send).not.toHaveBeenCalled();
    expect(matching.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(matching.send.mock.calls[0][0])).toMatchObject({
      session_id: encodeAgentId('11', 'test-key'), canvas_id: canvasId, run_id: null,
      seq: 2, type: 'message.done', data: { text: 'done' },
    });
  });
});
