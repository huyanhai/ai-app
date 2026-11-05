import { ProductionService } from './production.service';
import { ChunkStatus } from '@/common/utils/ai-stream-utils';
import { genVideo, queryVideoTask } from '@/common/llm/tools/gen-video';

jest.mock('@/common/llm/tools/gen-video', () => ({
  genVideo: jest.fn(),
  queryVideoTask: jest.fn(),
}));

const makeService = (project: any, planner: any = {}) => {
  const prisma = {
    productionProject: {
      findUnique: jest.fn().mockResolvedValue(project),
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
    canvasState: { upsert: jest.fn().mockResolvedValue({}) },
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

  it('generates only the script after requirements confirmation', async () => {
    const planner = {
      script: jest.fn().mockResolvedValue(script),
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
    const { service } = makeService(project, planner);
    const result = await service.confirmStage('project-1', {
      nodes: [],
      edges: [],
    });
    expect(result.status).toBe('script_review');
    expect(planner.script).toHaveBeenCalledWith(
      '确认后的需求',
      undefined,
      expect.any(Function),
    );
    expect(planner.characters).not.toHaveBeenCalled();
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
      nodes: [],
      edges: [],
    });
    expect(result.status).toBe('requirements_review');
    expect(result.requirements.brief).toBe('Agent 补充后的完整需求');
    expect(planner.requirements.mock.calls[0][0]).toContain(
      '我授权你根据已知需求自动补充',
    );
    expect(
      result.events.some(
        (event) => event.message === '用户修改意见：让 Agent 帮我补充',
      ),
    ).toBe(true);
    expect(planner.script).not.toHaveBeenCalled();
  });

  it('generates characters only after script confirmation', async () => {
    const planner = {
      characters: jest.fn().mockResolvedValue([
        {
          id: 'character-1',
          name: '小林',
          description: '青年',
          referencePrompt: '角色图',
        },
      ]),
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
        title: '下一镜', draftText: '原始提示词', config: {}, production: {
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
      'sceneReference',
    ]);
  });
});
