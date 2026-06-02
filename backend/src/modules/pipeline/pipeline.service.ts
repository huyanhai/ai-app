import { senModel } from '@/common/llm';
import { genImage } from '@/common/llm/tools/gen-image';
import { StreamEvent } from '@/common/utils/ai-stream-utils';
import { AsyncQueue } from '@/common/utils/async-queue';
import { SSE_EVENT, SSE_ROLE } from '@/common/utils/stream-constants';

import { Injectable } from '@nestjs/common';

@Injectable()
export class PipelineService {
  async *text(message: string) {
    const queue = new AsyncQueue<StreamEvent>();
    queue.push({ type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT });
    const response = await senModel.invoke([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      },
    ]);
    queue.push({ type: SSE_EVENT.MSG_CHUNK, content: response.text });
    queue.push({ type: SSE_EVENT.MSG_END });

    yield* queue.generator();
  }

  async *image(message: string) {
    const queue = new AsyncQueue<StreamEvent>();
    queue.push({ type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT });
    const { content } = await genImage(message);
    queue.push({ type: SSE_EVENT.MSG_CHUNK, content: content[0].image });
    queue.push({ type: SSE_EVENT.MSG_END });

    yield* queue.generator();
  }
}
