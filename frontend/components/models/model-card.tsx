"use client";
import { useState } from "react";
import { Pencil, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isModelReady } from "@/store/model-store";
import { getProvider, MODEL_CATEGORIES, VIDEO_MODES } from "./constants";
import { Switch } from "./fields";
import { ModelCategory, TModelConfig } from "./types";

const maskKey = (key: string) =>
  key.length > 8 ? `${key.slice(0, 4)}••••${key.slice(-4)}` : "••••••••";

// 卡片上展示的能力标签
const getTags = (model: TModelConfig): string[] => {
  switch (model.category) {
    case ModelCategory.Text:
      return [
        `温度 ${model.params.temperature.toFixed(1)}`,
        `${model.params.contextWindow}K 上下文`,
        model.params.supportTools ? "工具调用" : "",
        model.params.supportVision ? "图片理解" : "",
      ];
    case ModelCategory.Image:
      return [
        model.params.resolutions.join(" / "),
        `${model.params.ratios.length} 种比例`,
        `最多 ${model.params.maxCount} 张`,
        model.params.supportReference ? "参考图" : "",
      ];
    case ModelCategory.Video:
      return [
        ...model.params.modes.map(
          (mode) => VIDEO_MODES.find((item) => item.value === mode)?.label ?? "",
        ),
        model.params.resolutions.join(" / "),
        model.params.durations.map((d) => `${d}s`).join(" / "),
      ];
    case ModelCategory.Audio:
      return [
        model.params.formats.join(" / "),
        `${model.params.sampleRate / 1000}kHz`,
        model.params.supportClone ? "音色克隆" : "",
      ];
  }
};

const Badge = ({
  className,
  children,
}: {
  className?: string;
  children: string;
}) => (
  <span
    className={cn(
      "shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none",
      className,
    )}
  >
    {children}
  </span>
);

const ModelCard = ({
  model,
  isDefault,
  onEdit,
  onRemove,
  onToggle,
  onSetDefault,
}: {
  model: TModelConfig;
  isDefault: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onToggle: () => void;
  onSetDefault: () => void;
}) => {
  const [confirming, setConfirming] = useState(false);
  const Icon = MODEL_CATEGORIES.find((c) => c.value === model.category)!.icon;
  const ready = isModelReady(model);

  const rows = [
    { label: "服务商", value: getProvider(model.provider)?.label ?? "-" },
    { label: "模型 ID", value: model.modelId || "未填写", mono: true },
    { label: "接口地址", value: model.baseURL || "未填写", mono: true },
    {
      label: "API Key",
      value: model.hasApiKey
        ? model.apiKey
        : model.apiKey
          ? maskKey(model.apiKey)
          : "未配置",
      mono: true,
    },
  ];

  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl border bg-[#1c1c1e] p-4 transition-colors",
        isDefault
          ? "border-[#33a3ff]/40"
          : "border-white/5 hover:border-white/15",
        !model.enabled && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/70">
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-white">
                {model.name}
              </span>
              {isDefault && (
                <Badge className="bg-[#33a3ff]/15 text-[#33a3ff]">默认</Badge>
              )}
              {!ready && (
                <Badge className="bg-[#f5a524]/15 text-[#f5a524]">待配置</Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-white/40">
              {model.description || "暂无备注"}
            </p>
          </div>
        </div>
        <Switch
          checked={model.enabled}
          onChange={onToggle}
          label={model.enabled ? "停用模型" : "启用模型"}
        />
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-white/35">{row.label}</dt>
            <dd
              title={row.value}
              className={cn("truncate text-white/70", row.mono && "font-mono")}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {getTags(model)
          .filter(Boolean)
          .map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-white/50"
            >
              {tag}
            </span>
          ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        {isDefault ? (
          <span className="flex items-center gap-1 text-xs text-[#33a3ff]">
            <Star size={13} fill="currentColor" />
            默认模型
          </span>
        ) : (
          <button
            disabled={!model.enabled}
            onClick={onSetDefault}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 -ml-1.5 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-40"
          >
            <Star size={13} />
            设为默认
          </button>
        )}
        <div className="flex items-center gap-1">
          <button
            aria-label="编辑"
            onClick={onEdit}
            className="flex size-7 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <Pencil size={13} />
          </button>
          {/* 二次确认：第一次点击进入确认态，失焦后恢复 */}
          <button
            aria-label={confirming ? "确认删除" : "删除"}
            onClick={() => (confirming ? onRemove() : setConfirming(true))}
            onBlur={() => setConfirming(false)}
            className={cn(
              "flex h-7 items-center justify-center gap-1 rounded-md text-xs transition-colors cursor-pointer",
              confirming
                ? "bg-[#ff6b6b]/15 px-2 text-[#ff6b6b]"
                : "w-7 text-white/50 hover:bg-[#ff6b6b]/15 hover:text-[#ff6b6b]",
            )}
          >
            <Trash2 size={13} />
            {confirming && "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelCard;
