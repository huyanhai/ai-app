# LLM Agents 详细说明

> 路径: `app/backend/src/common/llm/agents/`
>
> 这些 Agent 构建了一个**从小说到分镜剧本**的完整影视化流水线，基于 LangChain + ChatOpenAI，使用结构化输出（Structured Output / JSON Mode）。

---

## 流水线总览

```
小说原文
   │
   ▼
┌─────────────────────┐
│  NovelCompressor    │  ← 长篇压缩（可选）
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  EventExtractor     │  ← 提取剧情事件
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  SceneExtractor     │  ← 事件 → 剧本场景
└─────────┬───────────┘
          │
          ├─────────────────────────────────────┐
          ▼                                     ▼
┌─────────────────────┐             ┌──────────────────────┐
│  CharacterExtractor │             │  GlobalInfoPlanner   │
│  (单场景角色提取)    │             │  (跨场景角色融合)     │
└─────────┬───────────┘             └──────────┬───────────┘
          │                                     │
          ▼                                     │
┌─────────────────────┐                        │
│  ScriptPlanner      │  ← 剧本规划（叙/动/蒙） │
└─────────┬───────────┘                        │
          │                                     │
          ▼                                     │
┌─────────────────────┐                        │
│  ScriptEnhancer     │  ← 剧本润色             │
└─────────┬───────────┘                        │
          │                                     │
          ▼                                     ▼
┌─────────────────────┐             ┌──────────────────────┐
│  StoryboardArtist   │  ← 分镜设计  │  ReferenceImageSel   │
│  (分镜 + 镜头拆解)   │             │  (参考图选择)         │
└─────────┬───────────┘             └──────────┬───────────┘
          │                                     │
          ▼                                     ▼
┌─────────────────────┐             ┌──────────────────────┐
│  CameraImageGen     │  ← 构建摄影机树             │
└─────────┬───────────┘             │  BestImageSelector   │
          │                          │  (最佳候选图选择)     │
          ▼                          └──────────────────────┘
┌─────────────────────┐
│  CharPortraitsGen   │  ← 角色三视图 Prompt 生成
└─────────────────────┘
```

---

## 各 Agent 详细说明

### 1. NovelCompressor — 小说压缩

| 项目 | 说明 |
|------|------|
| **文件** | `novel-compressor.ts` |
| **职责** | 将长篇小说压缩为精简版本，保留核心情节、关键对话和情感张力 |
| **核心能力** | `split()`: 按字符数分块（默认 64K, overlap 8K）；`compress()`: 对每块独立压缩，支持并发；`aggregate()`: 合并压缩后的块，消除重叠部分的冗余 |
| **上下游** | 上游: 原始小说文本；下游: EventExtractor |
| **适用场景** | 当小说超出 LLM 上下文窗口时，先压缩再继续后续流程 |

### 2. EventExtractor — 事件提取

| 项目 | 说明 |
|------|------|
| **文件** | `event-extractor.ts` |
| **职责** | 按顺序提取小说中的关键情节事件（Event），每个事件包含描述和过程链 |
| **核心能力** | `extractEvents()`: 循环调用 LLM，直到提取到最后一个事件（`is_last === true`）；`extractNextEvent()`: 单步提取下一个事件，基于已提取事件列表避免重复 |
| **输出模型** | `Event`: `{ index, is_last, description, process_chain[] }` |
| **设计要点** | 每一步都校验 `event.index` 是否递增，确保顺序正确 |

### 3. SceneExtractor — 场景提取

| 项目 | 说明 |
|------|------|
| **文件** | `scene-extractor.ts` |
| **职责** | 将一个 Event 转化为具体的剧本场景（Scene），参考上下文片段和之前已生成的场景 |
| **核心能力** | `getNextScene()`: 输入事件描述、相关上下文块、前序场景列表，输出单个场景 |
| **输出模型** | `Scene`: `{ idx, is_last, environment (slugline + description), characters[], script }` |
| **约束** | 同一个事件最多拆 5 个场景；位置或时间变化时必须切新场景 |

### 4. CharacterExtractor — 角色提取

| 项目 | 说明 |
|------|------|
| **文件** | `character-extractor.ts` |
| **职责** | 从单个剧本场景的文本中提取所有角色信息，区分静态特征和动态特征 |
| **输出模型** | `CharacterInScene`: `{ idx, identifier_in_scene, is_visible, static_features, dynamic_features }` |
| **设计要点** | 静态特征指外貌、体型等不变特征；动态特征指服装、配饰、随身物品等可变特征。同名角色自动合并 |

### 5. GlobalInformationPlanner — 全局信息规划

| 项目 | 说明 |
|------|------|
| **文件** | `global-information-planner.ts` |
| **职责** | 跨场景、跨事件融合角色信息，维护全局一致性 |
| **核心能力** | `mergeCharactersAcrossScenesInEvent()`: 将一个 Event 内多个 Scene 中的角色合并，识别跨场景的同一角色；`mergeCharactersToExistingCharactersInNovel()`: 将当前 Event 的角色合并到整部小说的全局角色列表中 |
| **设计要点** | 输出校验：每个合并后的角色必须能在原始场景中找到对应；角色 ID 全局唯一 |

### 6. ScriptPlanner — 剧本规划

| 项目 | 说明 |
|------|------|
| **文件** | `script-planner.ts` |
| **职责** | 将基本故事创意扩展为完整的剧本草案；包含 **意图路由** 机制 |
| **核心能力** | `planScript()`: 先通过 Intent Router 判断用户意图——**narrative**（叙事，侧重角色/剧情/对话）、**motion**（动作，侧重速度/战斗/追逐）、**montage**（蒙太奇，侧重情绪/意象拼接），然后选择对应 Prompt 模版生成剧本 |
| **输出模型** | `PlannedScript`: `{ planned_script: string }` |
| **约束** | 禁止使用比喻/隐喻；禁止写摄影机运动指令；narrative 类型使用"Name: Dialogue"格式而非旁白 |

### 7. ScriptEnhancer — 剧本润色

| 项目 | 说明 |
|------|------|
| **文件** | `script-enhancer.ts` |
| **职责** | 对规划好的剧本进行精细化润色，增强感官细节、连贯性和对话自然度 |
| **核心能力** | `enhanceScript()`: 添加具体的灯光/纹理/声音/天气细节；确保角色名、关系、地点跨场景一致；优化对话使其更简洁且贴合角色 |
| **约束** | 不改变情节、结构和场景顺序；不新增或删除场景；禁止摄影机术语和比喻 |

### 8. StoryboardArtist — 分镜师

| 项目 | 说明 |
|------|------|
| **文件** | `storyboard-artist.ts` |
| **职责** | 将剧本场景拆解为逐镜头（Shot）的可视化描述，并对每个镜头做"首帧→末帧→运动"的拆解 |
| **核心能力** | `designStoryboard()`: 输入场景脚本和角色列表，输出完整的镜头序列（镜头类型、视觉描述、音频描述）；`decomposeVisualDescription()`: 将镜头的视觉描述拆解为**首帧画面 (ff_desc)**、**末帧画面 (lf_desc)**、**运动描述 (motion_desc)**、**变化类型 (large / medium / small)** |
| **设计要点** | 角色名在视觉描述中用 `< >` 括起（如 `<Alice>`），对话和讲话者字段不用；每个镜头最多给每个角色一句台词 |

### 9. ReferenceImageSelector — 参考图选择

| 项目 | 说明 |
|------|------|
| **文件** | `reference-image-selector.ts` |
| **职责** | 从已有的参考图库中，智能选择最合适的 1-8 张作为下一帧图像生成的参考，保证角色/环境/风格一致性 |
| **核心能力** | `selectReferenceImagesAndGeneratePrompt()`: 两阶段过滤——先用纯文本模型初筛（当候选图 >= 8 时），再用多模态模型精筛；最终输出选中图片路径 + 综合 Text Prompt |
| **设计要点** | 更近期的图优先级更高；新角色出现时优先选择其肖像；最多选 8 张 |

### 10. BestImageSelector — 最佳图选择

| 项目 | 说明 |
|------|------|
| **文件** | `best-image-selector.ts` |
| **职责** | 从多张候选生成图中，基于参考图和目标描述，选出角色一致性、空间一致性和描述准确性最佳的一张 |
| **核心能力** | `select()`: 多模态评估，优先角色一致性 → 空间一致性 → 文本描述匹配；偏好无白边/黑边的干净图片 |

### 11. CameraImageGenerator — 摄影机 / 镜头树构建

| 项目 | 说明 |
|------|------|
| **文件** | `camera-image-generator.ts` |
| **职责** | 构建多机位拍摄的"摄影机树"（Parent-Child 层级关系），用于确定镜头覆盖关系 |
| **核心能力** | `constructCameraTree()`: 分析各机位的镜头内容，构建树结构——父机位内容覆盖子机位；`generateTransitionPrompt()`: 生成两个镜头间的转场描述 |
| **输出模型** | `Camera`: 包含 `parent_cam_idx`, `parent_shot_idx`, `reason`, `is_parent_fully_covers_child`, `missing_info` |
| **设计要点** | 第一台摄影机必须为树根；内容包含关系决定父子层级；镜头大小越大的机位越适合做父节点 |

### 12. CharacterPortraitsGenerator — 角色三视图 Prompt 生成

| 项目 | 说明 |
|------|------|
| **文件** | `character-portraits-generator.ts` |
| **职责** | 生成角色正面/侧面/背面三视图的图像生成 Prompt |
| **核心能力** | `generateFrontPrompt()`: 全身正面，纯白背景，居中站立，自然表情；`generateSidePrompt()`: 左侧面视图；`generateBackPrompt()`: 背面视图（不显示面部） |
| **设计要点** | 不直接调用图像生成模型，只生成 Prompt 字串 |

### 13. gen-image (SubAgent) — 图片生成代理

| 项目 | 说明 |
|------|------|
| **文件** | `gen-image.ts` |
| **职责** | 基于 DeepAgents 框架的图片生成 SubAgent |
| **描述** | 名称"图片生成"，根据用户描述生成图片，底层使用 `imageMode` 模型和 `genImageTools` |

### 14. read-image (SubAgent) — 图片识别代理

| 项目 | 说明 |
|------|------|
| **文件** | `read-image.ts` |
| **职责** | 基于 DeepAgents 框架的图片内容识别 SubAgent |
| **描述** | 名称"图片内容识别"，识别用户上传图片的内容，底层使用 `senModel` |

---

## 技术架构

- **LangChain** (`@langchain/openai`, `@langchain/core/messages`): 消息构建与模型调用
- **Zod Schema**: 结构化输出定义，配合 `withStructuredOutput()` 使用 `functionCalling` 或 `jsonMode`
- **ChatOpenAI**: 统一使用 OpenAI 兼容的 Chat 模型
- **DeepAgents**: `gen-image` 和 `read-image` 基于 DeepAgents 框架的 SubAgent 机制

### 两种结构化输出方式

1. **functionCalling**: 通过 Tool Calling 机制返回结构化 JSON（如 ScriptPlanner, CharacterExtractor）
2. **jsonMode**: 强制模型输出 JSON（如 Screenwriter `writeScriptBasedOnStory`, StoryboardArtist）

---

## 数据流向

```
NovelCompressor.aggregate()
  → EventExtractor.extractEvents()
    → (每步) SceneExtractor.getNextScene()
      → CharacterExtractor.extractCharacters()
      → GlobalInformationPlanner.mergeCharactersAcrossScenesInEvent()
      → GlobalInformationPlanner.mergeCharactersToExistingCharactersInNovel()
    → ScriptPlanner.planScript()
      → ScriptEnhancer.enhanceScript()
        → StoryboardArtist.designStoryboard()
          → StoryboardArtist.decomposeVisualDescription()
            → CameraImageGenerator.constructCameraTree()
            → ReferenceImageSelector.selectReferenceImagesAndGeneratePrompt()
              → BestImageSelector.select()
```
