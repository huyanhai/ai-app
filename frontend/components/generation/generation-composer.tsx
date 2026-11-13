"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, AudioLines, Box, Check, ChevronDown, Clock3, Image, LoaderCircle, Music2, Plus, Video, X } from "lucide-react";
import { ModelCategory } from "@/components/models/types";
import { isModelReady, useModelStore } from "@/store/model-store";
import { useClickOutSide } from "@/hooks/use-click-outside";
import { createGeneration, generationMediaUrl, uploadGenerationAsset } from "./api";
import type { GenerationConfig, GenerationInput, GenerationJob, GenerationKind } from "./types";

const KIND_OPTIONS = [
  { value: "image" as const, label: "图片生成", icon: Image },
  { value: "video" as const, label: "视频生成", icon: Video },
  { value: "music" as const, label: "音乐生成", icon: Music2 },
  { value: "audio" as const, label: "音频生成", icon: AudioLines },
];

const DEFAULT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];

const defaultConfig = (kind: GenerationKind): GenerationConfig => kind === "image"
  ? { ratio: "1:1", resolution: "2K", count: 4 }
  : kind === "video"
    ? { ratio: "16:9", resolution: "720P", duration: 5 }
    : {};

const isMusicModel = (name: string) => /music|音乐/i.test(name);

export default function GenerationComposer({ initialValue, onCreated, className = "" }: {
  initialValue?: GenerationInput;
  onCreated: (job: GenerationJob) => void;
  className?: string;
}) {
  const [kind, setKind] = useState<GenerationKind>(initialValue?.kind ?? "image");
  const [prompt, setPrompt] = useState(initialValue?.prompt ?? "");
  const [modelId, setModelId] = useState(initialValue?.modelId ?? "");
  const [config, setConfig] = useState<GenerationConfig>({ ...defaultConfig(initialValue?.kind ?? "image"), ...initialValue?.config });
  const [referenceUrl, setReferenceUrl] = useState(initialValue?.referenceUrl ?? "");
  const [openMenu, setOpenMenu] = useState<"kind" | "model" | "settings" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const models = useModelStore((state) => state.models);
  const defaults = useModelStore((state) => state.defaults);
  const loaded = useModelStore((state) => state.loaded);
  const loadModels = useModelStore((state) => state.loadModels);
  useClickOutSide(rootRef, () => setOpenMenu(null), openMenu !== null);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const category = kind === "image" ? ModelCategory.Image : kind === "video" ? ModelCategory.Video : ModelCategory.Audio;
  const availableModels = useMemo(() => {
    const categoryModels = models.filter((model) => model.enabled && model.category === category);
    if (kind === "music") {
      const musicModels = categoryModels.filter((model) => isMusicModel(`${model.name} ${model.modelId}`));
      return musicModels.length ? musicModels : categoryModels;
    }
    if (kind === "audio") {
      const speechModels = categoryModels.filter((model) => !isMusicModel(`${model.name} ${model.modelId}`));
      return speechModels.length ? speechModels : categoryModels;
    }
    return categoryModels;
  }, [category, kind, models]);
  const selectedModel = availableModels.find((model) => model.id === modelId);
  const selectedKind = KIND_OPTIONS.find((item) => item.value === kind) ?? KIND_OPTIONS[0];
  const KindIcon = selectedKind.icon;
  const mediaKind = kind === "image" || kind === "video";
  const modelParams = selectedModel?.params as { resolutions?: string[]; ratios?: string[]; maxCount?: number; durations?: number[]; formats?: string[] } | undefined;
  const ratios = modelParams?.ratios?.length ? modelParams.ratios : DEFAULT_RATIOS;
  const resolutions = modelParams?.resolutions?.length ? modelParams.resolutions : [kind === "image" ? "2K" : "720P"];
  const durations = modelParams?.durations?.length ? modelParams.durations : [4, 5, 10, 15];
  const counts = [1, 2, 4].filter((count) => count <= (modelParams?.maxCount ?? 4));

  useEffect(() => {
    if (!loaded) return;
    const nextModel = availableModels.find((model) => model.id === modelId)
      ?? availableModels.find((model) => model.id === defaults[category])
      ?? availableModels[0];
    if ((nextModel?.id ?? "") !== modelId) setModelId(nextModel?.id ?? "");
  }, [availableModels, category, defaults, loaded, modelId]);

  useEffect(() => {
    if (!loaded || !mediaKind) return;
    setConfig((current) => ({
      ...current,
      resolution: current.resolution && resolutions.includes(current.resolution) ? current.resolution : resolutions[0],
      ratio: current.ratio && ratios.includes(current.ratio) ? current.ratio : ratios[0],
      count: kind === "image" ? Math.min(current.count ?? 4, modelParams?.maxCount ?? 4) : current.count,
      duration: kind === "video" && (!current.duration || !durations.includes(current.duration)) ? durations[0] : current.duration,
    }));
  }, [kind, loaded, selectedModel?.id]);

  const changeKind = (nextKind: GenerationKind) => {
    setKind(nextKind);
    setConfig(defaultConfig(nextKind));
    setReferenceUrl("");
    setOpenMenu(null);
    setError("");
  };

  const uploadReference = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("参考素材仅支持图片");
      return;
    }
    setUploading(true);
    setError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const url = await uploadGenerationAsset(String(reader.result));
        setReferenceUrl(url);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "参考图上传失败");
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setError("参考图读取失败");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!prompt.trim() || submitting || uploading) return;
    if (!selectedModel || !isModelReady(selectedModel)) {
      setError("请先在模型配置中启用并完善对应模型");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const job = await createGeneration({
        kind,
        prompt: prompt.trim(),
        modelId: selectedModel.id,
        modelName: selectedModel.name,
        config,
        referenceUrl: referenceUrl || undefined,
      });
      onCreated(job);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建生成任务失败");
      setSubmitting(false);
    }
  };

  return (
    <div ref={rootRef} className={className}>
      <div className="rounded-[28px] border border-white/10 bg-[#1b1b1b] p-4 shadow-2xl shadow-black/20">
        <div className="flex min-h-32 items-start gap-4">
          {mediaKind && <div className="relative size-14 shrink-0">
            {referenceUrl ? <>
              <img src={generationMediaUrl(referenceUrl)} alt="参考图" className="size-14 rounded-xl border border-white/10 object-cover" />
              <button type="button" aria-label="移除参考图" onClick={() => setReferenceUrl("")} className="absolute -right-1.5 -top-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full bg-white text-black"><X size={11} /></button>
            </> : <button type="button" aria-label="上传参考图" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex size-14 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-wait">
              {uploading ? <LoaderCircle size={20} className="animate-spin" /> : <Plus size={22} />}
            </button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => { uploadReference(event.target.files?.[0]); event.target.value = ""; }} />
          </div>}
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={kind === "image" ? "上传参考图、输入文字或 @ 主体，描述你想生成的图片。" : kind === "video" ? "上传参考图或输入文字，描述你想生成的视频。" : kind === "music" ? "输入音乐风格、语言、情绪、乐器和 BPM 等要求。" : "输入需要生成的台词、声音或音频内容。"}
            className="min-h-28 flex-1 resize-none bg-transparent pt-2 text-sm leading-6 text-white/90 outline-none placeholder:text-white/25"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/65">
          <div className="relative">
            <button type="button" onClick={() => setOpenMenu(openMenu === "kind" ? null : "kind")} className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[#62c7f2] transition-colors hover:bg-white/5">
              <KindIcon size={16} />{selectedKind.label}<ChevronDown size={13} />
            </button>
            {openMenu === "kind" && <div className="absolute bottom-full left-0 z-30 mb-2 w-56 rounded-2xl border border-white/10 bg-[#262628] p-2 shadow-2xl">
              <p className="px-2 pb-2 pt-1 text-xs text-white/30">创作类型</p>
              {KIND_OPTIONS.map((item) => <button type="button" key={item.value} onClick={() => changeKind(item.value)} className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm ${kind === item.value ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"}`}>
                <item.icon size={17} /><span className="flex-1">{item.label}</span>{kind === item.value && <Check size={15} />}
              </button>)}
            </div>}
          </div>

          <div className="relative">
            <button type="button" onClick={() => setOpenMenu(openMenu === "model" ? null : "model")} className="flex h-8 max-w-64 cursor-pointer items-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-white/5 hover:text-white">
              <Box size={15} /><span className="truncate">{selectedModel?.name ?? (loaded ? "未配置模型" : "加载模型中…")}</span><ChevronDown size={13} />
            </button>
            {openMenu === "model" && <div className="absolute bottom-full left-0 z-30 mb-2 max-h-72 w-64 overflow-y-auto rounded-2xl border border-white/10 bg-[#262628] p-2 shadow-2xl">
              {availableModels.map((model) => <button type="button" key={model.id} onClick={() => { setModelId(model.id); setOpenMenu(null); }} className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs ${model.id === modelId ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5"}`}>
                <span className="min-w-0 flex-1 truncate">{model.name}</span>{model.id === modelId && <Check size={14} />}
              </button>)}
              {!availableModels.length && <p className="px-3 py-5 text-center text-xs text-white/35">暂无该类型的启用模型</p>}
            </div>}
          </div>

          {mediaKind && <div className="relative">
            <button type="button" onClick={() => setOpenMenu(openMenu === "settings" ? null : "settings")} className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-white/5 hover:text-white">
              <span>{config.ratio} · {config.resolution}{kind === "image" ? ` · ${config.count}张` : ` · ${config.duration}s`}</span><ChevronDown size={13} />
            </button>
            {openMenu === "settings" && <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-2xl border border-white/10 bg-[#262628] p-3 shadow-2xl">
              <p className="mb-2 text-white/35">画面比例</p>
              <div className="grid grid-cols-5 gap-1">{ratios.map((ratio) => <button type="button" key={ratio} onClick={() => setConfig((current) => ({ ...current, ratio }))} className={`cursor-pointer rounded-lg px-1 py-2 ${config.ratio === ratio ? "bg-white text-black" : "bg-white/5 hover:bg-white/10"}`}>{ratio}</button>)}</div>
              <p className="mb-2 mt-3 text-white/35">清晰度</p>
              <div className="flex gap-1">{resolutions.map((resolution) => <button type="button" key={resolution} onClick={() => setConfig((current) => ({ ...current, resolution }))} className={`flex-1 cursor-pointer rounded-lg px-2 py-2 ${config.resolution === resolution ? "bg-white text-black" : "bg-white/5 hover:bg-white/10"}`}>{resolution}</button>)}</div>
              {kind === "image" ? <>
                <p className="mb-2 mt-3 text-white/35">生成数量</p>
                <div className="flex gap-1">{counts.map((count) => <button type="button" key={count} onClick={() => setConfig((current) => ({ ...current, count }))} className={`flex-1 cursor-pointer rounded-lg px-2 py-2 ${config.count === count ? "bg-white text-black" : "bg-white/5 hover:bg-white/10"}`}>{count}张</button>)}</div>
              </> : <>
                <p className="mb-2 mt-3 text-white/35">视频时长</p>
                <div className="flex gap-1">{durations.map((duration) => <button type="button" key={duration} onClick={() => setConfig((current) => ({ ...current, duration }))} className={`flex-1 cursor-pointer rounded-lg px-2 py-2 ${config.duration === duration ? "bg-white text-black" : "bg-white/5 hover:bg-white/10"}`}>{duration}s</button>)}</div>
              </>}
            </div>}
          </div>}

          {kind === "music" && <span className="flex h-8 items-center gap-1.5 px-2"><Clock3 size={15} />智能时长</span>}
          {kind === "audio" && modelParams?.formats?.[0] && <span className="flex h-8 items-center px-2 uppercase">{modelParams.formats[0]}</span>}

          <button type="button" aria-label="提交生成" disabled={!prompt.trim() || submitting || uploading} onClick={() => void submit()} className="ml-auto flex size-10 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30">
            {submitting ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowUp size={19} />}
          </button>
        </div>
      </div>
      {(error || (loaded && !selectedModel)) && <p className="mt-2 px-3 text-xs text-red-300/80">{error || "请先在模型配置中添加并启用对应模型"}</p>}
    </div>
  );
}
