export type GenerationKind = "image" | "video" | "music" | "audio";

export type GenerationConfig = {
  ratio?: string;
  resolution?: string;
  count?: number;
  duration?: number;
};

export type GenerationInput = {
  kind: GenerationKind;
  prompt: string;
  modelId: string;
  modelName: string;
  config: GenerationConfig;
  referenceUrl?: string;
};

export type GenerationJob = GenerationInput & {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  urls: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};
