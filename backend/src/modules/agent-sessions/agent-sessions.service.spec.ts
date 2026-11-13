import { AgentSessionsService } from './agent-sessions.service';

jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

describe('AgentSessionsService', () => {
  it('scopes session listing and creation to the current canvas', async () => {
    const prisma = {
      agentSession: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn((input) => input.data),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const service = new AgentSessionsService(prisma as any, {} as any, {} as any);

    await service.list('canvas-1');
    await service.create('canvas-1');
    await service.claimLegacy('canvas-1');

    expect(prisma.agentSession.findMany).toHaveBeenCalledWith({
      where: { canvasId: 'canvas-1' },
      orderBy: { updatedAt: 'desc' },
    });
    expect(prisma.agentSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ canvasId: 'canvas-1' }),
    });
    expect(prisma.agentSession.updateMany).toHaveBeenCalledWith({
      where: { canvasId: 'default' },
      data: { canvasId: 'canvas-1' },
    });
  });

  it('passes history to the agent and persists both messages', async () => {
    const contentState = '{"root":{"children":[]}}';
    const prisma = {
      agentSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          title: '新会话',
          messages: [],
        }),
        create: jest.fn(),
        update: jest.fn((input) => input),
        delete: jest.fn(),
      },
      agentMessage: {
        create: jest.fn((input) => input),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const ai = {
      stream: jest.fn(async function* () {
        yield { type: 'msg_chunk', content: 'Hello' };
      }),
    };
    const files = {
      save: jest.fn().mockResolvedValue([]),
      load: jest.fn().mockResolvedValue([]),
      removeSession: jest.fn(),
    };
    const service = new AgentSessionsService(
      prisma as any,
      ai as any,
      files as any,
    );

    const events = [];
    for await (const event of service.stream(
      'session-1',
      '  第一个问题  ',
      'model-1',
      undefined,
      undefined,
      [],
      [],
      'agent',
      contentState,
    )) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'msg_chunk', content: 'Hello' }]);
    expect(ai.stream).toHaveBeenCalledWith(
      '  第一个问题  ',
      undefined,
      undefined,
      'model-1',
      [],
      { skillIds: [], subjects: [], mode: 'agent' },
    );
    expect(prisma.agentSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { title: '第一个问题' },
    });
    expect(prisma.agentMessage.create).toHaveBeenNthCalledWith(1, {
      data: {
        sessionId: 'session-1',
        role: 'user',
        content: '  第一个问题  ',
        attachments: '[]',
        subjects: '[]',
        mode: 'agent',
        contentState,
      },
    });
    expect(prisma.agentMessage.create).toHaveBeenNthCalledWith(2, {
      data: {
        sessionId: 'session-1',
        role: 'assistant',
        content: 'Hello',
        mode: 'agent',
      },
    });
  });
});
