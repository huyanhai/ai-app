import { z } from 'zod';

export const ShotBriefDescriptionSchema = z.object({
  idx: z.number().describe('The index of the shot in the sequence, starting from 0'),
  is_last: z.boolean().describe('Whether this is the last shot'),
  cam_idx: z.number().describe('The index of the camera in the scene'),
  visual_desc: z.string().describe('A vivid visual description of the shot'),
  audio_desc: z
    .string()
    .optional()
    .default('')
    .describe('A detailed description of the audio in the shot'),
});

export type ShotBriefDescription = z.infer<typeof ShotBriefDescriptionSchema>;

export const ShotDescriptionSchema = z.object({
  idx: z.number().describe('The index of the shot in the sequence, starting from 0'),
  is_last: z.boolean().describe('Whether this is the last shot'),
  cam_idx: z.number().describe('The index of the camera in the scene'),
  visual_desc: z.string().describe('A vivid visual description of the shot'),
  variation_type: z.enum(['large', 'medium', 'small']),
  variation_reason: z.string().describe('The reason for the variation type'),
  ff_desc: z.string().describe('The first frame of the shot'),
  ff_vis_char_idxs: z.array(z.number()).default([]),
  lf_desc: z.string().describe('The last frame of the shot'),
  lf_vis_char_idxs: z.array(z.number()).default([]),
  motion_desc: z.string().describe('The motion description of the shot'),
  audio_desc: z.string().optional().default('').describe('The audio description of the shot'),
});

export type ShotDescription = z.infer<typeof ShotDescriptionSchema>;
