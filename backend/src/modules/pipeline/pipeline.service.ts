import { senModel } from '@/common/llm';
import { genImage } from '@/common/llm/tools/gen-image';
import { ChunkStatus, StreamEvent } from '@/common/utils/ai-stream-utils';
import { AsyncQueue } from '@/common/utils/async-queue';
import { SSE_EVENT, SSE_ROLE } from '@/common/utils/stream-constants';

import { Injectable } from '@nestjs/common';
import { ContentBlock, HumanMessage } from 'langchain';
import { StreamDto } from './dto/stream.dto';
import { genVideo } from '@/common/llm/tools/gen-video';
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

@Injectable()
export class PipelineService {
  async *text({ message, textList }: StreamDto) {
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
    const queue = new AsyncQueue<StreamEvent>();
    queue.push({ type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT });
    queue.push({
      type: SSE_EVENT.MSG_CHUNK,
      content: {
        status: ChunkStatus.PROCESSING,
        url: null,
      },
    });
    const { content } = await genImage(messages);
    queue.push({
      type: SSE_EVENT.MSG_CHUNK,
      content: {
        status: ChunkStatus.SUCCESS,
        url: content[0].image,
      },
    });
    queue.push({ type: SSE_EVENT.MSG_END });

    yield* queue.generator();
  }

  async *video(messages: StreamDto) {
    let timer = null;
    const queue = new AsyncQueue<StreamEvent>();
    queue.push({ type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT });

    const taskInfo = await genVideo(messages);
    queue.push({
      type: SSE_EVENT.MSG_CHUNK,
      content: {
        status: ChunkStatus.PROCESSING,
        url: null,
      },
    });
    if (taskInfo.task_id) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const _this = this;
      function loop() {
        timer = setTimeout(async () => {
          const { output } = await _this.queryVideo(taskInfo.task_id);
          console.log('查询任务状态', output);
          timer && clearTimeout(timer);
          queue.push({
            type: SSE_EVENT.MSG_CHUNK,
            content: {
              status: ChunkStatus.PROCESSING,
              url: null,
            },
          });
          if (['SUCCEEDED', 'FAILED'].includes(output.task_status)) {
            queue.push({
              type: SSE_EVENT.MSG_CHUNK,
              content: {
                status: ChunkStatus.SUCCESS,
                url: output?.video_url || null,
              },
            });
            queue.push({ type: SSE_EVENT.MSG_END });
            return;
          }

          loop();
        }, 15_000);
      }

      loop();
    }

    yield* queue.generator();
  }

  async *story({ message }: StreamDto) {
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

  async queryVideo(taskId: string) {
    const data = await fetch(`${process.env.ALI_VIDEO_STATUS_URL}${taskId}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ALI_API_KEY}`,
      },
      method: 'GET',
    }).then((res) => res.json());
    return data;
  }
}
