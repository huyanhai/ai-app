import { buildProductionGraph, buildProductionPrevizGraph } from './production.graph';
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
  sceneAssets: [{
    id: 'scene-asset-1',
    title: '天台',
    location: '天台',
    referencePrompt: '场景图',
  }],
  scenes: [
    {
      id: 'scene-1',
      title: '天台',
      script: '小林来到天台。',
      location: '天台',
      sceneAssetId: 'scene-asset-1',
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
  it('creates independent previz nodes without generating or replacing final media', () => {
    const current = buildProductionGraph(plan).nodes.map((node) => ({
      ...node,
      data: node.id === 'image-shot-1'
        ? { ...node.data, url: 'final.png', status: 'success' }
        : node.data,
    }));
    const first = buildProductionPrevizGraph(plan, current);
    expect(first.nodes).toHaveLength(2);
    expect(first.nodes.every((node) => node.data.production.kind === 'storyboardPreviz')).toBe(true);
    expect(first.nodes.every((node) => node.data.url === '' && node.data.config.resolution === '1K')).toBe(true);
    expect(first.nodes[0].data.draftText).toContain('黑白铅笔草图故事板');
    expect(first.edges.some((edge) => edge.source === 'image-character-1' && edge.target === 'previz-shot-1')).toBe(true);

    const second = buildProductionPrevizGraph(plan, [...current, ...first.nodes]);
    expect(second.nodes).toHaveLength(0);
    expect(current.find((node) => node.id === 'image-shot-1')?.data.url).toBe('final.png');
  });

  it('links key prop references and fixed text only to shots that use them', () => {
    const graph = buildProductionGraph({
      ...plan,
      props: [{
        id: 'prop-1', name: '书信', description: '泛黄信纸', referencePrompt: '书信特写',
        textContent: '君问归期未有期',
      }],
      scenes: plan.scenes.map((scene) => ({
        ...scene,
        shots: scene.shots.map((shot, index) => ({ ...shot, propIds: index === 0 ? ['prop-1'] : [] })),
      })),
    });

    expect(graph.nodes.some((node) => node.id === 'image-prop-1' && node.data.production.kind === 'propReference')).toBe(true);
    expect(graph.nodes.find((node) => node.id === 'text-prop-1-content')?.data.text).toBe('君问归期未有期');
    expect(graph.nodes.find((node) => node.id === 'image-prop-1')?.data.draftText).toContain('禁止出现任何人物');
    expect(graph.nodes.find((node) => node.id === 'image-prop-1')?.data.draftText).toContain('标准三视图');
    expect(graph.nodes.find((node) => node.id === 'image-prop-1')?.data.config.ratio).toBe('16:9');
    expect(graph.edges.some((edge) => edge.source === 'image-prop-1' && edge.target === 'image-shot-1')).toBe(true);
    expect(graph.edges.some((edge) => edge.source === 'text-prop-1-content' && edge.target === 'image-shot-1')).toBe(true);
    expect(graph.edges.some((edge) => edge.source === 'image-prop-1' && edge.target === 'image-shot-2')).toBe(false);
  });

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
    expect(graph.nodes).toHaveLength(10);
    expect(
      graph.nodes.filter((node) => node.type === 'shotTableNode'),
    ).toHaveLength(1);
    expect(
      graph.nodes.find((node) => node.type === 'shotTableNode')?.data.shots,
    ).toHaveLength(2);
    expect(graph.nodes.some((node) => node.id === 'text-shot-1')).toBe(false);
    expect(
      graph.nodes.filter((node) => node.type === 'imageNode'),
    ).toHaveLength(4);
    expect(
      graph.nodes.filter((node) => node.type === 'videoNode'),
    ).toHaveLength(2);
    expect(
      graph.nodes
        .filter((node) => ['imageNode', 'videoNode'].includes(node.type))
        .every((node) => !node.data.url && node.data.status === undefined),
    ).toBe(true);
  });

  it('adds asset marks when reading prompts from an existing plan', () => {
    const graph = buildProductionGraph({
      ...plan,
      scenes: plan.scenes.map((scene) => ({
        ...scene,
        shots: scene.shots.map((shot) => ({
          ...shot,
          visualPrompt: '小林在[天台]停留，天台光线明亮',
          motionPrompt: '小林离开天台',
        })),
      })),
    });

    expect(graph.nodes.find((node) => node.id === 'image-shot-1')?.data.draftText).toBe(
      '[小林]在[天台]停留，[天台]光线明亮',
    );
    expect(graph.nodes.find((node) => node.id === 'video-shot-1')?.data.draftText).toBe(
      '[小林]离开[天台]',
    );
  });

  it('keeps 80px gaps between the shot table, storyboards, and videos', () => {
    const graph = buildProductionGraph(plan);
    const positions = Object.fromEntries(graph.nodes.map((node) => [node.id, node.position]));
    const mediaWidth = 250 * 16 / 9;

    expect(positions['production-shot-table'].x - positions['text-scene-1'].x).toBeCloseTo(250 + mediaWidth + 160);
    expect(positions['image-shot-1'].x - positions['production-shot-table'].x).toBe(1600 + 80);
    expect(positions['video-shot-1'].x - positions['image-shot-1'].x).toBeCloseTo(mediaWidth + 80);
    expect(positions['text-scene-1'].x - positions['image-character-1'].x).toBeCloseTo(250 * 16 / 9 + 80);
    expect(positions['image-scene-asset-1'].x).toBe(positions['image-character-1'].x);
  });

  it('connects character references, storyboards, and generated videos', () => {
    const graph = buildProductionGraph(plan);
    const storyboardSources = graph.edges
      .filter((edge) => edge.target === 'image-shot-1')
      .map((edge) => edge.source);
    expect(storyboardSources).toEqual(
      expect.arrayContaining([
        'image-scene-asset-1',
        'image-character-1',
      ]),
    );
    expect(graph.edges.some((edge) => edge.source === 'production-shot-table' || edge.target === 'production-shot-table')).toBe(false);
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

  it('directly creates character turnaround references without environment images', () => {
    const graph = buildProductionGraph(plan);
    const turnaround = graph.nodes.find(
      (node) => node.id === 'image-character-1',
    );

    expect(turnaround?.data.draftText).toContain('正面、严格90度侧面、背面');
    expect(turnaround?.data.draftText).toContain('禁止生成角色环境图');
    expect(turnaround?.data.config.ratio).toBe('16:9');
    expect(turnaround?.data.production.referenceType).toBe('turnaround');
    expect(graph.nodes.some((node) => node.id.endsWith('-turnaround'))).toBe(false);
  });

  it('keeps scene reference images free of characters and story action', () => {
    const graph = buildProductionGraph(plan);
    const scene = graph.nodes.find((node) => node.id === 'image-scene-asset-1');

    expect(scene?.data.draftText).toContain('只生成无人环境参考图');
    expect(scene?.data.draftText).toContain('禁止出现任何人物、角色、人影');
    expect(scene?.data.production.prompt).toBe(scene?.data.draftText);
  });

  it('shares an independent scene asset across script scenes', () => {
    const graph = buildProductionGraph({
      ...plan,
      scenes: [
        { ...plan.scenes[0], shots: [plan.scenes[0].shots[0]] },
        {
          ...plan.scenes[0],
          id: 'scene-2',
          title: '第一次扑击',
          script: '同一地点发生下一段动作。',
          shots: [{ ...plan.scenes[0].shots[1], id: 'shot-3' }],
        },
      ],
    });

    expect(graph.nodes.filter((node) => node.data.production?.kind === 'sceneReference')).toHaveLength(1);
    expect(graph.edges.some((edge) => edge.source === 'text-scene-1' && edge.target === 'image-scene-asset-1')).toBe(false);
    expect(graph.edges.some((edge) => edge.source === 'text-scene-2' && edge.target === 'image-scene-asset-1')).toBe(false);
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'image-scene-asset-1', target: 'image-shot-1' }),
      expect.objectContaining({ source: 'image-scene-asset-1', target: 'image-shot-3' }),
      expect.objectContaining({ source: 'text-scene-1', target: 'image-shot-1', data: { kind: 'sceneMembership' } }),
      expect.objectContaining({ source: 'text-scene-2', target: 'image-shot-3', data: { kind: 'sceneMembership' } }),
    ]));
  });

  it('migrates legacy script scenes at the same location to one scene asset', () => {
    const { sceneAssets, ...legacyPlan } = plan;
    const graph = buildProductionGraph({
      ...legacyPlan,
      scenes: [
        { ...plan.scenes[0], sceneAssetId: undefined, referencePrompt: '天台空景', shots: [plan.scenes[0].shots[0]] },
        {
          ...plan.scenes[0],
          id: 'scene-2',
          title: '再次回到天台',
          sceneAssetId: undefined,
          referencePrompt: '同一天台空景',
          shots: [{ ...plan.scenes[0].shots[1], id: 'shot-3' }],
        },
      ],
    });

    expect(sceneAssets).toHaveLength(1);
    expect(graph.nodes.filter((node) => node.data.production?.kind === 'sceneReference')).toHaveLength(1);
    expect(graph.nodes.find((node) => node.data.production?.kind === 'sceneReference')?.id).toBe('image-scene-1');
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'image-scene-1', target: 'image-shot-1' }),
      expect.objectContaining({ source: 'image-scene-1', target: 'image-shot-3' }),
    ]));
    expect(graph.edges.some((edge) => edge.source.startsWith('text-scene-') && edge.target.startsWith('image-scene-'))).toBe(false);
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

  it('does not force continuity between different narrative groups', () => {
    const graph = buildProductionGraph({
      ...plan,
      scenes: [{
        ...plan.scenes[0],
        shots: plan.scenes[0].shots.map((shot, index) => ({
          ...shot,
          continuityGroupId: `group-${index + 1}`,
        })),
      }],
    }, 'storyboard', true);
    expect(graph.edges.some((edge) => edge.data?.kind === 'continuity')).toBe(false);
    expect(graph.nodes.find((node) => node.id === 'video-shot-2')?.data.production.continuity).toBeUndefined();
  });
});
