import { createChatModel } from '@/common/llm';
import { genImage } from '@/common/llm/tools/gen-image';
import { ChunkStatus, StreamEvent } from '@/common/utils/ai-stream-utils';
import { AsyncQueue } from '@/common/utils/async-queue';
import { SSE_EVENT, SSE_ROLE } from '@/common/utils/stream-constants';

import { Injectable } from '@nestjs/common';
import { ContentBlock, HumanMessage } from 'langchain';
import { StreamDto } from './dto/stream.dto';
import { ChatDto } from './dto/chat.dto';
import { textScenePrompt } from '@/common/llm/prompts/text-scene';
import { genVideo, queryVideoTask } from '@/common/llm/tools/gen-video';
import {
  decomposeVisualDescription,
  designStoryboard,
  extractCharacters,
  genFramePrompt,
  genTurnaroundPrompt,
  imagePrompt,
  optimizeScene,
  serializeStoryboardRow,
  story,
  TShotBriefDescription,
  writeScriptBasedOnStory,
} from 'agents';
import { ModelsService } from '../models/models.service';
import { genAudio } from '@/common/llm/tools/gen-audio';

@Injectable()
export class PipelineService {
  constructor(private readonly models: ModelsService) {}

  // 会话：使用前端模型配置中选中的文本模型流式输出
  async *chat(
    { modelId, scene, messages }: ChatDto,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const model = await this.models.runtime(modelId, 'text');
    const params = JSON.parse(model.params);
    const llm = createChatModel(model, {
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      streaming: true,
    });

    yield { type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT };
    try {
      const stream = await llm.stream(
        [{ role: 'system', content: textScenePrompt(scene) }, ...messages],
        { signal },
      );
      for await (const chunk of stream) {
        // 只输出正文，思考过程（reasoning_content）不下发
        if (chunk.text) {
          yield { type: SSE_EVENT.MSG_CHUNK, content: chunk.text };
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Chat stream error:', err);
      yield {
        type: SSE_EVENT.MSG_ERROR,
        error: err instanceof Error ? err.message : String(err),
      };
      return;
    }
    yield { type: SSE_EVENT.MSG_END };
  }

  async *text({ message, textList }: StreamDto) {
    const model = await this.models.runtime(undefined, 'text');
    const senModel = createChatModel(model);
    const messages = [
      new HumanMessage({
        content: message as ContentBlock.Text[],
      }),
    ];
    if (textList) {
      textList.forEach((item) => {
        messages.push(
          new HumanMessage({
            content: [{ type: 'text', text: item.action_input }],
          }),
        );
      });
    }
    const queue = new AsyncQueue<StreamEvent>();
    queue.push({ type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT });
    const response = await senModel.invoke([...imagePrompt(), ...messages], {
      response_format: { type: 'text' },
    });
    queue.push({ type: SSE_EVENT.MSG_CHUNK, content: response.text });
    queue.push({ type: SSE_EVENT.MSG_END });

    yield* queue.generator();
  }

  async *image(messages: StreamDto) {
    const model = await this.models.runtime(messages.modelId, 'image');
    const queue = new AsyncQueue<StreamEvent>();
    queue.push({ type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT });
    queue.push({
      type: SSE_EVENT.MSG_CHUNK,
      content: {
        status: ChunkStatus.PROCESSING,
        url: null,
      },
    });
    try {
      const { content } = await genImage({ ...messages, runtimeModel: model });
      queue.push({
        type: SSE_EVENT.MSG_CHUNK,
        content: {
          status: ChunkStatus.SUCCESS,
          url: content[0].image,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      queue.push({
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.FAILED, url: null },
      });
      queue.push({ type: SSE_EVENT.MSG_ERROR, error: message });
    }
    queue.push({ type: SSE_EVENT.MSG_END });

    yield* queue.generator();
  }

  async *video(messages: StreamDto) {
    const model = await this.models.runtime(messages.modelId, 'video');
    yield { type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT };
    yield {
      type: SSE_EVENT.MSG_CHUNK,
      content: { status: ChunkStatus.PROCESSING, url: null },
    };
    try {
      const taskInfo = await genVideo({ ...messages, runtimeModel: model });
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 15_000));
        const { output } = await queryVideoTask(taskInfo.task_id, model);
        console.log('查询任务状态', output);
        if (output?.task_status === 'SUCCEEDED') {
          yield {
            type: SSE_EVENT.MSG_CHUNK,
            content: { status: ChunkStatus.SUCCESS, url: output.video_url },
          };
          break;
        }
        if (output?.task_status === 'FAILED') {
          throw new Error(output.message || '视频生成任务失败');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.FAILED, url: null },
      };
      yield { type: SSE_EVENT.MSG_ERROR, error: message };
    }
    yield { type: SSE_EVENT.MSG_END };
  }

  async *audio(messages: StreamDto) {
    const model = await this.models.runtime(messages.modelId, 'audio');
    yield { type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT };
    yield {
      type: SSE_EVENT.MSG_CHUNK,
      content: { status: ChunkStatus.PROCESSING, url: null },
    };
    try {
      const url = await genAudio({ ...messages, runtimeModel: model });
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.SUCCESS, url },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.FAILED, url: null },
      };
      yield { type: SSE_EVENT.MSG_ERROR, error: message };
    }
    yield { type: SSE_EVENT.MSG_END };
  }

  async *story({ message }: StreamDto) {
    const model = await this.models.runtime(undefined, 'text');
    const senModel = createChatModel(model);
    const queue = new AsyncQueue<StreamEvent>();
    queue.push({ type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT });
    queue.push({
      type: SSE_EVENT.MSG_CHUNK,
      content: { status: ChunkStatus.PROCESSING, url: null },
    });

    const idea = message[0].text;

    // 1. 生成故事
    const { text } = await story(senModel, idea);
    queue.push({ type: SSE_EVENT.MSG_CHUNK, content: text });

    // 2. 按场景拆分剧本
    const { script } = await writeScriptBasedOnStory(senModel, text);

    for (let s = 0; s < script.length; s++) {
      // 3a. 场景润色
      const { enhancedScript } = await optimizeScene(senModel, script[s]);

      console.log('enhancedScript', enhancedScript);

      //   // 3b. 角色提取
      //   const { characters } = await extractCharacters(senModel, enhancedScript);

      //   // 3c. 角色三视图生成（可选，只生成 prompt）
      //   for (const character of characters) {
      //     const rolePrompt = genTurnaroundPrompt(character, '真实');
      //     const { actionInput } = await genFramePrompt(senModel, rolePrompt);
      //   }

      //   // 3d. 生成分镜
      //   const storyboard = await designStoryboard(
      //     senModel,
      //     enhancedScript,
      //     characters,
      //   );

      //   // 3e. 逐个镜头拆解 + 输出
      //   for (let i = 0; i < storyboard.storyboard.length; i++) {
      //     const shot = storyboard.storyboard[i] as TShotBriefDescription;
      //     const decomposed = await decomposeVisualDescription(
      //       senModel,
      //       shot,
      //       characters,
      //     );

      //     // const row = serializeStoryboardRow(
      //     //   shot,
      //     //   i,
      //     //   characters,
      //     //   decomposed.visualPrompt,
      //     //   decomposed.motionVideoPrompt,
      //     // );

      //     console.log(`场景${i}:`, decomposed);

      //     // 逐条流式输出镜头数据
      //     queue.push({
      //       type: SSE_EVENT.MSG_CHUNK,
      //       content: JSON.stringify(decomposed),
      //     });
      //   }
    }

    queue.push({ type: SSE_EVENT.MSG_END });
    yield* queue.generator();
  }
}
