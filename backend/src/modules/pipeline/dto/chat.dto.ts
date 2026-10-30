import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { TextScene } from '@/common/utils/text-scene';

// 系统提示词由后端按场景注入，不接受前端传入 system 消息
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

export const ChatSchema = z.object({
  modelId: z.string().trim().min(1).optional(),
  scene: z.enum(TextScene).default(TextScene.Auto),
  messages: z.array(ChatMessageSchema).min(1),
});

export class ChatDto extends createZodDto(ChatSchema) {}
