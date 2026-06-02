import { z } from 'zod';

export const EnvironmentInSceneSchema = z.object({
  slugline: z.string().describe('The slugline of the scene (e.g., INT. COFFEE SHOP - NIGHT)'),
  description: z.string().describe('A detailed description of the environment'),
});

export type EnvironmentInScene = z.infer<typeof EnvironmentInSceneSchema>;
