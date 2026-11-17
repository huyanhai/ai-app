import type { LucideIcon } from "lucide-react";

export type NodeKind = "script" | "image" | "video" | "audio" | "character";
export type RefNode = { id: string; label: string; kind: NodeKind | "group" };
export type NodeIconMap = Record<string, LucideIcon>;

