import { BadRequestException } from '@nestjs/common';
import { ChunkStatus } from '@/common/utils/ai-stream-utils';
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
    expect(result.system_prompt).toContain('提示词必须使用中文');
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

  it('normalizes the layout argument before arranging canvas nodes', async () => {
    const { service, canvas } = setup();
    const result = await service.tool(rc, 'canvas_arrange', {
      tool_call_id: 'arrange-layout',
      args: { layout: 'row', nodeIds: ['image-node'] },
    }) as any;
    expect(result.is_error).toBe(false);
    expect(canvas.arrange).toHaveBeenCalledWith(
      'canvas-uuid',
      'run-cuid',
      { mode: 'row', nodeIds: ['image-node'] },
      undefined,
    );
  });

  it('accepts the reference op protocol and resolves temporary node IDs', async () => {
    const { service, canvas } = setup();
    const result = await service.tool(rc, 'canvas_apply_ops', {
      tool_call_id: 'create-text',
      args: { ops: [
        { op: 'create_node', tempId: 'draft', kind: 'script', label: '剧本', prompt: '第一版', position: { x: 120, y: 160 }, width: 600, height: 400 },
        { op: 'update_node', id: 'draft', prompt: '第二版' },
      ] },
    }) as any;
    const operations = (canvas.applyOps.mock.calls as any[])[0][2];
    expect(operations[0]).toMatchObject({ action: 'create_node', node: { type: 'textNode', position: { x: 120, y: 160 } } });
    expect(operations[0].node.width).toBeUndefined();
    expect(operations[0].node.height).toBeUndefined();
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
    expect(canvas.applyOps).toHaveBeenCalledWith(rc.canvas_id, rc.run_id, [{
      action: 'update_node', id: 'image-node', data: expect.objectContaining({ status: ChunkStatus.PROCESSING }),
    }]);
    await new Promise(setImmediate);
    expect(canvas.applyOps).toHaveBeenCalledWith(rc.canvas_id, rc.run_id, [{
      action: 'update_node', id: 'image-node', data: expect.objectContaining({ status: ChunkStatus.SUCCESS, url: 'https://cdn/image.png' }),
    }]);
    expect(await service.execute(rc, 'generate', 'approval-cuid', outcome)).toBe(execution);
    expect(generation.create).toHaveBeenCalledTimes(1);
  });

  it('creates grouped shot nodes with resolved parent IDs and group dimensions', async () => {
    const { service, canvas } = setup();
    await service.tool(rc, 'canvas_apply_ops', {
      tool_call_id: 'create-shot-group',
      args: { ops: [
        { op: 'create_node', tempId: 'group', kind: 'group', label: '镜头 01｜追逐', position: { x: 800, y: 100 }, width: 1240, height: 560 },
        { op: 'create_node', tempId: 'image', kind: 'image', parentId: 'group', label: '分镜图', prompt: '[倒霉熊]追野餐布', position: { x: 440, y: 72 } },
      ] },
    });
    const operations = (canvas.applyOps.mock.calls as any[])[0][2];
    expect(operations[0].node).toMatchObject({ type: 'group', width: 1240, height: 560 });
    expect(operations[1].node).toMatchObject({
      type: 'imageNode', parentId: operations[0].node.id, position: { x: 440, y: 72 },
    });
  });

  it('passes every connected character and scene image to agent generation', async () => {
    const { service, generation, canvas, node } = setup();
    const character = {
      id: 'character-image', type: 'imageNode', position: { x: 0, y: 0 },
      data: { title: '倒霉熊 · 角色三视图', url: '/character.png' },
    };
    const scene = {
      id: 'scene-image', type: 'imageNode', position: { x: 0, y: 0 },
      data: { title: '夏日公园 · 场景参考图', url: 'https://cdn/scene.png' },
    };
    canvas.getState.mockResolvedValue({
      revision: 3,
      nodes: [node, character, scene],
      edges: [
        { id: 'character-edge', source: character.id, target: node.id },
        { id: 'scene-edge', source: scene.id, target: node.id },
      ],
    } as any);
    const proposal = await service.propose(rc, 'generate', { items: [{ node_id: node.id }] });
    const outcome = service.resolve('generate', proposal.payload, { decision: 'approve' });

    await service.execute(rc, 'generate', 'approval-with-references', outcome);

    expect(generation.create).toHaveBeenCalledWith(expect.objectContaining({
      referenceUrl: '/character.png',
      config: expect.objectContaining({ referenceUrls: ['/character.png', 'https://cdn/scene.png'] }),
      prompt: expect.stringContaining('图片1＝倒霉熊 · 角色三视图\n图片2＝夏日公园 · 场景参考图'),
    }));
  });

  it('infers and connects storyboard character references when the model omitted edges', async () => {
    const { service, generation, canvas, node } = setup();
    node.data.title = '分镜-场景2 野餐布被风吹跑';
    node.data.text = '倒霉熊追野餐布，小企鹅在旁边笑';
    const character = {
      id: 'character-image', type: 'imageNode', position: { x: 0, y: 0 },
      data: { title: '倒霉熊三视图（夏季服装版）', url: '/character.png' },
    };
    canvas.getState.mockResolvedValue({
      revision: 3, nodes: [node, character], edges: [],
    } as any);
    const proposal = await service.propose(rc, 'generate', { items: [{ node_id: node.id }] });
    const outcome = service.resolve('generate', proposal.payload, { decision: 'approve' });

    await service.execute(rc, 'generate', 'approval-inferred-reference', outcome);

    expect(canvas.applyOps).toHaveBeenCalledWith('canvas-uuid', 'run-cuid', [{
      action: 'connect', source: character.id, target: node.id,
    }]);
    expect(generation.create).toHaveBeenCalledWith(expect.objectContaining({
      referenceUrl: '/character.png',
      config: expect.objectContaining({ referenceUrls: ['/character.png'] }),
      prompt: expect.stringContaining('图片1＝倒霉熊三视图（夏季服装版）'),
    }));
  });

  it('keeps storyboard reference labels aligned when multiple nodes share an image URL', async () => {
    const { service, generation, canvas, node } = setup();
    node.data.title = '镜头 01 · 分镜图';
    node.data.text = '[倒霉熊]和[小企鹅]在公园里争抢野餐布';
    const bear = {
      id: 'bear', type: 'imageNode', position: { x: 0, y: 0 },
      data: { title: '倒霉熊 · 角色三视图', url: '/shared.png' },
    };
    const duplicate = { ...bear, id: 'bear-duplicate', data: { ...bear.data, title: '重复角色图' } };
    const penguin = {
      id: 'penguin', type: 'imageNode', position: { x: 0, y: 0 },
      data: { title: '小企鹅 · 角色三视图', url: '/penguin.png' },
    };
    canvas.getState.mockResolvedValue({
      revision: 3, nodes: [node, bear, duplicate, penguin],
      edges: [bear, duplicate, penguin].map((reference) => ({
        id: `${reference.id}-edge`, source: reference.id, target: node.id,
      })),
    } as any);
    const proposal = await service.propose(rc, 'generate', { items: [{ node_id: node.id }] });
    const outcome = service.resolve('generate', proposal.payload, { decision: 'approve' });

    await service.execute(rc, 'generate', 'approval-deduplicated-references', outcome);

    expect(generation.create).toHaveBeenCalledWith(expect.objectContaining({
      referenceUrl: '/shared.png',
      config: expect.objectContaining({ referenceUrls: ['/shared.png', '/penguin.png'] }),
      prompt: expect.stringContaining('图片1＝倒霉熊 · 角色三视图\n图片2＝小企鹅 · 角色三视图'),
    }));
    expect(generation.create.mock.calls[0][0].prompt).not.toContain('图片3＝');
    expect(generation.create.mock.calls[0][0].prompt).toContain('禁止复制三视图排版');
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

  it('includes task states in task_get events so watches can settle immediately', async () => {
    const { service } = setup();
    const result = await service.tool(rc, 'task_get', {
      tool_call_id: 'query-task', args: { task_ids: ['job-cuid'] },
    }) as any;

    expect(result.tool_end.task_states).toEqual([
      expect.objectContaining({ task_id: 'job-cuid', status: 'succeeded' }),
    ]);
  });
});
