import {
  ProductionEdge,
  ProductionNode,
  ProductionPlan,
  ProductionStory,
  PRODUCTION_PHASE,
} from './production.types';
import { markProductionPromptAssets } from './production.prompt-assets';

const edge = (source: string, target: string): ProductionEdge => ({
  id: `edge-${source}-${target}`,
  source,
  target,
  sourceHandle: 'source-anchor',
  targetHandle: 'target-anchor',
});

const characterReferencePrompt = (prompt: string) => `${prompt}\n\n直接生成同一角色的标准全身三视图：正面、严格90度侧面、背面按左中右横向并排展示，保持完全相同的五官、发型、年龄、服装、配饰、材质和身材比例。三个人物均为全身完整可见、中性站姿、相同比例，使用简洁浅色无场景背景。禁止生成角色环境图、剧情动作、其他人物、道具表演或环境装饰。`;

const sceneReferencePrompt = (prompt: string) => `${prompt}\n\n只生成无人环境参考图，用于固定场景的空间布局、建筑风格、自然地貌、陈设、光线和色彩。禁止出现任何人物、角色、人影、人体局部、故事动物或角色倒影，不要表现剧情动作；角色和表演仅在后续分镜图中加入。`;

const propReferencePrompt = (prompt: string) => `${prompt}\n\n直接生成独立关键道具的标准三视图：正面、侧面、背面按左中右横向并排展示，三个视角的结构、材质、颜色、比例、磨损和标记完全一致。完整展示该物体或固定连接组件，使用简洁中性无场景背景。禁止出现任何人物、角色、人影、人体局部、故事动物或角色倒影，不表现角色操作、剧情动作或环境装饰。`;

export function buildProductionPrevizGraph(plan: ProductionPlan, currentNodes: ProductionNode[]) {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));
  const [ratioWidth, ratioHeight] = plan.ratio.split(':').map(Number);
  const mediaWidth = ratioWidth > ratioHeight ? 250 * ratioWidth / ratioHeight : 250;
  const nodes: ProductionNode[] = [];
  const edges: ProductionEdge[] = [];
  const addEdge = (source: string, target: string, membership = false) => {
    if (!currentById.has(source) && source !== 'production-shot-table') return;
    edges.push({
      ...edge(source, target),
      ...(membership ? { data: { kind: 'sceneMembership' as const } } : {}),
    });
  };
  let shotIndex = 0;
  plan.scenes.forEach((scene) => scene.shots.forEach((shot) => {
    const id = `previz-${shot.id}`;
    const finalNode = currentById.get(`image-${shot.id}`);
    const videoNode = currentById.get(`video-${shot.id}`);
    const position = videoNode?.position ?? finalNode?.position ?? { x: 3600, y: shotIndex * 430 };
    shotIndex += 1;
    if (currentById.has(id)) return;
    const prompt = `${shot.visualPrompt || `${shot.description}。动作与运镜：${shot.movement}`}\n\n生成黑白铅笔草图故事板，清晰呈现角色位置、动作相位、视线、道具状态和构图，保留表演与叙事信息，不添加编号、时间码、文字或水印。`;
    nodes.push({
      id,
      type: 'imageNode',
      position: { x: position.x + mediaWidth + 80, y: position.y },
      data: {
        title: `${shot.title} · 草图`,
        url: '',
        draftText: markProductionPromptAssets(prompt, plan, scene),
        config: { ratio: plan.ratio, resolution: '1K', count: 1 },
        production: {
          kind: PRODUCTION_PHASE.previz,
          sceneId: scene.id,
          shotId: shot.id,
          characterIds: shot.characterIds,
          propIds: shot.propIds,
          prompt,
          version: 1,
        },
      },
    });
    addEdge(`text-${scene.id}`, id, true);
    addEdge(`image-${scene.sceneAssetId ?? scene.id}`, id);
    shot.characterIds.forEach((characterId) => addEdge(`image-${characterId}`, id));
    shot.propIds?.forEach((propId) => addEdge(`image-${propId}`, id));
  }));
  return { nodes, edges };
}

export function buildProductionStoryGraph(plan: ProductionStory) {
  return {
    nodes: [{
      id: 'production-story',
      type: 'textNode' as const,
      position: { x: 0, y: 0 },
      data: {
        title: plan.title,
        text: plan.story,
        config: { scene: 'script' },
        production: { kind: 'story', version: 1 },
      },
    }],
    edges: [] as ProductionEdge[],
  };
}

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
  const mediaHeight = ratioWidth > ratioHeight ? 250 : 250 * ratioHeight / ratioWidth;
  const turnaroundWidth = 250 * 16 / 9;
  const referenceImageX = 760;
  const sceneTextX = referenceImageX + turnaroundWidth + 80;
  const sceneImageX = sceneTextX + 250 + 80;
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

  let assetY = 0;
  (plan.characters ?? []).forEach((character) => {
    const subjectId = `subject-${character.id}`;
    const imageId = `image-${character.id}`;
    const characterPrompt = characterReferencePrompt(character.referencePrompt);
    const y = assetY;
    assetY += Math.max(360, mediaHeight + 110);
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
        position: { x: referenceImageX, y },
        data: {
          title: `${character.name} · 角色三视图`,
          url: '',
          draftText: characterPrompt,
          config: { ratio: '16:9', resolution: '2K', count: 1 },
          production: {
            kind: PRODUCTION_PHASE.character,
            characterId: character.id,
            prompt: characterPrompt,
            referenceType: 'turnaround',
            version: 1,
          },
        },
      });
    edges.push(edge(storyId, subjectId));
    if (stage === 'storyboard') edges.push(edge(subjectId, imageId));
  });

  (plan.props ?? []).forEach((prop) => {
    const subjectId = `subject-${prop.id}`;
    const imageId = `image-${prop.id}`;
    const textId = `text-${prop.id}-content`;
    const y = assetY;
    assetY += prop.textContent ? 510 : 360;
    nodes.push({
      id: subjectId,
      type: 'subjectNode',
      position: { x: 380, y },
      data: {
        title: prop.name,
        name: prop.name,
        description: `${prop.description}${prop.textContent ? `\n固定可见文字：${prop.textContent}` : ''}`,
        production: { kind: 'prop', propId: prop.id, version: 1 },
      },
    });
    if (prop.textContent) {
      nodes.push({
        id: textId,
        type: 'textNode',
        position: { x: 380, y: y + 180 },
        data: {
          title: `${prop.name} · 固定文字`,
          text: prop.textContent,
          production: { kind: 'propText', propId: prop.id, version: 1 },
        },
      });
      edges.push(edge(storyId, textId));
    }
    if (stage === 'storyboard') {
      nodes.push({
        id: imageId,
        type: 'imageNode',
        position: { x: referenceImageX, y },
        data: {
          title: `${prop.name} · 道具三视图`,
          url: '',
          draftText: propReferencePrompt(prop.referencePrompt),
          config: { ratio: '16:9', resolution: '2K', count: 1 },
          production: {
            kind: PRODUCTION_PHASE.prop,
            propId: prop.id,
            prompt: propReferencePrompt(prop.referencePrompt),
            textContent: prop.textContent,
            version: 1,
          },
        },
      });
      edges.push(edge(subjectId, imageId));
      if (prop.textContent) edges.push(edge(textId, imageId));
    }
    edges.push(edge(storyId, subjectId));
  });

  const sceneAssets = [...(plan.sceneAssets ?? [])];
  const sceneAssetIds = new Map<string, string>();
  if (plan.sceneAssets) {
    plan.scenes.forEach((scene) =>
      sceneAssetIds.set(scene.id, scene.sceneAssetId ?? scene.id),
    );
  } else {
    const legacyAssets = new Map<string, (typeof sceneAssets)[number]>();
    plan.scenes.forEach((scene) => {
      const key = scene.location.trim().toLocaleLowerCase() || scene.id;
      let asset = legacyAssets.get(key);
      if (!asset) {
        asset = {
          id: scene.sceneAssetId ?? scene.id,
          title: scene.location || scene.title,
          location: scene.location,
          referencePrompt: scene.referencePrompt ?? '',
        };
        legacyAssets.set(key, asset);
        sceneAssets.push(asset);
      }
      sceneAssetIds.set(scene.id, asset.id);
    });
  }
  if (stage === 'storyboard')
    sceneAssets.forEach((scene) => {
      const scenePrompt = sceneReferencePrompt(scene.referencePrompt);
      nodes.push({
        id: `image-${scene.id}`,
        type: 'imageNode',
        position: { x: referenceImageX, y: assetY },
        data: {
          title: `${scene.title} · 场景参考图`,
          url: '',
          draftText: scenePrompt,
          config: { ratio: plan.ratio, resolution: '2K', count: 1 },
          production: {
            kind: PRODUCTION_PHASE.scene,
            sceneAssetId: scene.id,
            prompt: scenePrompt,
            version: 1,
          },
        },
      });
      assetY += Math.max(360, mediaHeight + 110);
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
    const sceneImageId = `image-${sceneAssetIds.get(scene.id) ?? scene.sceneAssetId ?? scene.id}`;
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
    edges.push(edge(storyId, sceneTextId));

    if (stage === 'storyboard')
      shots.forEach((shot, shotIndex) => {
        const previousShot = previousShots.get(shot.id);
        const transition = shot.transitionFromPrevious;
        const useContinuity = Boolean(
          continuity &&
            previousShot &&
            previousShot.continuityGroupId === shot.continuityGroupId &&
            transition?.mode === 'continuous',
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
            draftText: markProductionPromptAssets(
              shot.visualPrompt ?? '',
              plan,
              scene,
            ),
            config: { ratio: plan.ratio, resolution: '2K', count: 1 },
            production: {
              kind: PRODUCTION_PHASE.storyboard,
              sceneId: scene.id,
              shotId: shot.id,
              characterIds: shot.characterIds,
              propIds: shot.propIds,
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
            draftText: markProductionPromptAssets(
              shot.motionPrompt ?? '',
              plan,
              scene,
            ),
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
          {
            ...edge(sceneTextId, shotImageId),
            data: { kind: 'sceneMembership' },
          },
          edge(sceneImageId, shotImageId),
          edge(shotImageId, videoId),
        );
        shot.characterIds.forEach((characterId) => {
          edges.push(edge(`image-${characterId}`, shotImageId));
        });
        shot.propIds?.forEach((propId) => {
          edges.push(edge(`image-${propId}`, shotImageId));
          const prop = plan.props?.find((item) => item.id === propId);
          if (prop?.textContent) edges.push(edge(`text-${propId}-content`, shotImageId));
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
