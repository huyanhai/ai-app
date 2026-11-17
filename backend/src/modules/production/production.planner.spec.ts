import { ProductionPlanner } from './production.planner';
import { createChatModel } from '@/common/llm';

jest.mock('@/common/llm', () => ({ createChatModel: jest.fn() }));

const comedyCandidate = (id: string, mechanism: string) => ({
  id,
  title: id,
  mode: 'rivalry',
  mechanism,
  strongestGag: `${mechanism}造成的优势互换`,
  weakness: '需要控制铺垫长度',
  scores: { visual: 8, surprise: 8, causality: 9, agency: 9, callback: 8 },
});

const comedyDesign = {
  mode: 'rivalry',
  candidates: [
    comedyCandidate('candidate-1', '旋转台控制权'),
    comedyCandidate('candidate-2', '防尘罩回弹'),
    comedyCandidate('candidate-3', '护栏移动路线'),
  ],
  selectedCandidateId: 'candidate-2',
  selectionReason: '防尘罩能提前展示并在结尾改变结果，双方都有主动操作',
  performanceBudget: [
    {
      beat: '钩子',
      startState: '河狸即将吃松饼',
      action: '长脚鹬截走松饼',
      endState: '长脚鹬持有松饼',
      newInformation: '长脚鹬的长喙优势',
      seconds: 7,
    },
    {
      beat: '反转一',
      startState: '长脚鹬持有松饼',
      action: '河狸拉杆却被弹进灌木',
      endState: '河狸被困',
      newInformation: '拉杆会反向弹射操作者',
      seconds: 9,
    },
    {
      beat: '反转二',
      startState: '河狸被困',
      action: '河狸借灌木回弹夺走松饼',
      endState: '河狸控制餐车',
      newInformation: '灌木可以反向利用',
      seconds: 10,
    },
    {
      beat: '表面胜利',
      startState: '河狸控制餐车',
      action: '长脚鹬刹车接住松饼',
      endState: '长脚鹬准备吃松饼',
      newInformation: '刹车绳能停下餐车',
      seconds: 9,
    },
    {
      beat: '回敬',
      startState: '长脚鹬准备吃松饼',
      action: '河狸调整托盘并接走松饼',
      endState: '河狸获得松饼',
      newInformation: '托盘合拢能改变最后结果',
      seconds: 10,
    },
  ],
  openingHook: { visual: '松饼在河狸嘴边被长喙截走', question: '谁能吃到松饼' },
  reversals: [
    {
      actor: '河狸',
      action: '把拉杆拉到底',
      origin: 'strategy',
      setup: '拉杆越用力弹射越强',
      spatialLogic: '河狸站在已展示的弹射落点，灌木位于其后方',
      expectationEvidence: '河狸已经看过托盘弹射方向',
      expectation: '松饼越过长脚鹬',
      reversal: '河狸被弹进灌木',
      payoff: '河狸只露出尾巴',
      stateChange: '河狸被困，长脚鹬占优',
      advantageBefore: '河狸控制拉杆',
      advantageAfter: '长脚鹬控制松饼',
    },
    {
      actor: '河狸',
      action: '利用灌木回弹返回餐车',
      origin: 'strategy',
      setup: '被压弯的灌木会回弹',
      spatialLogic: '灌木与餐车距离已在开场展示，河狸调整回弹方向后落向驾驶座',
      expectationEvidence: '长脚鹬已经看见河狸被困且正在靠近炫耀',
      expectation: '长脚鹬可以安全炫耀',
      reversal: '河狸被灌木送回餐车并夺走松饼',
      payoff: '长脚鹬愣在原地',
      stateChange: '河狸取得松饼和餐车控制权',
      advantageBefore: '长脚鹬控制松饼',
      advantageAfter: '河狸控制松饼和餐车',
    },
  ],
  endingCallback: {
    apparentVictory: '长脚鹬用刹车绳拦住餐车并接住松饼',
    reusedSetup: '刹车绳自动收回带动托盘合拢',
    plantedEarly: '开场已经展示刹车绳自动收回',
    winnerAction: '河狸落地时按此前观察松开卡住的托盘',
    characterControl: '河狸主动调整托盘方向并用双手承接松饼',
    spatialSetup: '河狸提前走到托盘已展示的落点',
    scaleConsistency: '松饼能被河狸双手握住',
    finalOutcome: '长喙被夹，松饼落进河狸双手',
  },
};

const comedyStoryboardPlan = {
  workflow: 'animated-visual-comedy',
  targetDuration: 45,
  title: '最后一块松饼',
  synopsis: '争夺松饼',
  story: '河狸与长脚鹬争夺松饼',
  visualStyle: '三维动画',
  ratio: '16:9',
  comedyDesign,
  characters: [],
  props: [],
  scenes: [
    { id: 'scene-1', title: '餐吧', script: '双方争夺松饼', location: '餐吧' },
  ],
};

const comedyStoryboardResult = (roles: string[]) => ({
  sceneAssets: [
    {
      id: 'scene-asset-1',
      title: '餐吧',
      location: '餐吧',
      referencePrompt: '无人餐吧',
    },
  ],
  scenes: [
    {
      id: 'scene-1',
      sceneAssetId: 'scene-asset-1',
      shots: roles.map((role, index) => ({
        id: `shot-${index + 1}`,
        title: `剧情${index + 1}`,
        description: `新的剧情动作${index + 1}`,
        movement: '固定',
        duration: 9,
        characterIds: [],
        propIds: [],
        comedyRole: role,
      })),
    },
  ],
});

const passingComedyChecks = [
  {
    target: 'openingHook',
    category: 'hook',
    passed: true,
    evidence: '开场争夺',
    problem: '',
  },
  {
    target: 'reversal-1',
    category: 'agency',
    passed: true,
    evidence: '河狸主动拉杆',
    problem: '',
  },
  {
    target: 'reversal-2',
    category: 'expectation',
    passed: true,
    evidence: '回弹已有铺垫',
    problem: '',
  },
  {
    target: 'endingCallback',
    category: 'callback',
    passed: true,
    evidence: '托盘再次合拢',
    problem: '',
  },
  {
    target: 'physicalLogic',
    category: 'physics',
    passed: true,
    evidence: '松饼可以双手握持',
    problem: '',
  },
  {
    target: 'pacing',
    category: 'pacing',
    passed: true,
    evidence: '45秒五镜',
    problem: '',
  },
];
const passingComedyScore = {
  overall: 9.2,
  hook: 9,
  agency: 9,
  surprise: 9,
  causality: 9,
  callback: 9,
  pacing: 9,
  physics: 9,
};

describe('ProductionPlanner creative guidance', () => {
  it('disables SenseNova reasoning only for the review model', async () => {
    const runtime = jest
      .fn()
      .mockResolvedValueOnce({ modelId: 'sensenova-6.8-flash-lite' })
      .mockResolvedValueOnce({ modelId: 'other-model' });
    const planner = new ProductionPlanner({ runtime } as any);

    await (planner as any).model(undefined, {
      disableReasoning: true,
      maxTokens: 1200,
    });
    await (planner as any).model(undefined, {
      disableReasoning: true,
      maxTokens: 1200,
    });

    expect(createChatModel).toHaveBeenNthCalledWith(
      1,
      { modelId: 'sensenova-6.8-flash-lite' },
      expect.objectContaining({ modelKwargs: { reasoning_effort: 'none' } }),
    );
    expect(createChatModel).toHaveBeenNthCalledWith(
      2,
      { modelId: 'other-model' },
      expect.objectContaining({ modelKwargs: undefined }),
    );
  });

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

  it('adds the live-action poetry skill only for its selected workflow', () => {
    const planner = new ProductionPlanner({} as any);

    const selected = (planner as any).guidanceFor(
      { workflow: 'classical-poetry-live-action' },
      'short-drama-storyboard',
    );
    const standard = (planner as any).guidanceFor(
      { title: '普通短片' },
      'short-drama-storyboard',
    );

    expect(selected).toContain('# 古诗词真人微剧情');
    expect(selected).toContain('先生活，后诗意');
    expect(standard).not.toContain('# 古诗词真人微剧情');
  });

  it('adds the visual comedy skill for the animation workflow', () => {
    const planner = new ProductionPlanner({} as any);

    const guidance = (planner as any).guidanceFor(
      { workflow: 'animated-visual-comedy' },
      'short-drama-video-prompts',
    );

    expect(guidance).toContain('# 动漫视觉喜剧');
    expect(guidance).toContain('全程无对白');
  });

  it('develops a story and reviews it with the selected story method', async () => {
    const story = {
      title: '采莲',
      synopsis: '两人采莲',
      story: '两人相互帮助，采完莲蓬归家。',
      sourceBasis: ['荷叶罗裙一色裁'],
      creativeAdditions: ['两人一起采莲'],
      storyArc: {
        goal: '采莲',
        obstacle: '船晃',
        action: '扶稳船',
        result: '采到莲蓬',
        change: '两人更加默契',
      },
      visualStyle: '真人',
      ratio: '9:16',
    };
    const review = {
      issues: [
        {
          severity: 'suggestion',
          category: 'character',
          evidence: '两人相互帮助',
          problem: '互动还不够具体',
          suggestion: '写出谁先伸手',
        },
      ],
    };
    const messages: string[] = [];
    let calls = 0;
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        streamEvents: async (input: any[]) => {
          messages.push(input.map((item) => String(item.content)).join('\n'));
          return (async function* () {
            yield { event: 'on_chain_end', data: { output: story } };
          })();
        },
        invoke: async (input: any[]) => {
          messages.push(input.map((item) => String(item.content)).join('\n'));
          calls += 1;
          return review;
        },
      }),
    });

    const source = '【创作模式：古诗词真人微剧情】王昌龄《采莲曲》';
    await expect(planner.story(source)).resolves.toEqual(story);
    await expect(planner.reviewStory(source, story)).resolves.toEqual(review);
    expect(calls).toBe(1);
    expect(messages[0]).toContain('生活化改编与导演规则');
    expect(messages[1]).toContain('只有与已给事实冲突');
  });

  it('streams partial structured output and returns the validated script', async () => {
    const scriptPlan = {
      entryState: '小林拿着信来到天台',
      goal: '小林想确认收信人',
      opposition: '同事拒绝回答并阻止他离开',
      payoff: '小林发现信件真正收件人',
      exitState: '小林拿走信件并决定下楼',
      beats: [
        {
          cause: '信件署名与同事说法矛盾',
          action: '小林当面展开信件核对',
          result: '同事无法再隐瞒收件人',
          nextPressure: '小林必须决定是否带着证据离开',
        },
      ],
      scenes: [
        {
          id: 'scene-1',
          title: '天台对质',
          location: '天台',
          objective: '小林核对信件',
          conflict: '同事试图夺走信件',
          turn: '收件人姓名被公开',
          exitState: '小林持有信件并准备离开',
        },
      ],
    };
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
      withStructuredOutput: (_schema: unknown, options: { name: string }) => {
        if (options.name === 'plan_script')
          return { invoke: async () => scriptPlan };
        if (options.name === 'review_script')
          return { invoke: async () => ({ issues: [] }) };
        return {
          stream: async function* () {
            yield { title: script.title };
            yield script;
          },
        };
      },
    });
    const onChunk = jest.fn();

    await expect(
      planner.script('一个故事', undefined, onChunk),
    ).resolves.toEqual({ ...script, scriptPlan, scriptAutoRepairCount: 0 });
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenLastCalledWith(script);
  });

  it('silently repairs blocking script issues against the same scene contract', async () => {
    const scriptPlan = {
      entryState: '小林持有信件',
      goal: '确认真相',
      opposition: '同事隐瞒',
      payoff: '收件人公开',
      exitState: '小林离开',
      beats: [{ cause: '署名矛盾', action: '核对', result: '公开', nextPressure: '离开' }],
      scenes: [{
        id: 'scene-1', title: '对质', location: '天台', objective: '核对',
        conflict: '争夺信件', turn: '公开姓名', exitState: '持有信件',
      }],
    };
    const draft = {
      title: '短片', synopsis: '梗概', story: '完整故事', visualStyle: '写实', ratio: '16:9',
      scenes: [{ id: 'scene-1', title: '对质', script: '小林反复解释信件背景。', location: '天台' }],
    };
    const repaired = {
      ...draft,
      scenes: [{ ...draft.scenes[0], script: '小林展开信件，同事伸手抢夺，收件人姓名露了出来。' }],
    };
    const writeInputs: string[] = [];
    let writes = 0;
    let reviews = 0;
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: (_schema: unknown, options: { name: string }) => {
        if (options.name === 'plan_script')
          return { invoke: async () => scriptPlan };
        if (options.name === 'review_script')
          return {
            invoke: async () => {
              reviews += 1;
              return reviews === 1
                ? { issues: [{ severity: 'blocking', category: 'adaptation', evidence: draft.scenes[0].script, problem: '重复解释且没有行动', suggestion: '让核对信件引发争夺并公开姓名' }] }
                : { issues: [] };
            },
          };
        return {
          stream: async function* (input: any[]) {
            writeInputs.push(String(input.at(-1).content));
            writes += 1;
            yield writes === 1 ? draft : repaired;
          },
        };
      },
    });

    const result = await planner.script('一个故事');

    expect(result.scenes[0].script).toBe(repaired.scenes[0].script);
    expect(result.scriptPlan).toEqual(scriptPlan);
    expect(result.scriptAutoRepairCount).toBe(1);
    expect(writes).toBe(2);
    expect(reviews).toBe(2);
    expect(writeInputs[1]).toContain('重复解释且没有行动');
    expect(writeInputs[1]).toContain('保留未涉及场景的稳定 ID');
  });

  it('passes uploaded scripts and images into requirement analysis', async () => {
    let messages: any[] = [];
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        streamEvents: async (input: any[]) => {
          messages = input;
          return (async function* () {
            yield {
              event: 'on_chain_end',
              data: {
                output: {
                  status: 'ready',
                  brief: '卡通风格剧本',
                  questions: [],
                },
              },
            };
          })();
        },
      }),
    });

    await planner.requirements('分析附件', undefined, undefined, [
      {
        name: 'script.txt',
        type: 'text/plain',
        content: Buffer.from('青蛙阻止长颈鹿喝水').toString('base64'),
      },
      { name: 'style.png', type: 'image/png', content: 'aW1hZ2U=' },
    ]);

    const content = messages.at(-1).content;
    expect(content[0].text).toContain('青蛙阻止长颈鹿喝水');
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
    });
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
      scenes: [
        {
          id: 'scene-1',
          title: '天台',
          script: '小林来到天台。',
          location: '天台',
          referencePrompt: '天台环境',
          shots: [
            {
              id: 'shot-1',
              title: '到来',
              description: '来到天台',
              movement: '推进',
              duration: 4,
              characterIds: [],
              visualPrompt: '图一',
            },
            {
              id: 'shot-2',
              title: '远眺',
              description: '望向城市',
              movement: '横移',
              duration: 4,
              characterIds: [],
              visualPrompt: '图二',
            },
          ],
        },
      ],
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        stream: async function* () {
          yield {
            scenes: [
              {
                id: 'scene-1',
                shots: [
                  { id: 'shot-1', motionPrompt: '视频一' },
                  {
                    id: 'shot-2',
                    motionPrompt: '视频二',
                    transitionFromPrevious,
                  },
                ],
              },
            ],
          };
        },
      }),
    });

    const result = await planner.videoPrompts(plan as any);
    expect(result.scenes[0].shots[0].motionPrompt).toBe('视频一');
    expect(result.scenes[0].shots[1].transitionFromPrevious).toEqual(
      transitionFromPrevious,
    );
  });

  it('merges image prompts by original order when the model rewrites ids', async () => {
    const plan = {
      title: '短片',
      synopsis: '梗概',
      story: '故事',
      visualStyle: '写实',
      ratio: '16:9',
      characters: [],
      scenes: [
        {
          id: 'scene-1',
          title: '水岸',
          script: '凝望',
          location: '水岸',
          referencePrompt: '水岸',
          shots: [
            {
              id: 'shot-1',
              title: '凝望',
              description: '凝望',
              movement: '固定',
              duration: 5,
              characterIds: [],
            },
          ],
        },
        {
          id: 'scene-2',
          title: '荷塘',
          script: '隐现',
          location: '荷塘',
          referencePrompt: '荷塘',
          shots: [
            {
              id: 'shot-2',
              title: '隐现',
              description: '隐现',
              movement: '横移',
              duration: 5,
              characterIds: [],
            },
          ],
        },
      ],
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        stream: async function* () {
          yield {
            scenes: [
              {
                id: 'scene-01',
                shots: [{ id: 'shot-01', visualPrompt: '水岸图片提示词' }],
              },
              {
                id: 'scene-02',
                shots: [{ id: 'shot-01', visualPrompt: '荷塘图片提示词' }],
              },
            ],
          };
        },
      }),
    });

    const result = await planner.imagePrompts(plan as any);

    expect(result.scenes[0].shots[0].visualPrompt).toBe('[水岸]图片提示词');
    expect(result.scenes[1].shots[0].visualPrompt).toBe('[荷塘]图片提示词');
  });

  it('falls back to shot content and direct cuts when video fields are omitted', async () => {
    const plan = {
      title: '短片',
      synopsis: '梗概',
      story: '故事',
      visualStyle: '写实',
      ratio: '16:9',
      characters: [],
      scenes: [
        {
          id: 'scene-1',
          title: '天台',
          script: '故事',
          location: '天台',
          referencePrompt: '天台',
          shots: [
            {
              id: 'shot-1',
              title: '到来',
              description: '小林来到天台',
              movement: '推进',
              duration: 5,
              characterIds: [],
              visualPrompt: '图一',
            },
            {
              id: 'shot-2',
              title: '远眺',
              description: '小林望向城市',
              movement: '横移',
              duration: 5,
              characterIds: [],
              visualPrompt: '图二',
            },
          ],
        },
      ],
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        stream: async function* () {
          yield {
            scenes: [
              { id: 'scene-1', shots: [{ id: 'shot-1' }, { id: 'shot-2' }] },
            ],
          };
        },
      }),
    });

    const result = await planner.videoPrompts(plan as any);

    expect(result.scenes[0].shots[0].motionPrompt).toContain('小林来到[天台]');
    expect(result.scenes[0].shots[0].motionPrompt).toContain(
      '画面内容及运镜：\n0:00-0:05',
    );
    expect(result.scenes[0].shots[1].transitionFromPrevious?.mode).toBe('cut');
  });

  it('keeps model durations and defaults continuity state by scene', async () => {
    const plan = {
      title: '短片',
      synopsis: '梗概',
      story: '故事',
      visualStyle: '写实',
      ratio: '16:9',
      characters: [],
      props: [],
      scenes: [
        {
          id: 'scene-1',
          title: '客舍',
          script: '读信',
          location: '客舍',
          referencePrompt: '客舍',
          shots: [],
        },
      ],
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        stream: async function* () {
          yield {
            sceneAssets: [
              {
                id: 'scene-asset-1',
                title: '客舍',
                location: '客舍',
                referencePrompt: '客舍',
              },
            ],
            scenes: [
              {
                id: 'scene-1',
                sceneAssetId: 'scene-asset-1',
                shots: [
                  {
                    id: 'shot-1',
                    title: '读信',
                    description: '展开书信。逐行阅读。合上信纸，望向窗外',
                    movement: '缓慢推进',
                    duration: 4,
                    characterIds: [],
                    propIds: [],
                  },
                ],
              },
            ],
          };
        },
      }),
    });

    const result = await planner.storyboard(plan);

    expect(result.scenes[0].shots[0].duration).toBe(4);
    expect(result.scenes[0].shots[0].continuityGroupId).toBe('scene-1');
    expect(result.scenes[0].shots[0].startState).toContain('展开书信');
  });

  it('rejects fragmented storyboards that exceed the target duration or shot budget', async () => {
    const plan = {
      title: '短片',
      synopsis: '梗概',
      story: '故事',
      visualStyle: '写实',
      ratio: '16:9',
      targetDuration: 30,
      characters: [],
      props: [],
      scenes: [
        {
          id: 'scene-1',
          title: '荷塘',
          script: '采莲',
          location: '荷塘',
          referencePrompt: '荷塘',
          shots: [],
        },
      ],
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        stream: async function* () {
          yield {
            sceneAssets: [
              {
                id: 'scene-asset-1',
                title: '荷塘',
                location: '荷塘',
                referencePrompt: '荷塘',
              },
            ],
            scenes: [
              {
                id: 'scene-1',
                sceneAssetId: 'scene-asset-1',
                shots: Array.from({ length: 7 }, (_, index) => ({
                  id: `shot-${index + 1}`,
                  title: `重复${index + 1}`,
                  description: '重复采莲动作',
                  movement: '固定',
                  duration: 4,
                  characterIds: [],
                  propIds: [],
                })),
              },
            ],
          };
        },
      }),
    });

    await expect(planner.storyboard(plan)).rejects.toThrow(
      '目标 30 秒，当前 7 镜、28 秒',
    );
  });

  it('allows scenes without an independent narrative shot', async () => {
    const plan = {
      title: '短片',
      synopsis: '梗概',
      story: '故事',
      visualStyle: '写实',
      ratio: '16:9',
      characters: [],
      props: [],
      scenes: [
        {
          id: 'scene-1',
          title: '荷塘',
          script: '采莲后回家',
          location: '荷塘',
          referencePrompt: '荷塘',
          shots: [],
        },
        {
          id: 'scene-2',
          title: '归途',
          script: '同一动作继续',
          location: '归途',
          referencePrompt: '归途',
          shots: [],
        },
      ],
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        stream: async function* () {
          yield {
            sceneAssets: [
              {
                id: 'scene-asset-1',
                title: '荷塘',
                location: '荷塘',
                referencePrompt: '荷塘',
              },
              {
                id: 'scene-asset-2',
                title: '归途',
                location: '归途',
                referencePrompt: '归途',
              },
            ],
            scenes: [
              {
                id: 'scene-1',
                sceneAssetId: 'scene-asset-1',
                shots: [
                  {
                    id: 'shot-1',
                    title: '采满归家',
                    narrativeBeat: '采满莲蓬后共同归家',
                    description: '两人采满后摇船回家',
                    movement: '跟拍',
                    duration: 8,
                    characterIds: [],
                    propIds: [],
                  },
                ],
              },
              { id: 'scene-2', sceneAssetId: 'scene-asset-2' },
            ],
          };
        },
      }),
    });
    const result = await planner.storyboard(plan);
    expect(result.scenes[0].shots).toHaveLength(1);
    expect(result.scenes[1].shots).toHaveLength(0);
  });

  it('normalizes duplicate shot ids and entity names returned by the model', async () => {
    const plan = {
      title: '短片',
      synopsis: '梗概',
      story: '故事',
      visualStyle: '写实',
      ratio: '16:9',
      characters: [
        {
          id: 'character-1',
          name: '王昌龄',
          description: '诗人',
          referencePrompt: '角色图',
        },
      ],
      props: [
        {
          id: 'prop-1',
          name: '竹篓',
          description: '竹编',
          referencePrompt: '道具图',
        },
      ],
      scenes: [
        {
          id: 'scene-1',
          title: '水岸',
          script: '王昌龄凝望荷塘',
          location: '水岸',
          referencePrompt: '水岸',
          shots: [],
        },
        {
          id: 'scene-2',
          title: '荷塘',
          script: '竹篓若隐若现',
          location: '荷塘',
          referencePrompt: '荷塘',
          shots: [],
        },
      ],
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        stream: async function* () {
          yield {
            sceneAssets: [
              {
                id: 'scene-asset-1',
                title: '水岸',
                location: '水岸',
                referencePrompt: '水岸空镜',
              },
              {
                id: 'scene-asset-2',
                title: '荷塘',
                location: '荷塘',
                referencePrompt: '荷塘空镜',
              },
            ],
            scenes: [
              {
                id: 'scene-1',
                sceneAssetId: 'scene-asset-1',
                shots: [
                  {
                    id: 'shot-1',
                    title: '凝望',
                    description: '王昌龄望向荷塘',
                    movement: '固定',
                    duration: 5,
                    characterIds: ['王昌龄'],
                    propIds: [],
                  },
                ],
              },
              {
                id: 'scene-2',
                sceneAssetId: 'scene-asset-2',
                shots: [
                  {
                    id: 'shot-1',
                    title: '隐现',
                    description: '竹篓在荷叶间隐现',
                    movement: '横移',
                    duration: 5,
                    characterIds: [],
                    propIds: ['竹篓'],
                  },
                ],
              },
            ],
          };
        },
      }),
    });

    const result = await planner.storyboard(plan);

    expect(result.scenes[0].shots[0].id).toBe('shot-1');
    expect(result.scenes[1].shots[0].id).toBe('shot-2');
    expect(result.scenes[0].shots[0].characterIds).toEqual(['character-1']);
    expect(result.scenes[1].shots[0].propIds).toEqual(['prop-1']);
  });

  it.each(['single-protagonist', 'rivalry'])(
    'accepts a complete %s comedy story',
    async (mode) => {
      const story = {
        workflow: 'animated-visual-comedy',
        targetDuration: 45,
        title: '最后一块松饼',
        synopsis: '争夺松饼',
        story: '河狸与长脚鹬争夺松饼，结尾松饼落入河狸嘴里。',
        sourceBasis: ['用户要求无对白动漫喜剧'],
        creativeAdditions: ['自动餐车'],
        storyArc: {
          goal: '吃到松饼',
          obstacle: '对手阻拦',
          action: '利用餐车反击',
          result: '控制权多次互换',
          change: '河狸最终吃到松饼',
        },
        visualStyle: '三维动画',
        ratio: '16:9',
        comedyDesign: { ...comedyDesign, mode },
      };
      const planner = new ProductionPlanner({} as any);
      (planner as any).model = jest.fn().mockResolvedValue({
        stream: async () =>
          (async function* () {
            yield { text: JSON.stringify(story) };
          })(),
      });

      await expect(
        planner.story('【创作模式：动漫视觉喜剧】45秒无对白短片'),
      ).resolves.toEqual(story);
    },
  );

  it('streams and validates plain JSON for a comedy story', async () => {
    const story = {
      workflow: 'animated-visual-comedy',
      targetDuration: 45,
      title: '最后一块松饼',
      synopsis: '争夺松饼',
      story: '河狸与长脚鹬争夺松饼。',
      sourceBasis: ['用户要求无对白动漫喜剧'],
      creativeAdditions: ['自动餐车'],
      storyArc: {
        goal: '吃到松饼',
        obstacle: '对手阻拦',
        action: '利用餐车反击',
        result: '控制权互换',
        change: '河狸吃到松饼',
      },
      visualStyle: '三维动画',
      ratio: '16:9',
      comedyDesign,
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      stream: async () =>
        (async function* () {
          const json = JSON.stringify(story);
          yield { text: json.slice(0, 100) };
          yield { text: json.slice(100) };
        })(),
    });

    await expect(
      planner.story('【创作模式：动漫视觉喜剧】45秒无对白短片'),
    ).resolves.toEqual(story);
  });

  it('repairs malformed comedy JSON once with the schema errors', async () => {
    const story = {
      workflow: 'animated-visual-comedy',
      targetDuration: 45,
      title: '最后一块松饼',
      synopsis: '争夺松饼',
      story: '河狸与长脚鹬争夺松饼。',
      sourceBasis: ['用户要求无对白动漫喜剧'],
      creativeAdditions: ['自动餐车'],
      storyArc: {
        goal: '吃到松饼',
        obstacle: '对手阻拦',
        action: '利用餐车反击',
        result: '控制权互换',
        change: '河狸吃到松饼',
      },
      visualStyle: '三维动画',
      ratio: '16:9',
      comedyDesign,
    };
    const malformed = {
      ...story,
      sourceBasis: story.sourceBasis[0],
      storyArc: {},
      comedyDesign: {
        ...comedyDesign,
        candidates: [
          { id: 'candidate-1', mode: 'single-character' },
          ...comedyDesign.candidates.slice(1),
        ],
      },
    };
    const invoke = jest
      .fn()
      .mockResolvedValue({ content: JSON.stringify(story) });
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      stream: async () =>
        (async function* () {
          yield { text: JSON.stringify(malformed) };
        })(),
      invoke,
    });

    await expect(
      planner.story('【创作模式：动漫视觉喜剧】45秒无对白短片'),
    ).resolves.toEqual(story);
    expect(invoke).toHaveBeenCalledTimes(1);
    const repairMessages = invoke.mock.calls[0][0];
    expect(repairMessages.at(-1).content).toContain('sourceBasis');
    expect(repairMessages.at(-1).content).toContain('storyArc');
    expect(repairMessages.at(-1).content).toContain(JSON.stringify(malformed));
  });

  it('rejects a comedy story that substitutes escalation for real reversals', async () => {
    const planner = new ProductionPlanner({} as any);

    expect(() =>
      (planner as any).validateComedyStory({
        workflow: 'animated-visual-comedy',
        targetDuration: 45,
        comedyDesign: {
          ...comedyDesign,
          reversals: [comedyDesign.reversals[0]],
        },
      }),
    ).toThrow('至少需要 2 次有效局势反转');
    expect(() =>
      (planner as any).validateComedyStory({
        workflow: 'animated-visual-comedy',
        targetDuration: 45,
        comedyDesign: {
          ...comedyDesign,
          reversals: comedyDesign.reversals.map((item) => ({
            ...item,
            reversal: item.expectation,
          })),
        },
      }),
    ).toThrow('必须有独立的预期证据');
    expect(() =>
      (planner as any).validateComedyStory({
        workflow: 'animated-visual-comedy',
        targetDuration: 45,
        comedyDesign: {
          ...comedyDesign,
          reversals: comedyDesign.reversals.map((item) => ({
            ...item,
            origin: 'accident',
          })),
        },
      }),
    ).toThrow('至少需要一次由角色主动策略造成的反转');
    expect(() =>
      (planner as any).validateComedyStory({
        workflow: 'animated-visual-comedy',
        targetDuration: 45,
        comedyDesign: {
          ...comedyDesign,
          selectedCandidateId: 'candidate-missing',
        },
      }),
    ).toThrow('从三个候选方案中明确选择最强方案');
    expect(() =>
      (planner as any).validateComedyStory({
        workflow: 'animated-visual-comedy',
        targetDuration: 45,
        comedyDesign: {
          ...comedyDesign,
          reversals: [...comedyDesign.reversals, comedyDesign.reversals[0]],
        },
      }),
    ).toThrow('最多容纳 2 次主要反转');
  });

  it('uses a dedicated comedy review instead of accepting structural fields alone', async () => {
    const messages: string[] = [];
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        invoke: async (input: any[]) => {
          messages.push(...input.map((item) => String(item.content)));
          return {
            comedyChecks: passingComedyChecks,
            comedyScore: passingComedyScore,
            issues: [
              {
                severity: 'blocking',
                category: 'causality',
                evidence: '结尾首次提到回弹',
                problem: '回敬规则铺垫过迟',
                suggestion: '开场先展示回弹',
              },
            ],
          };
        },
      }),
    });

    const review = await planner.reviewStory(
      '【创作模式：动漫视觉喜剧】无对白短片',
      { comedyDesign },
    );

    expect(messages[1]).toContain('不因字段齐全就判定合格');
    expect(messages[1]).toContain('前三分之一已经展示');
    expect(review.issues[0].severity).toBe('blocking');
  });

  it('requires comedy scores and checks in the structured review schema', async () => {
    let schema: any;
    const review = {
      issues: [],
      comedyChecks: [
        {
          target: 'hook',
          category: 'hook',
          passed: true,
          evidence: '开场截走松饼',
          problem: '',
        },
        {
          target: 'reversal-1',
          category: 'expectation',
          passed: true,
          evidence: '拉杆反向弹射',
          problem: '',
        },
        {
          target: 'reversal-2',
          category: 'expectation',
          passed: true,
          evidence: '灌木回弹换位',
          problem: '',
        },
        {
          target: 'callback',
          category: 'callback',
          passed: true,
          evidence: '托盘合拢回敬',
          problem: '',
        },
        {
          target: 'physics',
          category: 'physics',
          passed: true,
          evidence: '轨迹连续',
          problem: '',
        },
        {
          target: 'pacing',
          category: 'pacing',
          passed: true,
          evidence: '预算匹配',
          problem: '',
        },
      ],
      comedyScore: {
        overall: 9,
        hook: 9,
        agency: 9,
        surprise: 9,
        causality: 9,
        callback: 9,
        pacing: 9,
        physics: 9,
      },
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: (value: any) => {
        schema = value;
        return { invoke: async () => review };
      },
    });

    await planner.reviewStory('【创作模式：动漫视觉喜剧】', {
      comedyDesign: { reversals: [{}, {}] },
    });
    expect(schema.shape.comedyScore.isOptional()).toBe(false);
    expect(schema.shape.comedyChecks.isOptional()).toBe(false);
  });

  it('falls back to plain JSON when the provider drops a comedy tool call', async () => {
    const review = {
      issues: [],
      comedyChecks: Array.from({ length: 6 }, (_, index) => ({
        target: `check-${index}`,
        category: 'physics',
        passed: true,
        evidence: '证据',
        problem: '',
      })),
      comedyScore: {
        overall: 6,
        hook: 7,
        agency: 7,
        surprise: 6,
        causality: 6,
        callback: 6,
        pacing: 7,
        physics: 5,
      },
    };
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({ invoke: async () => undefined }),
      invoke: async () => ({
        content: `\`\`\`json\n${JSON.stringify(review)}\n\`\`\``,
      }),
    });

    const result = await planner.reviewStory('【创作模式：动漫视觉喜剧】', {
      comedyDesign: { reversals: [{}, {}] },
    });
    expect(result.comedyScore?.overall).toBe(6);
    expect(
      result.issues.some((issue) => issue.problem.includes('综合评分低于 9')),
    ).toBe(true);
  });

  it('turns failed physics checks into blocking issues even when the reviewer returns no issues', async () => {
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        invoke: async () => ({
          comedyChecks: passingComedyChecks.map((check) =>
            check.category === 'physics'
              ? {
                  ...check,
                  passed: false,
                  evidence: '山羊用嘴接住半人高纽扣',
                  problem: '物体尺寸和搬运方式不可信',
                }
              : check,
          ),
          comedyScore: passingComedyScore,
          issues: [],
        }),
      }),
    });

    const review = await planner.reviewStory(
      '【创作模式：动漫视觉喜剧】无对白短片',
      { comedyDesign },
    );

    expect(review.issues).toHaveLength(1);
    expect(review.issues[0]).toEqual(
      expect.objectContaining({
        severity: 'blocking',
        category: 'continuity',
        problem: '物体尺寸和搬运方式不可信',
      }),
    );
  });

  it('blocks comedy scores below the production quality bar', async () => {
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        invoke: async () => ({
          comedyChecks: passingComedyChecks,
          comedyScore: { ...passingComedyScore, overall: 8.7, pacing: 7 },
          issues: [],
        }),
      }),
    });

    const review = await planner.reviewStory(
      '【创作模式：动漫视觉喜剧】无对白短片',
      { comedyDesign },
    );

    expect(review.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          problem: '动漫喜剧综合评分低于 9，尚不能进入分镜',
        }),
        expect.objectContaining({
          problem: '动漫喜剧 pacing 维度低于 8，存在明显短板',
        }),
      ]),
    );
  });

  it('accepts storyboards that visualize the hook, reversals, and callback', async () => {
    const planner = new ProductionPlanner({} as any);
    (planner as any).model = jest.fn().mockResolvedValue({
      withStructuredOutput: () => ({
        stream: async function* () {
          yield comedyStoryboardResult([
            'hook',
            'reversal',
            'reversal',
            'escalation',
            'callback',
          ]);
        },
      }),
    });

    const result = await planner.storyboard(comedyStoryboardPlan);

    expect(result.scenes[0].shots.map((shot) => shot.comedyRole)).toEqual([
      'hook',
      'reversal',
      'reversal',
      'escalation',
      'callback',
    ]);
  });

  it.each([
    {
      roles: ['setup', 'reversal', 'reversal', 'escalation', 'callback'],
      error: '第一镜必须直接呈现视觉钩子',
    },
    {
      roles: ['hook', 'reversal', 'escalation', 'reaction', 'callback'],
      error: '至少需要 2 个有效反转镜头',
    },
    {
      roles: ['hook', 'reversal', 'reversal', 'escalation', 'reaction'],
      error: '最后一镜必须复用前文线索完成结尾回敬',
    },
  ])(
    'rejects incomplete comedy storyboards: $error',
    async ({ roles, error }) => {
      const planner = new ProductionPlanner({} as any);
      (planner as any).model = jest.fn().mockResolvedValue({
        withStructuredOutput: () => ({
          stream: async function* () {
            yield comedyStoryboardResult(roles);
          },
        }),
      });

      await expect(planner.storyboard(comedyStoryboardPlan)).rejects.toThrow(
        error,
      );
    },
  );
});
