"use client";

import { useEffect, useState } from "react";
import { Box } from "lucide-react";
import type { Chip } from "@/lib/agent/chips";
import { ModelCategory } from "@/components/models/types";
import { useModelStore } from "@/store/model-store";
import { AgentMenuButton, AgentPopover } from "./ui";
import { AGENT_ICON_BTN } from "./styles";

export function ModelPopover({
  onPick,
  disabled,
}: {
  onPick: (chip: Chip) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ModelCategory.Image | ModelCategory.Video>(
    ModelCategory.Image,
  );
  const models = useModelStore((state) => state.models);
  const loaded = useModelStore((state) => state.loaded);
  const loadModels = useModelStore((state) => state.loadModels);
  useEffect(() => {
    if (open) void loadModels().catch(() => undefined);
  }, [open, loadModels]);
  const options = models.filter(
    (model) => model.category === kind && model.enabled,
  );
  return (
    <AgentPopover
      label="插入模型"
      side="top"
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      className="w-[min(340px,calc(100vw-24px))] p-2"
      trigger={
        <span className={AGENT_ICON_BTN} title="插入模型">
          <Box />
        </span>
      }
    >
      <div className="mb-2 flex rounded-lg bg-zinc-100 p-0.5">
        {([ModelCategory.Image, ModelCategory.Video] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`flex-1 rounded-md py-1 text-xs ${kind === value ? "bg-white shadow-sm" : "text-zinc-500"}`}
          >
            {value === ModelCategory.Image ? "图片" : "视频"}
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto">
        {!loaded && (
          <p className="py-6 text-center text-xs text-zinc-500">加载中…</p>
        )}
        {loaded && options.length === 0 && (
          <p className="py-6 text-center text-xs text-zinc-500">
            还没有可用的{kind === ModelCategory.Image ? "图片" : "视频"}模型
          </p>
        )}
        {options.map((model) => (
          <AgentMenuButton
            key={model.id}
            onClick={() =>
              onPick({ type: "model", id: model.id, name: model.name })
            }
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600">
              <Box className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{model.name}</span>
              <span className="block truncate text-[11px] text-zinc-500">
                {model.description || model.modelId}
              </span>
            </span>
          </AgentMenuButton>
        ))}
      </div>
    </AgentPopover>
  );
}
