import { z } from 'zod';

export const CharacterInSceneSchema = z.object({
  idx: z.number().describe('The index of the character in the scene, starting from 0'),
  identifier_in_scene: z.string().describe('The identifier for the character in this specific scene'),
  is_visible: z.boolean().describe('Indicates whether the character is visible in this scene'),
  static_features: z.string().describe('Static features of the character (facial features, body shape, etc.)'),
  dynamic_features: z.string().describe('Dynamic features of the character (clothing, accessories, etc.)'),
});

export type CharacterInScene = z.infer<typeof CharacterInSceneSchema>;

export function formatCharacterInScene(c: CharacterInScene): string {
  const visibility = c.is_visible ? '[visible]' : '[not visible]';
  return `${c.identifier_in_scene}${visibility}\nstatic features: ${c.static_features}\ndynamic features: ${c.dynamic_features}`;
}

export const CharacterInEventSchema = z.object({
  index: z.number().describe('The index of the character in the event, starting from 0'),
  identifier_in_event: z.string().describe('The unique identifier for the character in the event'),
  active_scenes: z.record(z.number(), z.string()).describe('A dictionary mapping scene indices to their identifiers in specific scenes'),
  static_features: z.string().describe('The static features of the character in the event'),
});

export type CharacterInEvent = z.infer<typeof CharacterInEventSchema>;

export const CharacterInNovelSchema = z.object({
  index: z.number().describe('The index of the character in the novel, starting from 0'),
  identifier_in_novel: z.string().describe('The unique identifier for the character in the novel'),
  active_events: z.record(z.number(), z.string()).describe('A dictionary mapping event indices to their identifiers in specific events'),
  static_features: z.string().describe('The static features of the character in the novel'),
});

export type CharacterInNovel = z.infer<typeof CharacterInNovelSchema>;
