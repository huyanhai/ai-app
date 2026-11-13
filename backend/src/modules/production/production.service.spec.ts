import { ProductionService } from './production.service';
import { ChunkStatus } from '@/common/utils/ai-stream-utils';
import { genVideo, queryVideoTask } from '@/common/llm/tools/gen-video';
import { genImage } from '@/common/llm/tools/gen-image';
import { genSceneReferenceImage } from '@/common/llm/tools/gen-scene-reference';
import { buildProductionGraph } from './production.graph';

jest.mock('@/common/llm/tools/gen-image', () => ({ genImage: jest.fn() }));
jest.mock('@/common/llm/tools/gen-scene-reference', () => ({ genSceneReferenceImage: jest.fn() }));

jest.mock('@/common/llm/tools/gen-video', () => ({
  genVideo: jest.fn(),
  queryVideoTask: jest.fn(),
}));

const makeService = (project: any, planner: any = {}) => {
  const prisma = {
    productionProject: {
      findUnique: jest.fn().mockResolvedValue(project),
      findFirst: jest.fn().mockResolvedValue(project),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...(project ?? {
            plan: '{}',
            nodes: '[]',
            edges: '[]',
            events: '[]',
          }),
          ...data,
        }),
      ),
    },
    canvasState: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new ProductionService(
    prisma as any,
    planner,
    {} as any,
    {} as any,
  );
  jest.spyOn(service as any, 'schedule').mockImplementation(() => undefined);
  return { service, prisma };
};

describe('ProductionService confirmation', () => {
  it('invalidates media when a revised shot reuses an id with a new prompt', () => {
    const { service } = makeService(null);
    const merged = (service as any).mergeLayout({
      nodes: [{ id: 'image-shot-1', type: 'imageNode', position: { x: 0, y: 0 }, data: { title: '新完整镜头', production: { prompt: '新提示词' } } }],
      edges: [],
    }, [{ id: 'image-shot-1', type: 'imageNode', position: { x: 10, y: 20 }, data: { title: '旧镜头', url: 'old.png', status: ChunkStatus.SUCCESS, production: { prompt: '旧提示词' } } }]);
    expect(merged.nodes[0].data).toEqual(expect.objectContaining({ title: '新完整镜头', url: '', error: null }));
    expect(merged.nodes[0].data.status).toBeUndefined();
    expect(merged.nodes[0].data.production.stale).toBe(true);
  });

  it('recovers target duration from an existing project idea', () => {
    const { service } = makeService(null);
    expect((service as any).withTargetDuration({ title: '采莲曲' }, '创作约30秒短片')).toEqual({ title: '采莲曲', targetDuration: 30 });
    expect((service as any).withTargetDuration({ title: '小猫' }, '创作1 分钟短片')).toEqual({ title: '小猫', targetDuration: 60 });
  });

  it('keeps scene references free of character images and descriptions', async () => {
    const nodes = [
      { id: 'image-scene-1', type: 'imageNode', data: { title: '荷塘 · 场景参考图', draftText: '无人荷塘', production: { kind: 'sceneReference' }, config: {} } },
      { id: 'text-scene-1', type: 'textNode', data: { text: '阿芸抱着猫跃入水中' } },
      { id: 'subject-character-1', type: 'subjectNode', data: { name: '阿芸', description: '双丸子头' } },
      { id: 'image-character-1', type: 'imageNode', data: { title: '阿芸 · 角色三视图', url: 'character.png', status: ChunkStatus.SUCCESS, production: { kind: 'characterReference' } } },
    ];
    const project = { id: 'project-1', plan: JSON.stringify({ visualStyle: '真人', ratio: '9:16' }), nodes: JSON.stringify(nodes), edges: JSON.stringify([
      { source: 'text-scene-1', target: 'image-scene-1' },
      { source: 'subject-character-1', target: 'image-scene-1' },
      { source: 'image-character-1', target: 'image-scene-1' },
    ]), events: '[]' };
    const { service } = makeService(project);
    (service as any).models = { runtime: jest.fn().mockResolvedValue({}), visionRuntime: jest.fn().mockResolvedValue({}) };
    (genSceneReferenceImage as jest.Mock).mockClear();
    (genSceneReferenceImage as jest.Mock).mockResolvedValue({ content: [{ image: 'scene.png' }] });

    await (service as any).generateImage('project-1', 'image-scene-1');

    const input = (genSceneReferenceImage as jest.Mock).mock.calls[0][0];
    expect(input.message).toHaveLength(1);
    expect(input.message[0].text).not.toContain('双丸子头');
    expect(input.message[0].text).not.toContain('阿芸抱着猫');
    expect(input.message[0].text).not.toContain('保持所有参考角色外貌');
    expect(input.message[0].text).toContain('干净空景资产');
    expect(input.config.edit).toBe(false);
    expect(input.config.resolution).toBe('2K');
  });

  it('labels storyboard references so identities cannot be swapped', async () => {
    const nodes = [
      { id: 'image-shot-1', type: 'imageNode', data: { title: '分镜图', draftText: '阿芸采莲', production: { kind: 'storyboard' }, config: {} } },
      { id: 'image-scene-1', type: 'imageNode', data: { title: '荷塘 · 场景参考图', url: 'scene.png', draftText: '无人空景，固定全景机位', production: { kind: 'sceneReference' } } },
      { id: 'text-scene-1', type: 'textNode', data: { text: '阿芸抱着猫跃入水中', production: { kind: 'scene' } } },
      { id: 'image-character-1', type: 'imageNode', data: { title: '阿芸 · 角色三视图', url: 'character.png', production: { kind: 'characterReference' } } },
      ...Array.from({ length: 7 }, (_, index) => ({ id: `image-prop-${index + 1}`, type: 'imageNode', data: { title: `道具${index + 1}`, url: `prop-${index + 1}.png`, production: { kind: 'propReference' } } })),
    ];
    const project = { id: 'project-1', plan: JSON.stringify({ visualStyle: '真人', ratio: '9:16' }), nodes: JSON.stringify(nodes), edges: JSON.stringify([
      ...nodes.slice(1).filter((node) => node.id !== 'text-scene-1').map((node) => ({ source: node.id, target: 'image-shot-1' })),
      { source: 'text-scene-1', target: 'image-shot-1', data: { kind: 'sceneMembership' } },
    ]), events: '[]' };
    const { service } = makeService(project);
    (service as any).models = { runtime: jest.fn().mockResolvedValue({}) };
    (genImage as jest.Mock).mockClear();
    (genImage as jest.Mock).mockResolvedValue({ content: [{ image: 'shot.png' }] });

    await (service as any).generateImage('project-1', 'image-shot-1');

    const input = (genImage as jest.Mock).mock.calls[0][0];
    expect(input.message[0].text).toContain('图片1＝荷塘 · 场景参考图');
    expect(input.message[0].text).toContain('图片2＝阿芸 · 角色三视图');
    expect(input.message[0].text).toContain('图片3＝道具1');
    expect(input.message[0].text).not.toContain('无人空景，固定全景机位');
    expect(input.message[0].text).not.toContain('阿芸抱着猫跃入水中');
    expect(input.message[0].text).toContain('不继承其无人空景状态、机位、构图或生成提示词');
    expect(input.message).toHaveLength(9);
  });

  it('keeps prop references free of character images and descriptions', async () => {
    const nodes = [
      { id: 'image-prop-1', type: 'imageNode', data: { title: '红色按钮 · 道具三视图', draftText: '独立红色按钮', production: { kind: 'propReference', propId: 'prop-1' }, config: {} } },
      { id: 'subject-prop-1', type: 'subjectNode', data: { name: '红色按钮', description: '圆顶与金属底座', production: { propId: 'prop-1' } } },
      { id: 'subject-character-1', type: 'subjectNode', data: { name: '河狸', description: '圆滚河狸' } },
      { id: 'image-character-1', type: 'imageNode', data: { title: '河狸 · 角色三视图', url: 'character.png', production: { kind: 'characterReference' } } },
    ];
    const project = { id: 'project-1', plan: JSON.stringify({ visualStyle: '卡通', ratio: '16:9' }), nodes: JSON.stringify(nodes), edges: JSON.stringify(nodes.slice(1).map((node) => ({ source: node.id, target: 'image-prop-1' }))), events: '[]' };
    const { service } = makeService(project);
    (service as any).models = { runtime: jest.fn().mockResolvedValue({}) };
    (genImage as jest.Mock).mockClear();
    (genImage as jest.Mock).mockResolvedValue({ content: [{ image: 'prop.png' }] });

    await (service as any).generateImage('project-1', 'image-prop-1');

    const input = (genImage as jest.Mock).mock.calls[0][0];
    expect(input.message).toHaveLength(1);
    expect(input.message[0].text).toContain('圆顶与金属底座');
    expect(input.message[0].text).not.toContain('圆滚河狸');
    expect(input.message[0].text).toContain('独立道具资产');
    expect(input.config.edit).toBe(false);
  });

  it('syncs generated nodes only to the project canvas', async () => {
    const project = {
      id: 'project-1',
      canvasId: 'canvas-1',
      status: 'media_ready',
      plan: '{}',
      edges: '[]',
      nodes: '[]',
    };
    const { service, prisma } = makeService(project);

    await service.confirm('project-1', { nodes: [], edges: [] });

    expect(prisma.canvasState.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'canvas-1' },
      create: expect.objectContaining({ id: 'canvas-1' }),
    }));
  });

  it('starts confirmed media without generating during the confirmation request', async () => {
    const project = {
      id: 'project-1',
      status: 'media_ready',
      plan: '{}',
      edges: '[]',
      nodes: JSON.stringify([
        {
          id: 'image-1',
          type: 'imageNode',
          data: { production: { kind: 'storyboard' } },
        },
      ]),
    };
    const { service, prisma } = makeService(project);
    const result = await service.confirm('project-1', {
      nodes: JSON.parse(project.nodes),
      edges: [],
    });
    expect(result.status).toBe('media_running');
    expect(prisma.productionProject.update).toHaveBeenCalledTimes(1);
    expect((service as any).models.runtime).toBeUndefined();
  });

  it('keeps existing canvas media and unrelated nodes when syncing a project', async () => {
    const existingImage = {
      id: 'image-1',
      type: 'imageNode',
      position: { x: 100, y: 200 },
      data: { url: '/generated.png', status: ChunkStatus.SUCCESS, production: { kind: 'storyboard' } },
    };
    const customNode = {
      id: 'custom-1',
      type: 'textNode',
      position: { x: 0, y: 0 },
      data: { text: '用户内容' },
    };
    const project = {
      id: 'project-1',
      canvasId: 'canvas-1',
      status: 'media_ready',
      plan: '{}',
      edges: '[]',
      nodes: '[]',
    };
    const { service, prisma } = makeService(project);
    prisma.canvasState.findUnique.mockResolvedValue({
      id: 'canvas-1',
      nodes: JSON.stringify([existingImage, customNode]),
      edges: '[]',
    });

    await service.confirm('project-1', {
      nodes: [{ ...existingImage, position: { x: 0, y: 0 }, data: { ...existingImage.data, url: '' } }],
      edges: [],
    });

    const values = prisma.canvasState.upsert.mock.calls[0][0].update;
    const nodes = JSON.parse(values.nodes);
    expect(nodes.find((node) => node.id === 'image-1').data.url).toBe('/generated.png');
    expect(nodes.find((node) => node.id === 'image-1').position).toEqual(existingImage.position);
    expect(nodes.find((node) => node.id === 'custom-1').data.text).toBe('用户内容');
  });

  it('marks only changed successful nodes stale and keeps their previous result', async () => {
    const nodes = [
      {
        id: 'image-1',
        type: 'imageNode',
        data: {
          url: '/previous.png',
          status: ChunkStatus.SUCCESS,
          draftText: '新提示词',
          production: {
            kind: 'storyboard',
            sourceHash: 'old-hash',
            taskId: 'old-task',
          },
        },
      },
    ];
    const project = {
      id: 'project-1',
      status: 'media_completed',
      plan: '{}',
      edges: '[]',
      nodes: JSON.stringify(nodes),
    };
    const { service } = makeService(project);
    const result = await service.confirm('project-1', { nodes, edges: [] });
    expect(result.nodes[0].data.url).toBe('/previous.png');
    expect(result.nodes[0].data.status).toBeUndefined();
    expect(result.nodes[0].data.production.stale).toBe(true);
    expect(result.nodes[0].data.production.taskId).toBeUndefined();
  });
});

describe('ProductionService canvas restoration', () => {
  it('loads the latest project for the requested canvas', async () => {
    const project = {
      id: 'project-1',
      canvasId: 'canvas-1',
      status: 'requirements_review',
      plan: '{}',
      nodes: '[]',
      edges: '[]',
      events: '[]',
    };
    const { service, prisma } = makeService(project);

    await expect(service.latest('canvas-1')).resolves.toMatchObject({
      id: 'project-1',
      canvasId: 'canvas-1',
    });
    expect(prisma.productionProject.findFirst).toHaveBeenCalledWith({
      where: { canvasId: 'canvas-1' },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('claims a legacy project only when its production nodes match', async () => {
    const project = {
      id: 'project-1',
      canvasId: 'default',
      status: 'requirements_review',
      plan: '{}',
      nodes: JSON.stringify([
        { id: 'story-1', type: 'textNode', data: { production: { kind: 'story' } } },
      ]),
      edges: '[]',
      events: '[]',
    };
    const { service, prisma } = makeService(project);

    await expect(service.claimLegacy('project-1', 'canvas-1', ['other-node'])).resolves.toBeNull();
    expect(prisma.productionProject.update).not.toHaveBeenCalled();
    await service.claimLegacy('project-1', 'canvas-1', ['story-1']);
    expect(prisma.productionProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { canvasId: 'canvas-1' },
    });
  });

  it('restores a legacy project by its stored id before graph nodes exist', async () => {
    const project = {
      id: 'project-1',
      canvasId: 'default',
      status: 'script_pending',
      plan: '{}',
      nodes: '[]',
      edges: '[]',
      events: '[]',
    };
    const { service, prisma } = makeService(project);

    await service.claimLegacy('project-1', 'canvas-1', []);
    expect(prisma.productionProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { canvasId: 'canvas-1' },
    });
  });
});

describe('ProductionService staged planning', () => {
  const script = {
    title: '短片',
    synopsis: '梗概',
    story: '完整故事',
    visualStyle: '写实',
    ratio: '16:9',
    scenes: [
      {
        id: 'scene-1',
        title: '天台',
        script: '小林来到天台。',
        location: '天台',
      },
    ],
  };

  it('asks for missing requirements without generating a script', async () => {
    const planner = {
      requirements: jest.fn().mockResolvedValue({
        status: 'questions',
        brief: '一个故事',
        questions: ['主角是谁？', '结局是什么？'],
      }),
      script: jest.fn().mockResolvedValue(script),
    };
    const { service } = makeService(null, planner);
    const result = await service.create({ idea: '一个故事' });
    expect(result.status).toBe('requirements_clarifying');
    expect(result.requirements.questions).toHaveLength(2);
    expect(result.nodes).toEqual([]);
    expect(result.history[0].data.brief).toBe('一个故事');
    expect(planner.script).not.toHaveBeenCalled();
    expect(result.events).toHaveLength(2);
  });

  it('streams requirement analysis and waits for requirement confirmation', async () => {
    const requirements = {
      status: 'ready',
      brief: '小林在天台与过去告别',
      questions: [],
    };
    const planner = {
      requirements: jest.fn().mockImplementation((_idea, _modelId, onChunk) => {
        onChunk({ brief: requirements.brief });
        return Promise.resolve(requirements);
      }),
      script: jest.fn(),
    };
    const { service } = makeService(null, planner);
    const emit = jest.fn();

    const result = await service.create({ idea: '一个故事' }, emit);

    expect(emit.mock.calls.map(([event]) => event.type)).toEqual([
      'start',
      'chunk',
      'result',
    ]);
    expect(result.status).toBe('requirements_review');
    expect(planner.script).not.toHaveBeenCalled();
  });

  it('keeps the selected video style in every downstream brief', async () => {
    const planner = {
      requirements: jest.fn().mockResolvedValue({
        status: 'ready',
        brief: '一个故事',
        questions: [],
      }),
    };
    const { service } = makeService(null, planner);
    const result = await service.create({
      idea: '一个故事',
      style: '赛博朋克：蓝紫霓虹，雨夜反射',
    });
    expect(planner.requirements.mock.calls[0][0]).toContain('赛博朋克');
    expect(result.requirements.brief).toContain(
      '全片视频风格（用户指定，必须统一继承）：赛博朋克：蓝紫霓虹，雨夜反射',
    );
  });

  it('passes production attachments to requirement analysis with a vision model', async () => {
    const planner = {
      requirements: jest.fn().mockResolvedValue({ status: 'ready', brief: '图片风格需求', questions: [] }),
    };
    const { service } = makeService(null, planner);
    (service as any).models = { visionRuntime: jest.fn().mockResolvedValue({ id: 'vision-model' }) };
    const files = [{ name: 'style.png', type: 'image/png', content: 'aW1hZ2U=' }];

    await service.create({ idea: '参考图片风格', files });

    expect((service as any).models.visionRuntime).toHaveBeenCalledTimes(1);
    expect(planner.requirements).toHaveBeenCalledWith(
      '参考图片风格',
      'vision-model',
      expect.any(Function),
      files,
    );
  });

  it('develops and reviews a complete story before writing the script', async () => {
    const story = {
      title: '短片', synopsis: '梗概', story: '有起因、行动和结果的完整故事',
      sourceBasis: ['原始创意'], creativeAdditions: ['人物选择'],
      storyArc: { goal: '达成目标', obstacle: '遇到阻碍', action: '主动应对', result: '出现结果', change: '关系改变' },
      visualStyle: '写实', ratio: '16:9',
    };
    const planner = {
      story: jest.fn().mockResolvedValue(story),
      reviewStory: jest.fn().mockResolvedValue({ issues: [] }),
      script: jest.fn(),
      characters: jest.fn(),
    };
    const project = {
      id: 'project-1',
      idea: '原始创意',
      status: 'requirements_review',
      requirements: JSON.stringify({
        status: 'ready',
        brief: '确认后的需求',
        questions: [],
      }),
      plan: '{}',
      events: '[]',
      edges: '[]',
      nodes: '[]',
    };
    const { service, prisma } = makeService(project, planner);
    const result = await service.confirmStage('project-1', {
      nodes: [],
      edges: [],
    });
    expect(result.status).toBe('story_review');
    expect(planner.story).toHaveBeenCalledWith(
      expect.stringContaining('确认后的需求'),
      undefined,
      expect.any(Function),
    );
    expect(planner.reviewStory).toHaveBeenCalledTimes(1);
    expect(result.plan.story).toBe(story.story);
    expect(prisma.productionProject.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nodes: expect.stringContaining(story.story),
      }),
    }));
    expect(planner.script).not.toHaveBeenCalled();
    expect(planner.characters).not.toHaveBeenCalled();
  });

  it('preserves a generated story when review times out and retries only review', async () => {
    const story = {
      title: '采莲', synopsis: '梗概', story: '完整故事',
      sourceBasis: ['诗句'], creativeAdditions: [],
      storyArc: { goal: '目标', obstacle: '阻碍', action: '行动', result: '结果', change: '变化' },
      visualStyle: '真人', ratio: '9:16',
    };
    const planner = {
      story: jest.fn().mockResolvedValue(story),
      reviewStory: jest.fn().mockRejectedValueOnce(new Error('Request timed out.'))
        .mockResolvedValueOnce({ issues: [] }),
      script: jest.fn(),
    };
    const project = {
      id: 'project-1', idea: '采莲曲', status: 'requirements_review',
      requirements: JSON.stringify({ status: 'ready', brief: '采莲故事', questions: [] }),
      plan: '{}', events: '[]', edges: '[]', nodes: '[]',
    };
    const { service, prisma } = makeService(project, planner);
    const failed = await service.confirmStage('project-1', { nodes: [], edges: [] });
    expect(failed.status).toBe('story_review');
    expect(failed.plan.story).toBe(story.story);
    expect(failed.plan.storyReview).toBeUndefined();
    expect(failed.error).toContain('故事已保存');

    const storySave = prisma.productionProject.update.mock.calls
      .map(([arg]) => arg.data)
      .find((data) => data.nodes && data.status === 'story_review');
    const saved = {
      ...project,
      ...storySave,
      plan: JSON.stringify(failed.plan),
      events: JSON.stringify(failed.events),
      error: failed.error,
    };
    prisma.productionProject.findUnique.mockResolvedValue(saved);
    const reviewed = await service.confirmStage('project-1', {
      nodes: JSON.parse(saved.nodes), edges: [],
    });
    expect(reviewed.plan.storyReview).toEqual({ issues: [] });
    expect(planner.story).toHaveBeenCalledTimes(1);
    expect(planner.reviewStory).toHaveBeenCalledTimes(2);
    expect(planner.script).not.toHaveBeenCalled();
  });

  it('keeps the saved story stage when canvas sync fails', async () => {
    const story = {
      title: '采莲', synopsis: '梗概', story: '完整故事',
      sourceBasis: ['诗句'], creativeAdditions: [],
      storyArc: { goal: '目标', obstacle: '阻碍', action: '行动', result: '结果', change: '变化' },
      visualStyle: '真人', ratio: '9:16',
    };
    const planner = {
      story: jest.fn().mockResolvedValue(story),
      reviewStory: jest.fn().mockResolvedValue({ issues: [] }),
    };
    const project = {
      id: 'project-1', canvasId: 'canvas-1', idea: '采莲曲', status: 'requirements_review',
      requirements: JSON.stringify({ status: 'ready', brief: '采莲故事', questions: [] }),
      plan: '{}', events: '[]', edges: '[]', nodes: '[]',
    };
    const { service, prisma } = makeService(project, planner);
    prisma.canvasState.upsert.mockRejectedValue(new Error('canvas sync failed'));

    await expect(service.confirmStage('project-1', { nodes: [], edges: [] }))
      .rejects.toThrow('canvas sync failed');

    const updates = prisma.productionProject.update.mock.calls.map(([arg]) => arg.data);
    expect(updates[1]).toEqual(expect.objectContaining({
      status: 'story_review', plan: expect.stringContaining(story.story),
    }));
    expect(updates[2]).not.toHaveProperty('status');
    expect(planner.reviewStory).not.toHaveBeenCalled();
  });

  it('blocks an inconsistent story and passes an approved story into script writing', async () => {
    const story = {
      title: '短片', synopsis: '梗概', story: '完整故事',
      sourceBasis: ['原始创意'], creativeAdditions: [],
      storyArc: { goal: '目标', obstacle: '阻碍', action: '行动', result: '结果', change: '变化' },
      visualStyle: '写实', ratio: '16:9',
    };
    const blocking = { severity: 'blocking', category: 'continuity', evidence: '人物从船外消失', problem: '人物位置跳变', suggestion: '交代返回过程' };
    const planner = { script: jest.fn().mockResolvedValue(script) };
    const project = {
      id: 'project-1', idea: '原始创意', status: 'story_review',
      requirements: JSON.stringify({ status: 'ready', brief: '确认后的需求', questions: [] }),
      plan: JSON.stringify({ ...story, storyReview: { issues: [blocking] } }),
      events: '[]', edges: '[]', nodes: JSON.stringify([{ id: 'production-story', type: 'textNode', position: { x: 0, y: 0 }, data: { text: story.story, production: { kind: 'story' } } }]),
    };
    const { service } = makeService(project, planner);
    await expect(service.confirmStage('project-1', { nodes: JSON.parse(project.nodes), edges: [] })).rejects.toThrow('故事审查仍有必须修复的问题');
    expect(planner.script).not.toHaveBeenCalled();

    project.plan = JSON.stringify({ ...story, storyReview: { issues: [] } });
    const result = await service.confirmStage('project-1', { nodes: JSON.parse(project.nodes), edges: [] });
    expect(result.status).toBe('script_review');
    expect(planner.script.mock.calls[0][0]).toContain('approvedStory');
    expect(result.plan.story).toBe(story.story);
  });

  it('requires re-review when the story text is edited on the canvas', async () => {
    const story = {
      title: '短片', synopsis: '梗概', story: '已审查的故事',
      sourceBasis: ['诗句'], creativeAdditions: [],
      storyArc: { goal: '目标', obstacle: '阻碍', action: '行动', result: '结果', change: '变化' },
      visualStyle: '写实', ratio: '9:16', storyReview: { issues: [] },
    };
    const planner = { script: jest.fn() };
    const project = {
      id: 'project-1', idea: '诗句', status: 'story_review',
      plan: JSON.stringify(story), events: '[]', edges: '[]', nodes: '[]',
    };
    const { service } = makeService(project, planner);
    await expect(service.confirmStage('project-1', {
      nodes: [{ id: 'production-story', type: 'textNode', position: { x: 0, y: 0 }, data: { text: '画布改写的故事', production: { kind: 'story' } } }],
      edges: [],
    })).rejects.toThrow('画布故事已修改');
    expect(planner.script).not.toHaveBeenCalled();
  });

  it('rechecks revised stories and replaces the previous review', async () => {
    const story = {
      title: '短片', synopsis: '梗概', story: '修订后的故事',
      sourceBasis: ['诗句'], creativeAdditions: [],
      storyArc: { goal: '目标', obstacle: '阻碍', action: '行动', result: '结果', change: '变化' },
      visualStyle: '写实', ratio: '9:16',
    };
    const planner = {
      story: jest.fn().mockResolvedValue(story),
      reviewStory: jest.fn().mockResolvedValue({ issues: [] }),
    };
    const project = {
      id: 'project-1', idea: '诗句', status: 'story_review',
      plan: JSON.stringify({ ...story, story: '旧故事', storyReview: { issues: [{ severity: 'blocking' }] } }),
      events: '[]', edges: '[]', nodes: '[]',
    };
    const { service } = makeService(project, planner);
    const result = await service.reviseStage('project-1', {
      stage: 'story', feedback: '修复人物位置', nodes: [], edges: [],
    });
    expect(result.status).toBe('story_review');
    expect(result.plan.storyReview).toEqual({ issues: [] });
    expect(planner.story.mock.calls[0][0]).toContain('修复人物位置');
    expect(planner.reviewStory).toHaveBeenCalledTimes(1);
  });

  it('resumes an interrupted script without requiring another confirmation', async () => {
    const planner = { script: jest.fn().mockResolvedValue(script) };
    const project = {
      id: 'project-1',
      idea: '原始创意',
      status: 'script_pending',
      requirements: JSON.stringify({
        status: 'ready',
        brief: '已确认需求',
        questions: [],
      }),
      plan: '{}',
      events: '[]',
      edges: '[]',
      nodes: '[]',
    };
    const { service } = makeService(project, planner);
    const result = await service.confirmStage('project-1', {
      nodes: [],
      edges: [],
    });
    expect(result.status).toBe('script_review');
    expect(planner.script).toHaveBeenCalledTimes(1);
    expect(
      result.events.some((event) => event.message === '用户已确认当前阶段'),
    ).toBe(false);
  });

  it('lets the agent complete delegated requirements without generating a script', async () => {
    const planner = {
      requirements: jest.fn().mockResolvedValue({
        status: 'ready',
        brief: 'Agent 补充后的完整需求',
        questions: [],
      }),
      script: jest.fn(),
    };
    const project = {
      id: 'project-1',
      idea: '温馨、冒险、皮克斯风格',
      status: 'requirements_clarifying',
      requirements: JSON.stringify({
        status: 'questions',
        brief: '温馨冒险动画',
        questions: ['主角是谁？'],
      }),
      plan: '{}',
      events: '[]',
      edges: '[]',
      nodes: '[]',
    };
    const { service } = makeService(project, planner);
    const result = await service.reviseStage('project-1', {
      stage: 'requirements',
      feedback: '我授权你根据已知需求自动补充所有缺失设定，不再提问',
      files: [{ name: 'script.txt', type: 'text/plain', content: '5Ymn5pys' }],
      nodes: [],
      edges: [],
    });
    expect(result.status).toBe('requirements_review');
    expect(result.requirements.brief).toBe('Agent 补充后的完整需求');
    expect(result.history).toHaveLength(1);
    expect(result.history[0].feedback).toBe('让 Agent 帮我补充');
    expect(planner.requirements.mock.calls[0][0]).toContain(
      '我授权你根据已知需求自动补充',
    );
    expect(planner.requirements.mock.calls[0][3]).toEqual([
      { name: 'script.txt', type: 'text/plain', content: '5Ymn5pys' },
    ]);
    expect(
      result.events.some(
        (event) => event.message === '用户修改意见：让 Agent 帮我补充',
      ),
    ).toBe(true);
    expect(planner.script).not.toHaveBeenCalled();
  });

  it('generates characters only after script confirmation', async () => {
    const planner = {
      characters: jest.fn().mockResolvedValue({
        characters: [{
          id: 'character-1', name: '小林', description: '青年', referencePrompt: '角色图',
        }],
        props: [],
      }),
      storyboard: jest.fn(),
    };
    const plan = { ...script, characters: [] };
    const project = {
      id: 'project-1',
      status: 'script_review',
      plan: JSON.stringify(plan),
      events: '[]',
      edges: '[]',
      nodes: JSON.stringify([
        {
          id: 'text-scene-1',
          type: 'textNode',
          position: { x: 0, y: 0 },
          data: { text: script.scenes[0].script },
        },
      ]),
    };
    const { service } = makeService(project, planner);
    const result = await service.confirmStage('project-1', {
      nodes: JSON.parse(project.nodes),
      edges: [],
    });
    expect(result.status).toBe('characters_review');
    expect(planner.characters).toHaveBeenCalledTimes(1);
    expect(planner.storyboard).not.toHaveBeenCalled();
    expect(
      result.nodes.some((node) =>
        ['imageNode', 'videoNode'].includes(node.type),
      ),
    ).toBe(false);
  });

  it('regenerates only the requested stage after user feedback', async () => {
    const planner = {
      script: jest.fn().mockResolvedValue(script),
      characters: jest.fn(),
      storyboard: jest.fn(),
    };
    const plan = { ...script, characters: [] };
    const project = {
      id: 'project-1',
      idea: '原始创意',
      status: 'script_review',
      plan: JSON.stringify(plan),
      events: '[]',
      edges: '[]',
      nodes: JSON.stringify([
        {
          id: 'text-scene-1',
          type: 'textNode',
          position: { x: 0, y: 0 },
          data: { text: script.scenes[0].script },
        },
      ]),
    };
    const { service } = makeService(project, planner);
    const result = await service.reviseStage('project-1', {
      stage: 'script',
      feedback: '增加一个结尾',
      nodes: JSON.parse(project.nodes),
      edges: [],
    });
    expect(result.status).toBe('script_review');
    expect(planner.script).toHaveBeenCalledTimes(1);
    expect(planner.script.mock.calls[0][0]).toContain('增加一个结尾');
    expect(planner.characters).not.toHaveBeenCalled();
    expect(planner.storyboard).not.toHaveBeenCalled();
  });

  const shot = {
    id: 'shot-1',
    title: '到来',
    description: '小林走上天台',
    movement: '缓慢推进',
    duration: 4,
    characterIds: [],
  };
  const storyboardPlan = {
    ...script,
    characters: [],
    scenes: [{ ...script.scenes[0], referencePrompt: '场景图', shots: [shot] }],
  };

  it('generates only image prompts after storyboard confirmation', async () => {
    const existingTable = {
      id: 'production-shot-table',
      type: 'shotTableNode',
      position: { x: 120, y: 80 },
      data: { shots: [{ ...shot, visualPrompt: undefined }] },
    };
    const existingShot = {
      id: 'image-shot-1',
      type: 'imageNode',
      position: { x: 3200, y: 40 },
      data: {
        url: '/existing.png',
        status: ChunkStatus.SUCCESS,
        draftText: '',
        production: { kind: 'storyboard', prompt: undefined },
      },
    };
    const project = {
      id: 'project-1',
      status: 'storyboard_review',
      plan: JSON.stringify(storyboardPlan),
      events: '[]',
      edges: '[]',
      nodes: JSON.stringify([existingTable, existingShot]),
    };
    const planner = {
      imagePrompts: jest.fn().mockResolvedValue({
        ...storyboardPlan,
        scenes: [
          {
            ...storyboardPlan.scenes[0],
            shots: [{ ...shot, visualPrompt: '图片提示词' }],
          },
        ],
      }),
      videoPrompts: jest.fn(),
    };
    const { service } = makeService(project, planner);
    const result = await service.confirmStage('project-1', {
      nodes: [existingTable, existingShot],
      edges: [],
    });
    expect(planner.imagePrompts).toHaveBeenCalledTimes(1);
    expect(planner.videoPrompts).not.toHaveBeenCalled();
    expect(result.status).toBe('image_prompts_review');
    const table = result.nodes.find((node) => node.id === existingTable.id);
    expect(table.data.shots[0].visualPrompt).toBe('图片提示词');
    expect(table.position).toEqual(existingTable.position);
    const shotNode = result.nodes.find((node) => node.id === existingShot.id);
    expect(shotNode.data.draftText).toBe('图片提示词');
    expect(shotNode.data.production.prompt).toBe('图片提示词');
    expect(shotNode.data.url).toBe('/existing.png');
    expect(shotNode.data.status).toBe(ChunkStatus.SUCCESS);
    expect(shotNode.position).toEqual(existingShot.position);
  });

  it('generates only video prompts after image prompt confirmation', async () => {
    const imagePlan = {
      ...storyboardPlan,
      scenes: [
        {
          ...storyboardPlan.scenes[0],
          shots: [{ ...shot, visualPrompt: '图片提示词' }],
        },
      ],
    };
    const project = {
      id: 'project-1',
      status: 'image_prompts_review',
      plan: JSON.stringify(imagePlan),
      events: '[]',
      edges: '[]',
      nodes: '[]',
    };
    const planner = {
      videoPrompts: jest.fn().mockResolvedValue({
        ...imagePlan,
        scenes: [
          {
            ...imagePlan.scenes[0],
            shots: [
              { ...imagePlan.scenes[0].shots[0], motionPrompt: '视频提示词' },
            ],
          },
        ],
      }),
    };
    const { service } = makeService(project, planner);
    const result = await service.confirmStage('project-1', {
      nodes: [],
      edges: [],
    });
    expect(result.status).toBe('video_prompts_review');
    expect(planner.videoPrompts).toHaveBeenCalledTimes(1);
  });

  it('waits for manual reference generation after video prompt confirmation', async () => {
    const completePlan = {
      ...storyboardPlan,
      scenes: [
        {
          ...storyboardPlan.scenes[0],
          shots: [
            { ...shot, visualPrompt: '图片提示词', motionPrompt: '视频提示词' },
          ],
        },
      ],
    };
    const project = {
      id: 'project-1',
      status: 'video_prompts_review',
      plan: JSON.stringify(completePlan),
      events: '[]',
      edges: '[]',
      nodes: '[]',
    };
    const { service } = makeService(project);
    const result = await service.confirmStage('project-1', {
      nodes: [],
      edges: [],
      mediaMode: 'manual',
    });
    expect(result.status).toBe('references_ready');
    expect((service as any).schedule).not.toHaveBeenCalled();
    expect(
      result.nodes.filter((node) => node.type === 'shotTableNode'),
    ).toHaveLength(1);
    expect(
      result.nodes.find((node) => node.id === 'video-shot-1').data.draftText,
    ).toBe('视频提示词');
  });

  it('stops for review after the automatic reference batch', async () => {
    const project = {
      id: 'project-1',
      status: 'references_running',
      plan: '{}',
      events: '[]',
      edges: '[]',
      nodes: JSON.stringify([
        {
          id: 'image-scene-1',
          type: 'imageNode',
          data: { production: { kind: 'sceneReference' } },
        },
      ]),
    };
    const { service, prisma } = makeService(project);
    jest.spyOn(service as any, 'generateImage').mockResolvedValue(undefined);
    await (service as any).run('project-1', ['sceneReference']);
    expect((service as any).generateImage).toHaveBeenCalledWith(
      'project-1',
      'image-scene-1',
    );
    expect(prisma.productionProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: 'references_review' },
    });
  });

  it('generates independent image nodes concurrently', async () => {
    const nodes = ['image-1', 'image-2', 'image-3'].map((id) => ({
      id,
      type: 'imageNode',
      data: { production: { kind: 'storyboard' } },
    }));
    const project = {
      id: 'project-1', status: 'storyboards_running', plan: '{}', events: '[]',
      edges: '[]', nodes: JSON.stringify(nodes),
    };
    const { service } = makeService(project);
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    jest.spyOn(service as any, 'generateImage').mockImplementation(
      async (_id: string, nodeId: string) => {
        started.push(nodeId);
        await gate;
      },
    );

    const running = (service as any).run('project-1', ['storyboard']);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(started).toEqual(['image-1', 'image-2', 'image-3']);
    release();
    await running;
  });

  it('keeps every node update when image generations finish together', async () => {
    const project = {
      id: 'project-1', canvasId: 'canvas-1', plan: '{}', events: '[]', edges: '[]',
      nodes: JSON.stringify(['image-1', 'image-2'].map((id) => ({
        id, type: 'imageNode', data: { production: { kind: 'storyboard' } },
      }))),
    };
    const { service, prisma } = makeService(project);
    let persisted = { ...project };
    prisma.productionProject.findUnique.mockImplementation(() => Promise.resolve(persisted));
    prisma.productionProject.update.mockImplementation(({ data }) => {
      persisted = { ...persisted, ...data };
      return Promise.resolve(persisted);
    });

    await Promise.all([
      (service as any).patchNode('project-1', 'image-1', {
        url: 'one.png', status: ChunkStatus.SUCCESS,
      }),
      (service as any).patchNode('project-1', 'image-2', {
        url: 'two.png', status: ChunkStatus.SUCCESS,
      }),
    ]);

    const nodes = JSON.parse(persisted.nodes);
    expect(nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'image-1', data: expect.objectContaining({ url: 'one.png', status: ChunkStatus.SUCCESS }) }),
      expect.objectContaining({ id: 'image-2', data: expect.objectContaining({ url: 'two.png', status: ChunkStatus.SUCCESS }) }),
    ]));
  });

  it('starts only the media batch selected by the user', async () => {
    const project = {
      id: 'project-1',
      status: 'storyboards_ready',
      plan: '{}',
      events: '[]',
      edges: '[]',
      nodes: '[]',
    };
    const { service } = makeService(project);
    const result = await service.startMediaPhase('project-1', {
      phase: 'storyboards',
    });
    expect(result.status).toBe('storyboards_running');
    expect((service as any).schedule).toHaveBeenCalledWith('project-1', [
      'storyboard',
    ]);
  });

  it('creates continuity edges without starting manual media generation', async () => {
    const completePlan = {
      ...storyboardPlan,
      scenes: [{
        ...storyboardPlan.scenes[0],
        shots: [
          { ...shot, visualPrompt: '图一', motionPrompt: '视频一' },
          { ...shot, id: 'shot-2', title: '下一镜', visualPrompt: '图二', motionPrompt: '视频二', transitionFromPrevious: {
            mode: 'continuous', rationale: '动作连续', bridge: '脚步', previousOutro: '停步',
            currentIntro: '继续走动', cameraPath: '继续推进', consistency: '保持方向与光线',
          } },
        ],
      }],
    };
    const project = {
      id: 'project-1', status: 'video_prompts_review', mediaMode: 'manual',
      plan: JSON.stringify(completePlan), events: '[]', edges: '[]', nodes: '[]',
    };
    const { service } = makeService(project);
    const result = await service.confirmStage('project-1', {
      nodes: [], edges: [], mediaMode: 'manual', continuity: true,
    });
    expect(result.status).toBe('references_ready');
    expect((service as any).schedule).not.toHaveBeenCalled();
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: 'video-shot-1', target: 'video-shot-2', data: { kind: 'continuity' },
    }));
    expect(result.nodes.find((node) => node.id === 'video-shot-2').data.draftText).toBe('视频二');
  });

  it('fills missing transition designs when enabling continuity on an old project', async () => {
    const transitionFromPrevious = {
      mode: 'continuous', rationale: '动作连续', bridge: '视线', previousOutro: '抬头',
      currentIntro: '沿视线进入', cameraPath: '向上摇镜', consistency: '保持光线和方向',
    };
    const completePlan = {
      ...storyboardPlan,
      scenes: [{
        ...storyboardPlan.scenes[0],
        shots: [
          { ...shot, visualPrompt: '图一', motionPrompt: '视频一' },
          { ...shot, id: 'shot-2', visualPrompt: '图二', motionPrompt: '视频二' },
        ],
      }],
    };
    const project = {
      id: 'project-1', status: 'video_prompts_review', mediaMode: 'manual',
      plan: JSON.stringify(completePlan), events: '[]', edges: '[]', nodes: '[]',
    };
    const planner = {
      videoPrompts: jest.fn().mockResolvedValue({
        ...completePlan,
        scenes: [{
          ...completePlan.scenes[0],
          shots: completePlan.scenes[0].shots.map((item, index) => index
            ? { ...item, transitionFromPrevious }
            : item),
        }],
      }),
    };
    const { service } = makeService(project, planner);
    const result = await service.confirmStage('project-1', {
      nodes: [], edges: [], mediaMode: 'manual', continuity: true,
    });
    expect(planner.videoPrompts).toHaveBeenCalledTimes(1);
    expect(result.edges).toContainEqual(expect.objectContaining({
      source: 'video-shot-1', target: 'video-shot-2', data: { kind: 'continuity' },
    }));
  });

  it('retries only the selected node and can remove its continuity dependency', async () => {
    const nodes = [{
      id: 'video-shot-2', type: 'videoNode',
      data: {
        title: '下一镜', url: '', production: {
          kind: 'video', continuity: { previousVideoId: 'video-shot-1', prompt: '续接' },
        },
      },
    }];
    const project = {
      id: 'project-1', status: 'videos_ready', plan: '{}', events: '[]', nodes: JSON.stringify(nodes),
      edges: JSON.stringify([{ id: 'continuity', source: 'video-shot-1', target: 'video-shot-2', data: { kind: 'continuity' } }]),
    };
    const { service, prisma } = makeService(project);
    await service.retry('project-1', 'video-shot-2', { independent: true });
    expect((service as any).schedule).toHaveBeenCalledWith('project-1', ['video'], 'video-shot-2');
    expect(prisma.productionProject.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ edges: '[]' }),
    }));
  });

  it('uses the previous last frame and appends continuity instructions', async () => {
    jest.useFakeTimers();
    const nodes = [
      { id: 'image-shot-2', type: 'imageNode', data: { url: 'storyboard.png', status: ChunkStatus.SUCCESS } },
      { id: 'video-shot-1', type: 'videoNode', data: { url: 'one.mp4', status: ChunkStatus.SUCCESS, production: { lastFrameUrl: 'last.png' } } },
      { id: 'video-shot-2', type: 'videoNode', data: {
        title: '下一镜', draftText: '原始提示词', config: { model: 'Wan3 视频' }, production: {
          kind: 'video', prompt: '原始提示词', continuity: { previousVideoId: 'video-shot-1', prompt: '连续衔接要求' },
        },
      } },
    ];
    const project = {
      id: 'project-1', status: 'videos_running', plan: '{}', events: '[]', nodes: JSON.stringify(nodes),
      edges: JSON.stringify([
        { source: 'image-shot-2', target: 'video-shot-2' },
        { source: 'video-shot-1', target: 'video-shot-2', data: { kind: 'continuity' } },
        { source: 'video-shot-2', target: 'video-shot-3', data: { kind: 'continuity' } },
      ]),
    };
    const { service } = makeService(project);
    (service as any).models = { runtime: jest.fn().mockResolvedValue({}) };
    (service as any).images = { extractLastFrame: jest.fn().mockResolvedValue('two-last.png') };
    (genVideo as jest.Mock).mockResolvedValue({ task_id: 'task-1' });
    (queryVideoTask as jest.Mock).mockResolvedValue({ output: { task_status: 'SUCCEEDED', video_url: 'two.mp4' } });
    const generating = (service as any).generateVideo('project-1', 'video-shot-2');
    await jest.advanceTimersByTimeAsync(15_000);
    await generating;
    expect((service as any).models.runtime).toHaveBeenCalledWith('Wan3 视频', 'video');
    expect(genVideo).toHaveBeenCalledWith(expect.objectContaining({
      message: [{ type: 'text', text: '原始提示词\n\n连续衔接要求' }],
      config: expect.objectContaining({
        firstFrameUrl: 'last.png',
        lastFrameUrl: undefined,
      }),
    }));
    expect((service as any).images.extractLastFrame).toHaveBeenCalledWith('two.mp4');
    jest.useRealTimers();
  });

  it('runs only the requested node in a manual media stage', async () => {
    const nodes = ['image-1', 'image-2'].map((id) => ({
      id, type: 'imageNode', data: { production: { kind: 'storyboard' } },
    }));
    const project = {
      id: 'project-1', status: 'storyboards_running', plan: '{}', events: '[]',
      edges: '[]', nodes: JSON.stringify(nodes),
    };
    const { service } = makeService(project);
    const generate = jest.spyOn(service as any, 'generateImage').mockResolvedValue(undefined);
    await (service as any).run('project-1', ['storyboard'], 'image-2');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith('project-1', 'image-2');
  });

  it('keeps manually started media running while polling', async () => {
    const project = {
      id: 'project-1',
      status: 'references_running',
      mediaMode: 'manual',
      plan: '{}',
      events: '[]',
      edges: '[]',
      nodes: '[]',
    };
    const { service, prisma } = makeService(project);
    const result = await service.get('project-1');
    expect(result.status).toBe('references_running');
    expect(prisma.productionProject.update).not.toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: 'references_ready' },
    });
    expect((service as any).schedule).toHaveBeenCalledWith('project-1', [
      'characterReference',
      'propReference',
      'sceneReference',
    ]);
  });

  it('refreshes persisted graph edges and removes stale production nodes on read', async () => {
    const plan = {
      ...storyboardPlan,
      sceneAssets: [{ id: 'scene-asset-1', title: '天台', location: '天台', referencePrompt: '天台空景' }],
      scenes: [{ ...storyboardPlan.scenes[0], sceneAssetId: 'scene-asset-1' }],
    };
    const graph = buildProductionGraph(plan as any);
    const staleNode = {
      id: 'image-scene-2', type: 'imageNode', position: { x: 0, y: 0 },
      data: { production: { kind: 'sceneReference' } },
    };
    const customNode = {
      id: 'custom-note', type: 'textNode', position: { x: 0, y: 0 }, data: { text: '保留我' },
    };
    const staleEdge = {
      id: 'edge-text-scene-1-image-scene-asset-1',
      source: 'text-scene-1', target: 'image-scene-asset-1',
    };
    const customEdge = {
      id: 'edge-custom-note-image-shot-1', source: 'custom-note', target: 'image-shot-1',
    };
    const project = {
      id: 'project-1', canvasId: 'canvas-1', status: 'storyboards_review', plan: JSON.stringify(plan), events: '[]',
      nodes: JSON.stringify([...graph.nodes, staleNode]),
      edges: JSON.stringify([staleEdge]),
    };
    const { service, prisma } = makeService(project);
    prisma.canvasState.findUnique.mockResolvedValue({
      nodes: JSON.stringify([...graph.nodes, staleNode, customNode]),
      edges: JSON.stringify([staleEdge, customEdge]),
    });

    const result = await service.get('project-1');

    expect(result.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'image-scene-asset-1', target: 'image-shot-1' }),
    ]));
    expect(result.edges.some((edge) => edge.id === staleEdge.id)).toBe(false);
    expect(result.nodes.some((node) => node.id === staleNode.id)).toBe(false);
    const canvas = JSON.parse(prisma.canvasState.upsert.mock.calls[0][0].update.edges);
    const canvasNodes = JSON.parse(prisma.canvasState.upsert.mock.calls[0][0].update.nodes);
    expect(canvas.some((edge: any) => edge.id === staleEdge.id)).toBe(false);
    expect(canvas).toContainEqual(expect.objectContaining({ id: customEdge.id }));
    expect(canvasNodes).toContainEqual(expect.objectContaining({ id: customNode.id }));
    expect(canvasNodes.some((node: any) => node.id === staleNode.id)).toBe(false);
  });
});
