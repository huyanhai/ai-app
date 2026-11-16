import { z } from 'zod';

export const ProductionRequirementsSchema = z.object({
  status: z.enum(['ready', 'questions']),
  brief: z.string(),
  questions: z.array(z.string()).max(3),
});

export const ProductionStoryReviewSchema = z.object({
  comedyScore: z.object({
    overall: z.number().min(1).max(10),
    hook: z.number().min(1).max(10),
    agency: z.number().min(1).max(10),
    surprise: z.number().min(1).max(10),
    causality: z.number().min(1).max(10),
    callback: z.number().min(1).max(10),
    pacing: z.number().min(1).max(10),
    physics: z.number().min(1).max(10),
  }).optional(),
  comedyChecks: z.array(z.object({
    target: z.string().min(1),
    category: z.enum(['hook', 'expectation', 'agency', 'plant', 'callback', 'physics', 'pacing']).catch('expectation'),
    passed: z.boolean(),
    evidence: z.string().min(1),
    problem: z.string(),
  })).optional(),
  issues: z.array(z.object({
    severity: z.enum(['blocking', 'suggestion']),
    category: z.enum(['source', 'causality', 'continuity', 'character', 'adaptation', 'physics']).catch('adaptation'),
    evidence: z.string().min(1),
    problem: z.string().min(1),
    suggestion: z.string().min(1),
  })),
});

export const ProductionComedyStoryReviewSchema = ProductionStoryReviewSchema.extend({
  comedyScore: ProductionStoryReviewSchema.shape.comedyScore.unwrap(),
  comedyChecks: ProductionStoryReviewSchema.shape.comedyChecks.unwrap(),
});

export const ProductionComedyDesignSchema = z.object({
  mode: z.enum(['single-protagonist', 'rivalry']),
  candidates: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    mode: z.enum(['single-protagonist', 'rivalry']),
    mechanism: z.string().min(1),
    strongestGag: z.string().min(1),
    weakness: z.string().min(1),
    scores: z.object({
      visual: z.number().min(1).max(10),
      surprise: z.number().min(1).max(10),
      causality: z.number().min(1).max(10),
      agency: z.number().min(1).max(10),
      callback: z.number().min(1).max(10),
    }),
  })).length(3),
  selectedCandidateId: z.string().min(1),
  selectionReason: z.string().min(1),
  performanceBudget: z.array(z.object({
    beat: z.string().min(1),
    startState: z.string().min(1),
    action: z.string().min(1),
    endState: z.string().min(1),
    newInformation: z.string().min(1),
    seconds: z.number().min(1).max(15),
  })).min(3).max(8),
  openingHook: z.object({
    visual: z.string().min(1),
    question: z.string().min(1),
  }),
  reversals: z.array(z.object({
    actor: z.string().min(1),
    action: z.string().min(1),
    origin: z.enum(['strategy', 'mistake', 'accident']),
    setup: z.string().min(1),
    spatialLogic: z.string().min(1),
    expectationEvidence: z.string().min(1),
    expectation: z.string().min(1),
    reversal: z.string().min(1),
    payoff: z.string().min(1),
    stateChange: z.string().min(1),
    advantageBefore: z.string().min(1),
    advantageAfter: z.string().min(1),
  })).max(6),
  endingCallback: z.object({
    apparentVictory: z.string().min(1),
    reusedSetup: z.string().min(1),
    plantedEarly: z.string().min(1),
    winnerAction: z.string().min(1),
    characterControl: z.string().min(1),
    spatialSetup: z.string().min(1),
    scaleConsistency: z.string().min(1),
    finalOutcome: z.string().min(1),
  }),
});

export const ProductionComedyRoleSchema = z.enum([
  'hook',
  'setup',
  'escalation',
  'reversal',
  'reaction',
  'callback',
]);

export const ProductionStorySchema = z.object({
  workflow: z.enum(['classical-poetry-live-action', 'animated-visual-comedy']).optional(),
  targetDuration: z.number().min(5).max(600).optional(),
  title: z.string().min(1),
  synopsis: z.string().min(1),
  story: z.string().min(1),
  sourceBasis: z.array(z.string()).min(1),
  creativeAdditions: z.array(z.string()),
  storyArc: z.object({
    goal: z.string().min(1),
    obstacle: z.string().min(1),
    action: z.string().min(1),
    result: z.string().min(1),
    change: z.string().min(1),
  }),
  comedyDesign: ProductionComedyDesignSchema.optional(),
  visualStyle: z.string().min(1),
  ratio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']),
});

export const ProductionScriptSchema = z.object({
  workflow: z.enum(['classical-poetry-live-action', 'animated-visual-comedy']).optional(),
  targetDuration: z.number().min(5).max(600).optional(),
  title: z.string(),
  synopsis: z.string(),
  story: z.string(),
  adaptationNote: z.string().optional(),
  sourceBasis: ProductionStorySchema.shape.sourceBasis.optional(),
  creativeAdditions: ProductionStorySchema.shape.creativeAdditions.optional(),
  storyArc: ProductionStorySchema.shape.storyArc.optional(),
  comedyDesign: ProductionComedyDesignSchema.optional(),
  storyReview: ProductionStoryReviewSchema.optional(),
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
  props: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    referencePrompt: z.string(),
    textContent: z.string().optional(),
  })).max(12).optional(),
});

export const ProductionSceneAssetSchema = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string(),
  referencePrompt: z.string(),
});

export const ProductionStoryboardSchema = z.object({
  sceneAssets: z.array(ProductionSceneAssetSchema).min(1).max(10),
  scenes: z
    .array(
      z.object({
        id: z.string(),
        sceneAssetId: z.string(),
        shots: z
          .array(
            z.object({
              id: z.string(),
              title: z.string(),
              narrativeBeat: z.string().optional(),
              description: z.string(),
              movement: z.string(),
              duration: z.number().min(2).max(15),
              continuityGroupId: z.string().optional(),
              startState: z.string().optional(),
              endState: z.string().optional(),
              comedyRole: ProductionComedyRoleSchema.optional(),
              characterIds: z.array(z.string()),
              propIds: z.array(z.string()).optional(),
            }),
          )
          .min(0)
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
      shots: z.array(z.object({ id: z.string(), visualPrompt: z.string().optional() })),
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
        motionPrompt: z.string().optional(),
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
  props: ProductionCharactersSchema.shape.props,
  sceneAssets: z.array(ProductionSceneAssetSchema).min(1).max(10).optional(),
  scenes: z
    .array(
      ProductionScriptSchema.shape.scenes.element.extend({
        sceneAssetId: z.string().optional(),
        referencePrompt: z.string().optional(),
        shots: z.array(ProductionShotSchema).min(0).max(10),
      }),
    )
    .min(1)
    .max(10),
});

export type ProductionPlan = z.infer<typeof ProductionPlanSchema>;
export type ProductionStory = z.infer<typeof ProductionStorySchema>;
export type ProductionStatus =
  | 'requirements_pending'
  | 'requirements_clarifying'
  | 'requirements_review'
  | 'story_pending'
  | 'story_review'
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
  data?: { kind?: 'continuity' | 'sceneMembership' };
};

export const PRODUCTION_PHASE = {
  character: 'characterReference',
  prop: 'propReference',
  scene: 'sceneReference',
  storyboard: 'storyboard',
  previz: 'storyboardPreviz',
  video: 'video',
} as const;
