import { create } from "zustand";
import {
  ModelCategory,
  TModelConfig,
  TModelConfigOf,
} from "@/components/models/types";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type TModelDraft = DistributiveOmit<
  TModelConfig,
  "id" | "createdAt" | "hasApiKey"
>;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}/models${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "模型配置请求失败");
  }
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
};

export const isModelReady = (model: TModelConfig) =>
  !!(model.modelId && model.baseURL && (model.apiKey || model.hasApiKey));

export const getTextModel = (name?: string) => {
  const { models, defaults } = useModelStore.getState();
  const textModels = models.filter(
    (item): item is TModelConfigOf<ModelCategory.Text> =>
      item.category === ModelCategory.Text && item.enabled,
  );
  return (
    (name && textModels.find((item) => item.name === name)) ||
    textModels.find((item) => item.id === defaults[ModelCategory.Text]) ||
    textModels[0]
  );
};

export const getImageModel = (name?: string) => {
  const { models, defaults } = useModelStore.getState();
  const imageModels = models.filter(
    (item): item is TModelConfigOf<ModelCategory.Image> =>
      item.category === ModelCategory.Image && item.enabled,
  );
  return (
    (name && imageModels.find((item) => item.name === name)) ||
    imageModels.find((item) => item.id === defaults[ModelCategory.Image]) ||
    imageModels[0]
  );
};

export const getVideoModel = (name?: string) => {
  const { models, defaults } = useModelStore.getState();
  const videoModels = models.filter(
    (item): item is TModelConfigOf<ModelCategory.Video> =>
      item.category === ModelCategory.Video && item.enabled,
  );
  return (
    (name && videoModels.find((item) => item.name === name)) ||
    videoModels.find((item) => item.id === defaults[ModelCategory.Video]) ||
    videoModels[0]
  );
};

export const getAudioModel = (name?: string) => {
  const { models, defaults } = useModelStore.getState();
  const audioModels = models.filter(
    (item): item is TModelConfigOf<ModelCategory.Audio> =>
      item.category === ModelCategory.Audio && item.enabled,
  );
  return (
    (name && audioModels.find((item) => item.name === name)) ||
    audioModels.find((item) => item.id === defaults[ModelCategory.Audio]) ||
    audioModels[0]
  );
};

type TModelStore = {
  models: TModelConfig[];
  defaults: Partial<Record<ModelCategory, string>>;
  loaded: boolean;
  loadModels: (force?: boolean) => Promise<void>;
  addModel: (draft: TModelDraft) => Promise<void>;
  updateModel: (id: string, draft: TModelDraft) => Promise<void>;
  removeModel: (id: string) => Promise<void>;
  toggleModel: (id: string) => Promise<void>;
  setDefault: (category: ModelCategory, id: string) => Promise<void>;
};

let loadingPromise: Promise<void> | null = null;

const applyModels = (models: TModelConfig[]) => ({
  models,
  defaults: Object.fromEntries(
    models
      .filter((model) => model.isDefault)
      .map((model) => [model.category, model.id]),
  ),
  loaded: true,
});

export const useModelStore = create<TModelStore>()((set, get) => ({
  models: [],
  defaults: {},
  loaded: false,
  loadModels: async (force = false) => {
    if (get().loaded && !force) return;
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      let models = await request<TModelConfig[]>("");
      if (!models.length) {
        const legacy = localStorage.getItem("model-config");
        if (legacy) {
          const persisted = JSON.parse(legacy);
          models = await request<TModelConfig[]>("/import", {
            method: "POST",
            body: JSON.stringify({
              models: persisted.state?.models ?? [],
              defaults: persisted.state?.defaults ?? {},
            }),
          });
          localStorage.removeItem("model-config");
        }
      }
      set(applyModels(models));
    })().finally(() => {
      loadingPromise = null;
    });
    return loadingPromise;
  },
  addModel: async (draft) => {
    await request("", { method: "POST", body: JSON.stringify(draft) });
    await get().loadModels(true);
  },
  updateModel: async (id, draft) => {
    await request(`/${id}`, { method: "PATCH", body: JSON.stringify(draft) });
    await get().loadModels(true);
  },
  removeModel: async (id) => {
    await request(`/${id}`, { method: "DELETE" });
    await get().loadModels(true);
  },
  toggleModel: async (id) => {
    await request(`/${id}/toggle`, { method: "POST" });
    await get().loadModels(true);
  },
  setDefault: async (_category, id) => {
    await request(`/${id}/default`, { method: "POST" });
    await get().loadModels(true);
  },
}));
