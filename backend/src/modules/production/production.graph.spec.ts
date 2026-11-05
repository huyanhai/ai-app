import { buildProductionGraph } from './production.graph';
import { ProductionPlan } from './production.types';

const plan: ProductionPlan = {
  title: '测试短片',
  synopsis: '梗概',
  story: '故事',
  visualStyle: '写实',
  ratio: '16:9',
  characters: [
    {
      id: 'character-1',
      name: '小林',
      description: '青年',
      referencePrompt: '角色图',
    },
  ],
  scenes: [
    {
      id: 'scene-1',
      title: '天台',
      script: '小林来到天台。',
      location: '天台',
      referencePrompt: '场景图',
      shots: [
        {
          id: 'shot-1',
          title: '到来',
          description: '小林走上天台',
          movement: '缓慢推进',
          visualPrompt: '画面一',
          motionPrompt: '镜头推进，小林停下脚步',
          duration: 4,
          characterIds: ['character-1'],
        },
        {
          id: 'shot-2',
          title: '远眺',
          description: '小林望向城市',
          movement: '横移',
          visualPrompt: '画面二',
          motionPrompt: '镜头横移，展示城市远景',
          duration: 5,
          characterIds: ['character-1'],
          transitionFromPrevious: {
            mode: 'continuous' as const,
            rationale: '同一动作继续',
            bridge: '转头动作',
            previousOutro: '小林停下脚步并转头',
            currentIntro: '从小林转头继续横移',
            cameraPath: '保持横移方向',
            consistency: '保持人物位置和城市光线',
          },
        },
      ],
    },
  ],
};

describe('buildProductionGraph', () => {
  it('only creates script nodes before character and storyboard confirmation', () => {
    const graph = buildProductionGraph({ ...plan, characters: [] }, 'script');
    expect(graph.nodes.map((node) => node.id)).toEqual([
      'production-story',
      'text-scene-1',
    ]);
    expect(
      graph.nodes.some((node) =>
        ['imageNode', 'videoNode', 'subjectNode'].includes(node.type),
      ),
    ).toBe(false);
  });

  it('builds script scenes before shots exist', () => {
    const graph = buildProductionGraph({
      ...plan,
      characters: [],
      scenes: plan.scenes.map(({ shots, ...scene }) => scene),
    } as ProductionPlan, 'script');
    expect(graph.nodes.map((node) => node.id)).toEqual([
      'production-story',
      'text-scene-1',
    ]);
  });

  it('creates the complete editable production graph without media results', () => {
    const graph = buildProductionGraph(plan);
    expect(graph.nodes).toHaveLength(11);
    expect(
      graph.nodes.filter((node) => node.type === 'shotTableNode'),
    ).toHaveLength(1);
    expect(
      graph.nodes.find((node) => node.type === 'shotTableNode')?.data.shots,
    ).toHaveLength(2);
    expect(graph.nodes.some((node) => node.id === 'text-shot-1')).toBe(false);
    expect(
      graph.nodes.filter((node) => node.type === 'imageNode'),
    ).toHaveLength(5);
    expect(
      graph.nodes.filter((node) => node.type === 'videoNode'),
    ).toHaveLength(2);
    expect(
      graph.nodes
        .filter((node) => ['imageNode', 'videoNode'].includes(node.type))
        .every((node) => !node.data.url && node.data.status === undefined),
    ).toBe(true);
  });

  it('keeps 80px gaps between scene images, shot table, storyboards, and videos', () => {
    const graph = buildProductionGraph(plan);
    const positions = Object.fromEntries(graph.nodes.map((node) => [node.id, node.position]));
    const mediaWidth = 250 * 16 / 9;

    expect(positions['production-shot-table'].x - positions['image-scene-1'].x).toBeCloseTo(mediaWidth + 80);
    expect(positions['image-shot-1'].x - positions['production-shot-table'].x).toBe(1600 + 80);
    expect(positions['video-shot-1'].x - positions['image-shot-1'].x).toBeCloseTo(mediaWidth + 80);
  });

  it('connects character references, storyboards, and generated videos', () => {
    const graph = buildProductionGraph(plan);
    const storyboardSources = graph.edges
      .filter((edge) => edge.target === 'image-shot-1')
      .map((edge) => edge.source);
    expect(storyboardSources).toEqual(
      expect.arrayContaining([
        'production-shot-table',
        'image-scene-1',
        'image-character-1-turnaround',
      ]),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: 'image-character-1',
        target: 'image-character-1-turnaround',
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: 'image-shot-1',
        target: 'video-shot-1',
      }),
    );
    expect(new Set(graph.edges.map((edge) => edge.id)).size).toBe(
      graph.edges.length,
    );
  });

  it('separates character environment images from turnaround references', () => {
    const graph = buildProductionGraph(plan);
    const environment = graph.nodes.find(
      (node) => node.id === 'image-character-1',
    );
    const turnaround = graph.nodes.find(
      (node) => node.id === 'image-character-1-turnaround',
    );

    expect(environment?.data.draftText).toContain('禁止三视图');
    expect(environment?.data.draftText).toContain('保留符合角色身份与剧本场景的环境');
    expect(turnaround?.data.draftText).toContain('正面、侧面、背面');
    expect(turnaround?.data.production.referenceType).toBe('turnaround');
  });

  it('adds continuity only when explicitly enabled', () => {
    const standard = buildProductionGraph(plan);
    const continuous = buildProductionGraph(plan, 'storyboard', true);
    expect(standard.edges.some((edge) => edge.data?.kind === 'continuity')).toBe(false);
    expect(continuous.edges).toContainEqual(expect.objectContaining({
      source: 'video-shot-1',
      target: 'video-shot-2',
      data: { kind: 'continuity' },
    }));
    const first = continuous.nodes.find((node) => node.id === 'video-shot-1');
    const second = continuous.nodes.find((node) => node.id === 'video-shot-2');
    expect(first?.data.production.continuity).toBeUndefined();
    expect(first?.data.production.outgoingContinuity.prompt).toContain('小林停下脚步并转头');
    expect(second?.data.draftText).toBe('镜头横移，展示城市远景');
    expect(second?.data.production.continuity).toEqual(expect.objectContaining({
      previousVideoId: 'video-shot-1',
      prompt: expect.stringContaining('从小林转头继续横移'),
    }));
  });

  it('uses independent generation when the director designs a cut', () => {
    const graph = buildProductionGraph({
      ...plan,
      scenes: [{
        ...plan.scenes[0],
        shots: plan.scenes[0].shots.map((shot) => shot.id === 'shot-2'
          ? { ...shot, transitionFromPrevious: { ...shot.transitionFromPrevious!, mode: 'cut' as const } }
          : shot),
      }],
    }, 'storyboard', true);
    expect(graph.edges.some((edge) => edge.data?.kind === 'continuity')).toBe(false);
    expect(graph.nodes.find((node) => node.id === 'video-shot-2')?.data.production.continuity).toBeUndefined();
    expect(graph.nodes.find((node) => node.id === 'video-shot-1')?.data.production.outgoingContinuity).toBeUndefined();
  });

  it('allows a designed continuous transition across scenes', () => {
    const firstShot = plan.scenes[0].shots[0];
    const secondShot = plan.scenes[0].shots[1];
    const graph = buildProductionGraph({
      ...plan,
      scenes: [
        { ...plan.scenes[0], shots: [firstShot] },
        { ...plan.scenes[0], id: 'scene-2', shots: [secondShot] },
      ],
    }, 'storyboard', true);
    expect(graph.edges).toContainEqual(expect.objectContaining({
      source: 'video-shot-1',
      target: 'video-shot-2',
      data: { kind: 'continuity' },
    }));
  });
});
