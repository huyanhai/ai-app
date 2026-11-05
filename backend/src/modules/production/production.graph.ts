import {
  ProductionEdge,
  ProductionNode,
  ProductionPlan,
  PRODUCTION_PHASE,
} from './production.types';

const edge = (source: string, target: string): ProductionEdge => ({
  id: `edge-${source}-${target}`,
  source,
  target,
  sourceHandle: 'source-anchor',
  targetHandle: 'target-anchor',
});

const singleCharacterPrompt = (prompt: string) => `${prompt}\n\n只生成一幅正常的角色环境图：同一画面仅出现该角色一个人物、一个视角，保留符合角色身份与剧本场景的环境和自然光线。禁止三视图、多视角、正侧背并列、人物设定板、拼图、分栏和纯白色背景。`;

const turnaroundPrompt = (prompt: string) => `${prompt}\n\n基于已生成的角色环境图，为同一角色制作标准三视图参考：正面、侧面、背面并排展示，保持完全相同的五官、发型、年龄、服装、配饰、材质和身材比例。人物全身完整可见，中性站姿，简洁浅色背景，三视图排版清晰，不添加其他人物或环境。`;

export function buildProductionGraph(
  plan: ProductionPlan,
  stage:
    | 'script'
    | 'characters'
    | 'storyboard'
    | 'imagePrompts'
    | 'videoPrompts' = 'storyboard',
  continuity = false,
) {
  const nodes: ProductionNode[] = [];
  const edges: ProductionEdge[] = [];
  const [ratioWidth, ratioHeight] = plan.ratio.split(':').map(Number);
  const mediaWidth = ratioWidth > ratioHeight ? 250 * ratioWidth / ratioHeight : 250;
  const sceneTextX = 1480;
  const sceneImageX = 1840;
  const shotTableX = sceneImageX + mediaWidth + 80;
  const shotImageX = shotTableX + 1600 + 80;
  const videoX = shotImageX + mediaWidth + 80;
  const storyId = 'production-story';
  nodes.push({
    id: storyId,
    type: 'textNode',
    position: { x: 0, y: 0 },
    data: {
      title: plan.title,
      text: `${plan.synopsis}\n\n${plan.story}`,
      config: { scene: 'script' },
      production: { kind: 'story', version: 1 },
    },
  });

  (plan.characters ?? []).forEach((character, index) => {
    const subjectId = `subject-${character.id}`;
    const imageId = `image-${character.id}`;
    const turnaroundId = `${imageId}-turnaround`;
    const characterPrompt = singleCharacterPrompt(character.referencePrompt);
    const characterTurnaroundPrompt = turnaroundPrompt(character.referencePrompt);
    const y = index * 360;
    nodes.push({
      id: subjectId,
      type: 'subjectNode',
      position: { x: 380, y },
      data: {
        title: character.name,
        name: character.name,
        description: character.description,
        production: {
          kind: 'character',
          characterId: character.id,
          version: 1,
        },
      },
    });
    if (stage === 'storyboard')
      nodes.push({
        id: imageId,
        type: 'imageNode',
        position: { x: 740, y },
        data: {
          title: `${character.name} · 角色参考图`,
          url: '',
          draftText: characterPrompt,
          config: { ratio: '1:1', resolution: '2K', count: 1 },
          production: {
            kind: PRODUCTION_PHASE.character,
            characterId: character.id,
            prompt: characterPrompt,
            referenceType: 'environment',
            version: 1,
          },
        },
      });
    if (stage === 'storyboard')
      nodes.push({
        id: turnaroundId,
        type: 'imageNode',
        position: { x: 1100, y },
        data: {
          title: `${character.name} · 角色三视图`,
          url: '',
          draftText: characterTurnaroundPrompt,
          config: { ratio: '16:9', resolution: '2K', count: 1 },
          production: {
            kind: PRODUCTION_PHASE.character,
            characterId: character.id,
            prompt: characterTurnaroundPrompt,
            referenceType: 'turnaround',
            version: 1,
          },
        },
      });
    edges.push(edge(storyId, subjectId));
    if (stage === 'storyboard') edges.push(edge(subjectId, imageId));
    if (stage === 'storyboard') edges.push(edge(imageId, turnaroundId));
  });

  let sceneY = 0;
  const orderedShots = plan.scenes.flatMap((scene) => scene.shots ?? []);
  const previousShots = new Map(
    orderedShots.slice(1).map((shot, index) => [shot.id, orderedShots[index]]),
  );
  const shotTableId = 'production-shot-table';
  if (stage === 'storyboard')
    nodes.push({
      id: shotTableId,
      type: 'shotTableNode',
      position: { x: shotTableX, y: 0 },
      data: {
        title: '全片分镜表',
        shots: plan.scenes.flatMap((scene) =>
          scene.shots.map((shot) => ({
            ...shot,
            sceneId: scene.id,
            sceneTitle: scene.title,
          })),
        ),
        production: { kind: 'shotTable', version: 1 },
      },
    });
  plan.scenes.forEach((scene) => {
    const sceneTextId = `text-${scene.id}`;
    const sceneImageId = `image-${scene.id}`;
    const shots = scene.shots ?? [];
    const sceneHeight = Math.max(1, shots.length) * 430;
    nodes.push({
      id: sceneTextId,
      type: 'textNode',
      position: { x: sceneTextX, y: sceneY },
      data: {
        title: scene.title,
        text: scene.script,
        config: { scene: 'script' },
        production: { kind: 'scene', sceneId: scene.id, version: 1 },
      },
    });
    if (stage === 'storyboard')
      nodes.push({
        id: sceneImageId,
        type: 'imageNode',
        position: { x: sceneImageX, y: sceneY },
        data: {
          title: `${scene.title} · 场景参考图`,
          url: '',
          draftText: scene.referencePrompt,
          config: { ratio: plan.ratio, resolution: '2K', count: 1 },
          production: {
            kind: PRODUCTION_PHASE.scene,
            sceneId: scene.id,
            prompt: scene.referencePrompt,
            version: 1,
          },
        },
      });
    edges.push(edge(storyId, sceneTextId));
    if (stage === 'storyboard') edges.push(edge(sceneTextId, sceneImageId));
    if (stage === 'storyboard') edges.push(edge(sceneTextId, shotTableId));

    if (stage === 'storyboard')
      shots.forEach((shot, shotIndex) => {
        const previousShot = previousShots.get(shot.id);
        const transition = shot.transitionFromPrevious;
        const useContinuity = Boolean(
          continuity && previousShot && transition?.mode === 'continuous',
        );
        const shotImageId = `image-${shot.id}`;
        const videoId = `video-${shot.id}`;
        const previousVideoId = previousShot
          ? `video-${previousShot.id}`
          : undefined;
        const continuityPrompt = useContinuity && transition
          ? [`入场锁定：首帧就是上一镜真实尾帧，开头0.2秒严格保持首帧的构图、景别、主体大小与位置、曝光和白平衡，不得重新设计开场或立即拉远、切换视角。随后从首帧已有动作继续：${transition.currentIntro}`, `跨镜头相机路径：${transition.cameraPath}`, `一致性要求：${transition.consistency}。全段光线与色彩只能连续渐变，禁止接点处跳变。`].join('\n')
          : undefined;
        const y = sceneY + shotIndex * 430;
        nodes.push({
          id: shotImageId,
          type: 'imageNode',
          position: { x: shotImageX, y },
          data: {
            title: `${shot.title} · 分镜图`,
            url: '',
            draftText: shot.visualPrompt ?? '',
            config: { ratio: plan.ratio, resolution: '2K', count: 1 },
            production: {
              kind: PRODUCTION_PHASE.storyboard,
              sceneId: scene.id,
              shotId: shot.id,
              characterIds: shot.characterIds,
              prompt: shot.visualPrompt,
              version: 1,
            },
          },
        });
        nodes.push({
          id: videoId,
          type: 'videoNode',
          position: { x: videoX, y },
          data: {
            title: `${shot.title} · 视频`,
            url: '',
            draftText: shot.motionPrompt ?? '',
            config: {
              ratio: plan.ratio,
              duration: shot.duration,
              videoMode: 'imageToVideo',
              resolution: '720P',
              count: 1,
            },
            production: {
              kind: PRODUCTION_PHASE.video,
              sceneId: scene.id,
              shotId: shot.id,
              prompt: shot.motionPrompt,
              continuity: continuityPrompt && previousShot
                ? { previousVideoId, prompt: continuityPrompt }
                : undefined,
              outgoingContinuity: undefined,
              version: 1,
            },
          },
        });
        edges.push(
          edge(shotTableId, shotImageId),
          edge(sceneImageId, shotImageId),
          edge(shotImageId, videoId),
        );
        shot.characterIds.forEach((characterId) => {
          edges.push(edge(`image-${characterId}-turnaround`, shotImageId));
        });
        if (continuityPrompt && previousVideoId && transition) {
          const previousVideo = nodes.find((node) => node.id === previousVideoId);
          if (previousVideo)
            previousVideo.data.production.outgoingContinuity = {
              nextVideoId: videoId,
              prompt: [`转场出场：${transition.previousOutro}`, '结尾必须完成上述出场设计，并与下一镜开场匹配；不要在结尾额外改变景别、运动方向、曝光或白平衡。'].join('\n'),
            };
          edges.push({
            ...edge(previousVideoId, videoId),
            id: `edge-continuity-${previousVideoId}-${videoId}`,
            label: '尾帧续接',
            data: { kind: 'continuity' },
          });
        }
      });
    sceneY += sceneHeight;
  });

  return { nodes, edges };
}
