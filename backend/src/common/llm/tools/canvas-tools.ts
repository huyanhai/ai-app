import { BadRequestException } from '@nestjs/common';
import { HumanMessage } from 'langchain';
import { tool } from 'langchain';
import { z } from 'zod';
import { createChatModel, RuntimeModel } from '..';
import { extractTextFromContent } from '../../utils/message-utils';
import {
  AgentCanvasService,
  canvasArrangeSchema,
  canvasOperationsSchema,
} from '../../../modules/canvas/agent-canvas.service';
import { ImageStorageService } from '../../../modules/canvas/image-storage.service';

export type CanvasToolContext = {
  canvasId: string;
  runId: string;
  revision?: number;
};

export const createCanvasTools = (
  runtimeModel: RuntimeModel,
  canvas: AgentCanvasService,
  images: ImageStorageService,
  context: CanvasToolContext,
): any[] => {
  const mediaNode = async (nodeId: string, type: 'imageNode' | 'videoNode') => {
    const state = await canvas.getState(context.canvasId, [nodeId]);
    const node = state.nodes[0] as any;
    if (!node || node.type !== type)
      throw new BadRequestException(`媒体节点不存在：${nodeId}`);
    if (!node.data?.url)
      throw new BadRequestException('节点还没有可查看的媒体');
    return node;
  };

  const inspectImage = async (
    nodeId: string,
    url: string,
    question: string,
  ) => {
    const response = await createChatModel(runtimeModel, {
      temperature: 0.2,
    }).invoke([
      new HumanMessage({
        content: [
          { type: 'text', text: question },
          { type: 'image_url', image_url: { url } },
        ],
      }),
    ]);
    return { description: extractTextFromContent(response.content), nodeId };
  };

  return [
    tool(
      async ({ nodeIds }) => {
        const state = await canvas.getState(context.canvasId, nodeIds);
        context.revision = state.revision;
        return state;
      },
      {
        name: 'canvas_get_state',
        description:
          '读取当前画布。修改前必须调用；可用 nodeIds 只读取指定节点。',
        schema: z.object({ nodeIds: z.array(z.string()).optional() }).strict(),
      },
    ),
    tool(
      ({ operations }) =>
        canvas.applyOps(
          context.canvasId,
          context.runId,
          operations,
          context.revision,
        ),
      {
        name: 'canvas_apply_ops',
        description:
          '原子修改当前画布。支持 create_node、update_node、delete_node、connect、disconnect。节点类型使用 textNode、imageNode、videoNode、audioNode、subjectNode 等现有类型。',
        schema: z.object({ operations: canvasOperationsSchema }).strict(),
      },
    ),
    tool(
      (options) =>
        canvas.arrange(
          context.canvasId,
          context.runId,
          options,
          context.revision,
        ),
      {
        name: 'canvas_arrange',
        description:
          '整理节点布局。flow 按连线方向排列，grid 按网格排列；尽量传 nodeIds，只整理相关节点。',
        schema: canvasArrangeSchema,
      },
    ),
    tool(
      ({ nodeIds }) =>
        canvas.deleteNodes(
          context.canvasId,
          context.runId,
          nodeIds,
          context.revision,
        ),
      {
        name: 'canvas_delete',
        description: '删除指定节点及其关联连线。只删除用户明确要求删除的节点。',
        schema: z
          .object({ nodeIds: z.array(z.string().min(1)).min(1).max(500) })
          .strict(),
      },
    ),
    tool(
      async ({ nodeId, question }) => {
        const node = await mediaNode(nodeId, 'imageNode');
        return inspectImage(
          nodeId,
          node.data.url,
          question ?? '描述这张图片的主体、构图和可用于后续生成的视觉特征。',
        );
      },
      {
        name: 'canvas_inspect_image',
        description: '查看画布图片节点并回答视觉问题。',
        schema: z
          .object({
            nodeId: z.string(),
            question: z.string().max(4000).optional(),
          })
          .strict(),
      },
    ),
    tool(
      async ({ nodeId, question }) => {
        const node = await mediaNode(nodeId, 'videoNode');
        const frame = await images.extractLastFrame(node.data.url);
        const result = await inspectImage(
          nodeId,
          frame,
          question ??
            '这是视频的最后一帧。描述画面，并说明仅凭这一帧无法确认的动态效果。',
        );
        return { ...result, frame: 'last', audioAnalyzed: false };
      },
      {
        name: 'canvas_inspect_video',
        description:
          '通过最后一帧查看画布视频。只能理解该帧画面，不能声称已理解完整运动或音频。',
        schema: z
          .object({
            nodeId: z.string(),
            question: z.string().max(4000).optional(),
          })
          .strict(),
      },
    ),
    tool(
      async ({ nodeId }) => {
        const node = await mediaNode(nodeId, 'videoNode');
        return {
          nodeId,
          url: await images.extractLastFrame(node.data.url),
          frame: 'last',
        };
      },
      {
        name: 'canvas_capture_frame',
        description: '截取画布视频的最后一帧并返回图片地址，不自动修改画布。',
        schema: z.object({ nodeId: z.string() }).strict(),
      },
    ),
  ];
};
