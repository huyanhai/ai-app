import { BadRequestException } from '@nestjs/common';
import { AgentPlatformService } from './agent-platform.service';
import { RunContext, decodeRunContext } from './platform.types';

const rc: RunContext = {
  run_id: 'run-cuid', user_id: '1', session_id: 'session-uuid', canvas_id: 'canvas-uuid', model_key: 'text-model',
};

const setup = () => {
  const node = {
    id: 'image-node', type: 'imageNode', position: { x: 0, y: 0 },
    data: { title: '关键帧', text: '雨夜街道', url: '', config: { model: 'image-model', count: 1 } },
  };
  const canvas = {
    getState: jest.fn(async () => ({
      revision: 3, nodes: [node], edges: [{ id: 'edge-1', source: 'image-node', target: 'video-node' }],
    })),
    applyOps: jest.fn(async () => ({ success: true, revision: 4, changed: 1 })),
    arrange: jest.fn(async () => ({ success: true, revision: 4, changed: 1 })),
    deleteNodes: jest.fn(async () => ({ success: true, revision: 4, changed: 1 })),
  };
  const models = {
    list: jest.fn(async () => [{
      id: 'text-model', name: '文本模型', category: 'text', enabled: true,
      description: '', params: { supportVision: true, contextWindow: 64000, maxTokens: 4096 },
    }]),
    runtime: jest.fn(async (id: string, category: string) => ({
      id: category === 'text' ? 'text-model' : 'image-model', name: category === 'text' ? '文本模型' : '图片模型',
      modelId: 'upstream-model', baseURL: 'http://model', apiKey: 'secret',
      params: JSON.stringify({ supportVision: true, contextWindow: 64000, maxTokens: 4096 }),
    })),
  };
  const generation = {
    create: jest.fn(async (input) => ({ id: 'job-cuid', ...input, status: 'pending', urls: [] })),
    get: jest.fn(async () => ({ id: 'job-cuid', kind: 'image', status: 'succeeded', urls: ['https://cdn/image.png'], modelName: '图片模型' })),
    run: jest.fn(async function* () { yield { type: 'done' }; }),
  };
  const prisma: any = {
    generationRecord: { findUnique: jest.fn(), createMany: jest.fn(async () => ({ count: 1 })) },
    agentMessage: { findMany: jest.fn() },
    canvasState: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
  };
  prisma.$transaction = jest.fn(async (callback) => callback(prisma));
  const service = new AgentPlatformService(
    prisma as any,
    models as any,
    canvas as any,
    { get: jest.fn(async () => ({ nodes: [], edges: [] })) } as any,
    {} as any,
    {} as any,
    { get: jest.fn(async () => null) } as any,
    { names: jest.fn(async () => new Set(['short-drama-develop'])) } as any,
    generation as any,
  );
  return { service, canvas, models, generation, prisma, node };
};

describe('AgentPlatformService', () => {
  it('decodes UUID/cuid run contexts without numeric ID parsing', () => {
    const header = Buffer.from(JSON.stringify(rc)).toString('base64url');
    expect(decodeRunContext(header)).toEqual(rc);
    expect(() => decodeRunContext(Buffer.from('{}').toString('base64url'))).toThrow(BadRequestException);
  });

  it('prepares the real model, tools and canvas first message', async () => {
    const { service } = setup();
    const result = await service.prepare(rc, { message: '创建镜头', max_steps: 12 });
    expect(result.model).toEqual({ name: '文本模型', context_window: 64000, max_tokens: 4096, vision: true });
    expect(result.first_message).toContain('canvas-uuid');
    expect(result.first_message).toContain('最多 12 步');
    expect(result.tools.map((tool) => tool.name)).toContain('canvas_apply_ops');
  });

  it('converts the model settings context size from K to tokens', async () => {
    const { service, models } = setup();
    const [model] = await models.list();
    models.list.mockResolvedValueOnce([{ ...model, params: { ...model.params, contextWindow: 128 } }]);
    expect((await service.models())[0].context_window).toBe(131072);
  });

  it('uses the shared skill directory when checking message references', async () => {
    const { service } = setup();
    await expect(service.checkMessage({
      user_id: '1', canvas_id: 'canvas-uuid', selection: ['image-node', 'deleted-node'],
      message: '@[短剧开发](skill:short-drama-develop)',
    })).resolves.toEqual({ selection: ['image-node'] });
    await expect(service.checkMessage({
      user_id: '1', canvas_id: 'canvas-uuid', message: '@[不存在](skill:missing)',
    })).rejects.toThrow('已不存在或不可用');
  });

  it('replays the same canvas write by idempotency key', async () => {
    const { service, canvas } = setup();
    const body = { tool_call_id: 'call-1', args: { operations: [{ action: 'delete_node', id: 'image-node' }] } };
    const [first, second] = await Promise.all([
      service.tool(rc, 'canvas_apply_ops', body, 'task-1'),
      service.tool(rc, 'canvas_apply_ops', body, 'task-1'),
    ]);
    expect(second).toEqual(first);
    expect(canvas.applyOps).toHaveBeenCalledTimes(1);
    await expect(service.tool(rc, 'canvas_apply_ops', {
      ...body, args: { operations: [{ action: 'delete_node', id: 'other' }] },
    }, 'task-1')).rejects.toThrow('不同参数');
  });

  it('accepts the reference op protocol and resolves temporary node IDs', async () => {
    const { service, canvas } = setup();
    const result = await service.tool(rc, 'canvas_apply_ops', {
      tool_call_id: 'create-text',
      args: { ops: [
        { op: 'create_node', tempId: 'draft', kind: 'script', label: '剧本', prompt: '第一版', position: { x: 120, y: 160 } },
        { op: 'update_node', id: 'draft', prompt: '第二版' },
      ] },
    }) as any;
    const operations = (canvas.applyOps.mock.calls as any[])[0][2];
    expect(operations[0]).toMatchObject({ action: 'create_node', node: { type: 'textNode', position: { x: 120, y: 160 } } });
    expect(operations[1]).toEqual({ action: 'update_node', id: operations[0].node.id, data: { text: '第二版' } });
    expect(result.data.id_map.draft).toBe(operations[0].node.id);
    expect(result.data.changes).toBe(1);
    expect(result.tool_end.node_ids).toEqual([operations[0].node.id]);
    expect(result.tool_end.created).toEqual([operations[0].node.id]);
    expect(result.tool_end.updated).toEqual([]);
  });

  it('validates generation and executes real generation jobs after approval', async () => {
    const { service, generation, canvas } = setup();
    const proposal = await service.propose(rc, 'generate', { items: [{ node_id: 'image-node' }] });
    expect(proposal.is_error).toBe(false);
    expect(proposal.payload.items[0]).toMatchObject({ node_id: 'image-node', model_key: 'image-model', count: 1 });
    const outcome = service.resolve('generate', proposal.payload, { decision: 'approve' });
    const execution = await service.execute(rc, 'generate', 'approval-cuid', outcome);
    expect(execution.status).toBe('executed');
    expect(execution.result.tasks[0]).toEqual({ node_id: 'image-node', task_id: 'job-cuid', credits: 0 });
    expect(generation.create).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'image', modelId: 'image-model', prompt: '雨夜街道',
    }));
    expect(canvas.applyOps).toHaveBeenCalled();
    expect(await service.execute(rc, 'generate', 'approval-cuid', outcome)).toBe(execution);
    expect(generation.create).toHaveBeenCalledTimes(1);
  });

  it('supports partial delete decisions and rejects empty approvals', async () => {
    const { service } = setup();
    const payload = { node_ids: ['image-node', 'video-node'], edge_ids: ['edge-1'] };
    const outcome = service.resolve('delete', payload, {
      decision: 'approve', items: [{ index: 1, approve: false }],
    });
    expect(outcome).toMatchObject({ status: 'partially_approved', node_ids: ['image-node'] });
    expect(outcome.decision).toEqual({ decision: 'approve', node_ids: ['image-node'] });
    expect(() => service.resolve('delete', payload, {
      decision: 'approve', items: [{ index: 0, approve: false }, { index: 1, approve: false }],
    })).toThrow('至少需要批准一项');
    const execution = await service.execute(rc, 'delete', 'approval-delete', outcome);
    expect(execution.status).toBe('executed');
  });

  it('requires answers to required questions without executing side effects', async () => {
    const { service } = setup();
    const proposal = await service.propose(rc, 'ask', { question: '选择画幅', kind: 'choice', options: ['16:9', '9:16'] });
    expect(proposal.terminate).toBe(true);
    expect(() => service.resolve('ask', proposal.payload, { decision: 'approve', answers: [] })).toThrow('请回答');
    const outcome = service.resolve('ask', proposal.payload, {
      decision: 'approve', answers: [{ id: '1', value: '16:9' }],
    });
    await expect(service.execute(rc, 'ask', 'approval-ask', outcome)).resolves.toMatchObject({
      status: 'none', outcome_text: '选择画幅：16:9',
    });
    expect(proposal.payload.questions[0].options).toEqual([
      { label: '16:9', follow: '' }, { label: '9:16', follow: '' },
    ]);
    expect(proposal.payload.options).toEqual(['16:9', '9:16']);
  });

  it('restores modified node content and reports it as a reverted change', async () => {
    const { service, prisma } = setup();
    prisma.canvasState.findUnique.mockResolvedValue({
      nodes: JSON.stringify([{ id: 'node-1', data: { text: 'new' } }]), edges: '[]', revision: 4,
      past: JSON.stringify([{ agentRunId: rc.run_id, nodes: [{ id: 'node-1', data: { text: 'old' } }], edges: [] }]),
    });
    await expect(service.undo(rc)).resolves.toEqual({ reverted: 1, skipped: [], revision: 5 });
    expect(prisma.canvasState.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nodes: JSON.stringify([{ id: 'node-1', data: { text: 'old' } }]), past: '[]', revision: 5 }),
    }));
  });

  it('returns missing for unknown tasks and validates the full event batch', async () => {
    const { service, generation } = setup();
    const { NotFoundException } = await import('@nestjs/common');
    generation.get.mockRejectedValueOnce(new NotFoundException());
    await expect(service.taskStates({ user_id: '1', task_ids: ['unknown-cuid'] })).resolves.toEqual({
      items: [{ task_id: 'unknown-cuid', status: 'missing' }],
    });
    expect(service.receiveEvents([{
      user_id: '1', session_id: 'session-uuid', canvas_id: 'canvas-uuid', run_id: 'run-cuid',
      seq: 1, type: 'run.started', data: {}, created_at: new Date().toISOString(),
    }])).toBeNull();
    expect(() => service.receiveEvents([{ user_id: '1' }])).toThrow(BadRequestException);
  });
});
