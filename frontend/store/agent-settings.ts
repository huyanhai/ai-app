import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DOCK_WIDTH = { default: 600, min: 600, max: 810 } as const;

export type AgentPanelOffset = { dx: number; dy: number };
export type PetMode = "lively" | "quiet" | "hidden";
export type PetCorner = "br" | "bl" | "tr" | "tl";
export type PetAnchor = { corner: PetCorner; dx: number; dy: number };

export type PetSettings = {
  mode: PetMode;
  anchor: PetAnchor | null;
  skin: string;
};

export const DEFAULT_PET_SETTINGS: PetSettings = { mode: "lively", anchor: null, skin: "xiaojing" };

const PET_MODES: readonly PetMode[] = ["lively", "quiet", "hidden"];
const PET_CORNERS: readonly PetCorner[] = ["br", "bl", "tr", "tl"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function normalizePet(raw: unknown): PetSettings {
  const source = isRecord(raw) ? raw : {};
  const anchor = source.anchor;
  const anchorOk =
    isRecord(anchor) &&
    PET_CORNERS.includes(anchor.corner as PetCorner) &&
    Number.isFinite(anchor.dx) &&
    Number.isFinite(anchor.dy);
  return {
    mode: PET_MODES.includes(source.mode as PetMode)
      ? (source.mode as PetMode)
      : DEFAULT_PET_SETTINGS.mode,
    anchor: anchorOk
      ? { corner: anchor.corner as PetCorner, dx: anchor.dx as number, dy: anchor.dy as number }
      : null,
    skin:
      typeof source.skin === "string" && source.skin ? source.skin : DEFAULT_PET_SETTINGS.skin,
  };
}

export function migrateAgentSettings(persisted: unknown, _version: number): unknown {
  const base = isRecord(persisted) ? persisted : {};
  return { ...base, pet: normalizePet(base.pet) };
}

type AgentSettings = {
  modelKey: string;
  showThinking: boolean;
  offset: AgentPanelOffset | null;
  docked: boolean;
  dockWidth: number;
  pet: PetSettings;
  patch: (next: Partial<Omit<AgentSettings, "patch" | "patchPet">>) => void;
  patchPet: (next: Partial<PetSettings>) => void;
};

export const useAgentSettings = create<AgentSettings>()(
  persist(
    (set) => ({
      modelKey: "",
      showThinking: false,
      offset: null,
      docked: false,
      dockWidth: DOCK_WIDTH.default,
      pet: { ...DEFAULT_PET_SETTINGS },
      patch: (next) => set(next),
      patchPet: (next) => set((state) => ({ pet: { ...state.pet, ...next } })),
    }),
    {
      name: "video-canvas-agent-settings",
      version: 1,
      migrate: (persisted, version) => migrateAgentSettings(persisted, version) as AgentSettings,
    },
  ),
);
