import { z } from 'zod';

export const CameraSchema = z.object({
  idx: z.number().describe('The index of the camera in the scene, starting from 0'),
  active_shot_idxs: z.array(z.number()).describe('The indices of the shots that the camera can film'),
  parent_cam_idx: z.number().nullable().default(null).describe('The index of the parent camera'),
  parent_shot_idx: z.number().nullable().default(null).describe('The index of the dependent shot'),
  reason: z.string().nullable().default(null).describe('The reason for the selection of the parent camera'),
  is_parent_fully_covers_child: z.boolean().nullable().default(null),
  missing_info: z.string().nullable().default(null),
});

export type Camera = z.infer<typeof CameraSchema>;
