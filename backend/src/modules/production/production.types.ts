import { z } from 'zod';

export const ProductionRequirementsSchema = z.object({
  status: z.enum(['ready', 'questions']),
  brief: z.string(),
  questions: z.array(z.string()).max(3),
});

export const ProductionScriptSchema = z.object({
  title: z.string(),
  synopsis: z.string(),
  story: z.string(),
  visualStyle: z.string(),
  ratio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']),
  scenes: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        script: z.string(),
        location: z.string(),
      }),
    )
    .min(1)
    .max(10),
});

export const ProductionCharactersSchema = z.object({
  characters: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        referencePrompt: z.string(),
      }),
    )
    .max(12),
});

export const ProductionStoryboardSchema = z.object({
  scenes: z
    .array(
      z.object({
        id: z.string(),
        referencePrompt: z.string(),
        shots: z
          .array(
            z.object({
              id: z.string(),
              title: z.string(),
              description: z.string(),
              movement: z.string(),
              duration: z.number().min(2).max(15),
              characterIds: z.array(z.string()),
            }),
          )
          .min(1)
          .max(10),
      }),
    )
    .min(1)
    .max(10),
});

export const ProductionImagePromptsSchema = z.object({
  scenes: z.array(
    z.object({
      id: z.string(),
      shots: z.array(z.object({ id: z.string(), visualPrompt: z.string() })),
    }),
  ),
});

export const ProductionTransitionSchema = z.object({
  mode: z.enum(['continuous', 'cut']),
  rationale: z.string(),
  bridge: z.string(),
  previousOutro: z.string(),
  currentIntro: z.string(),
  cameraPath: z.string(),
  consistency: z.string(),
});

export const ProductionVideoPromptsSchema = z.object({
  scenes: z.array(
    z.object({
      id: z.string(),
      shots: z.array(z.object({
        id: z.string(),
        motionPrompt: z.string(),
        transitionFromPrevious: ProductionTransitionSchema.optional(),
      })),
    }),
  ),
});

const ProductionShotSchema =
  ProductionStoryboardSchema.shape.scenes.element.shape.shots.element.extend({
    visualPrompt: z.string().optional(),
    motionPrompt: z.string().optional(),
  transitionFromPrevious: ProductionTransitionSchema.optional(),
  });

export const ProductionPlanSchema = ProductionScriptSchema.extend({
  characters: ProductionCharactersSchema.shape.characters,
  scenes: z
    .array(
      ProductionScriptSchema.shape.scenes.element.extend({
        referencePrompt: z.string(),
        shots: z.array(ProductionShotSchema).min(1).max(10),
      }),
    )
    .min(1)
    .max(10),
});

export type ProductionPlan = z.infer<typeof ProductionPlanSchema>;
export type ProductionStatus =
  | 'requirements_pending'
  | 'requirements_clarifying'
  | 'requirements_review'
  | 'script_pending'
  | 'script_review'
  | 'characters_pending'
  | 'characters_review'
  | 'storyboard_pending'
  | 'storyboard_review'
  | 'image_prompts_pending'
  | 'image_prompts_review'
  | 'video_prompts_pending'
  | 'video_prompts_review'
  | 'references_ready'
  | 'references_running'
  | 'references_paused'
  | 'references_review'
  | 'storyboards_ready'
  | 'storyboards_running'
  | 'storyboards_paused'
  | 'storyboards_review'
  | 'videos_ready'
  | 'videos_running'
  | 'videos_paused'
  | 'videos_review'
  | 'media_ready'
  | 'media_running'
  | 'media_paused'
  | 'media_completed'
  | 'completed_with_errors'
  | 'failed';

export type ProductionNode = {
  id: string;
  type:
    | 'textNode'
    | 'subjectNode'
    | 'shotTableNode'
    | 'imageNode'
    | 'videoNode';
  position: { x: number; y: number };
  data: Record<string, any>;
};

export type ProductionStreamEvent =
  | { type: 'start'; projectId: string; stage: string }
  | { type: 'chunk'; projectId: string; stage: string; data: unknown }
  | { type: 'result'; project: unknown };

export type ProductionEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  label?: string;
  data?: { kind?: 'continuity' };
};

export const PRODUCTION_PHASE = {
  character: 'characterReference',
  scene: 'sceneReference',
  storyboard: 'storyboard',
  video: 'video',
} as const;
