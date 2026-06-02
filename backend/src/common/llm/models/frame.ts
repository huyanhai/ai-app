import { z } from 'zod';

export const FrameSchema = z.object({
  shot_idx: z.number().describe('The index of the shot in the sequence, starting from 0'),
  frame_type: z.enum(['first', 'last']).describe('The type of the frame'),
  cam_idx: z.number().describe('The index of the camera used for this frame'),
  vis_char_idxs: z.array(z.number()).describe('Indices of characters visible in this frame'),
});

export type Frame = z.infer<typeof FrameSchema>;
