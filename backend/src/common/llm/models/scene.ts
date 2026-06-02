import { z } from 'zod';
import { EnvironmentInSceneSchema } from './environment';
import { CharacterInSceneSchema } from './character';

export const SceneSchema = z.object({
  idx: z.number().describe('The scene index, starting from 0'),
  is_last: z.boolean().describe('Indicates if this is the last scene'),
  environment: EnvironmentInSceneSchema,
  characters: z.array(CharacterInSceneSchema).describe('Characters appearing in the scene'),
  script: z.string().describe('The screenplay script for the scene'),
});

export type Scene = z.infer<typeof SceneSchema>;

export function formatScene(scene: Scene): string {
  return [
    `Scene ${scene.idx}:`,
    `Environment: ${scene.environment.slugline} -- ${scene.environment.description}`,
    `Characters: ${scene.characters.map(c => c.identifier_in_scene).join(', ')}`,
    `Script:\n${scene.script}`,
  ].join('\n');
}
