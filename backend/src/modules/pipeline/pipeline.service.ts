import { senModel } from '@/common/llm';
import { genImage } from '@/common/llm/tools/gen-image';
import { StreamEvent } from '@/common/utils/ai-stream-utils';
import { AsyncQueue } from '@/common/utils/async-queue';
import { SSE_EVENT, SSE_ROLE } from '@/common/utils/stream-constants';

import { Injectable } from '@nestjs/common';
import { HumanMessage } from 'langchain';
import { StreamDto } from './dto/stream.dto';

@Injectable()
export class PipelineService {
  async *text({ message }: StreamDto) {
    const queue = new AsyncQueue<StreamEvent>();
    queue.push({ type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT });
    const response = await senModel.invoke([
      new HumanMessage({
        content: message,
      } as any),
    ]);
    queue.push({ type: SSE_EVENT.MSG_CHUNK, content: response.text });
    queue.push({ type: SSE_EVENT.MSG_END });

    yield* queue.generator();
  }

  async *image({ message, config }: StreamDto) {
    if (config?.ratio) {
      message.push({ type: 'text', text: `图片尺寸：${config.ratio}` });
    }
    const queue = new AsyncQueue<StreamEvent>();
    queue.push({ type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT });
    const { content } = await genImage(message);
    queue.push({ type: SSE_EVENT.MSG_CHUNK, content: content[0].image });
    queue.push({ type: SSE_EVENT.MSG_END });

    yield* queue.generator();
  }
}
