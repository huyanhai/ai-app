import { ProductionPlanner } from './production.planner';

describe('ProductionPlanner creative guidance', () => {
  it('loads and caches skill guidance with production boundaries', () => {
    const planner = new ProductionPlanner({} as any);

    const guidance = (planner as any).creativeGuidance(
      'short-drama-develop',
      'short-drama-write',
      'storyboard',
    );

    expect(guidance).toContain('# 短剧开发');
    expect(guidance).toContain('# 短剧写作');
    expect(guidance).toContain('文字分镜不等于媒体产物');
    expect(guidance).toContain('阶段状态、用户确认和结构化输出契约优先');
    expect(guidance).toContain('不得执行技能脚本、调用工具或写入项目文件');
    expect((planner as any).skillCache.size).toBe(3);
  });

  it('streams partial structured output and returns the validated script', async () => {
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
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        stream: async function* () {
          yield { title: script.title };
          yield script;
        },
      }),
    });
    const onChunk = jest.fn();

    await expect(
      planner.script('一个故事', undefined, onChunk),
    ).resolves.toEqual(script);
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenLastCalledWith(script);
  });

  it('keeps director designed transitions with each following shot', async () => {
    const transitionFromPrevious = {
      mode: 'continuous',
      rationale: '动作与视线一致',
      bridge: '翻起的水花',
      previousOutro: '船尾水花向镜头升起',
      currentIntro: '从遮挡镜头的水花后显出海岸',
      cameraPath: '跟随水花向前推进',
      consistency: '保持运动方向、冷色光线和节奏',
    };
    const plan = {
      title: '短片',
      synopsis: '梗概',
      story: '完整故事',
      visualStyle: '写实',
      ratio: '16:9',
      characters: [],
      scenes: [{
        id: 'scene-1',
        title: '天台',
        script: '小林来到天台。',
        location: '天台',
        referencePrompt: '天台环境',
        shots: [
          { id: 'shot-1', title: '到来', description: '来到天台', movement: '推进', duration: 4, characterIds: [], visualPrompt: '图一' },
          { id: 'shot-2', title: '远眺', description: '望向城市', movement: '横移', duration: 4, characterIds: [], visualPrompt: '图二' },
        ],
      }],
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        stream: async function* () {
          yield { scenes: [{ id: 'scene-1', shots: [
            { id: 'shot-1', motionPrompt: '视频一' },
            { id: 'shot-2', motionPrompt: '视频二', transitionFromPrevious },
          ] }] };
        },
      }),
    });

    const result = await planner.videoPrompts(plan as any);
    expect(result.scenes[0].shots[0].motionPrompt).toBe('视频一');
    expect(result.scenes[0].shots[1].transitionFromPrevious).toEqual(transitionFromPrevious);
  });
});
