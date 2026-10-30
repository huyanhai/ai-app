"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Aperture,
  ArrowDownToLine,
  Box,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Cuboid,
  Download,
  Eye,
  EyeOff,
  Film,
  Focus,
  HelpCircle,
  List,
  Lock,
  Maximize2,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Move3D,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  Repeat,
  Rotate3D,
  RotateCcw,
  Save,
  Scaling,
  Search,
  SlidersHorizontal,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { ColorField, NumberField, StageModal, Toggle } from "./controls";
import { IconButton } from "@/components/ui/icon-button";
import { AssetPanel } from "./asset-panel";
import { StageScene } from "./scene";
import { DEFAULT_OBJECTS, DEFAULT_SETTINGS, LightSettings, Shot, StageObject, StageSettings, StageTool } from "./types";

const ENVIRONMENTS = ["影棚", "城市", "自然", "纯黑"];
const getCharacterModelUrl = (name = "") => name.includes("女性") ? "/stage/models/xbot.fbx" : "/stage/models/ybot.fbx";
const TOOL_ITEMS: { id: StageTool; label: string; key: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "选择", key: "0", icon: MousePointer2 },
  { id: "translate", label: "移动", key: "1", icon: Move3D },
  { id: "rotate", label: "旋转", key: "2", icon: Rotate3D },
  { id: "scale", label: "缩放", key: "3", icon: Scaling },
];

export default function DirectorStage({ nodeId }: { nodeId: string }) {
  const router = useRouter();
  const storageKey = `director-stage:${nodeId}`;
  const [settings, setSettings] = useState<StageSettings>(DEFAULT_SETTINGS);
  const [objects, setObjects] = useState<StageObject[]>(DEFAULT_OBJECTS);
  const [selectedId, setSelectedId] = useState("");
  const [tool, setTool] = useState<StageTool>("translate");
  const [mode, setMode] = useState<"static" | "dynamic">("static");
  const [dirty, setDirty] = useState(false);
  const [rightPanel, setRightPanel] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewSize, setPreviewSize] = useState(320);
  const [splitPreview, setSplitPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({ camera: true, character: true, prop: true });
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<{ type: StageObject["type"]; name: string } | null>(null);
  const [shotsOpen, setShotsOpen] = useState(false);
  const [objectMenuOpen, setObjectMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(20);
  const [frameRate, setFrameRate] = useState(30);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState("");
  const staticSnapshot = useRef<{ settings: StageSettings; objects: StageObject[] } | null>(null);

  const selectedObject = objects.find((object) => object.id === selectedId);
  const cameras = objects.filter((object) => object.type === "camera" && object.name.includes(search));
  const characters = objects.filter((object) => object.type === "character" && object.name.includes(search));
  const props = objects.filter((object) => object.type === "prop" && object.name.includes(search));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.objects) && data.objects.length) {
          setObjects(data.objects.map((object: StageObject) => {
            const presetModel = !object.modelUrl || ["/stage/models/xbot.fbx", "/stage/models/ybot.fbx"].includes(object.modelUrl);
            return object.type === "character" && presetModel
              ? { ...object, modelUrl: getCharacterModelUrl(object.name), modelFormat: "fbx" as const }
              : object;
          }));
          setSelectedId("");
        }
        if (Array.isArray(data.shots)) setShots(data.shots);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setCurrentTime((time) => {
        const next = time + 0.05;
        if (next < duration) return next;
        if (loop) return 0;
        setPlaying(false);
        return duration;
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [duration, loop, playing]);

  const updateSettings = useCallback((patch: Partial<StageSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setDirty(true);
  }, []);

  const updateLight = (key: "mainLight" | "fillLight" | "rimLight", patch: Partial<LightSettings>) => {
    setSettings((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    setDirty(true);
  };

  const updateObject = useCallback((id: string, next: StageObject) => {
    setObjects((current) => current.map((object) => object.id === id ? next : object));
    setDirty(true);
  }, []);

  const patchObject = (patch: Partial<StageObject>) => {
    if (!selectedObject) return;
    updateObject(selectedObject.id, { ...selectedObject, ...patch });
  };

  const dropToGround = useCallback(() => {
    if (!selectedObject || selectedObject.locked) return;
    updateObject(selectedObject.id, {
      ...selectedObject,
      position: [selectedObject.position[0], selectedObject.type === "camera" ? 0.85 : 0, selectedObject.position[2]],
    });
  }, [selectedObject, updateObject]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      const item = TOOL_ITEMS.find((toolItem) => toolItem.key === event.key);
      if (item) setTool(item.id);
      if (event.key.toLowerCase() === "g") dropToGround();
      if (event.code === "Space" && mode === "dynamic" && shots.length) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dropToGround, mode, shots.length]);

  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ settings, objects, shots }));
      setDirty(false);
      setToast("场景已保存到本地");
    } catch {
      setToast("本地空间不足，请减少镜头素材后重试");
    }
  };

  const captureShot = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".stage-preview-canvas canvas") ?? document.querySelector<HTMLCanvasElement>(".stage-main-canvas canvas");
    if (!canvas) return;
    const shot: Shot = {
      id: `shot-${Date.now()}`,
      name: `镜头 ${shots.length + 1}`,
      image: canvas.toDataURL("image/png"),
      duration: 5,
    };
    setShots((current) => [...current, shot]);
    setDirty(true);
    setToast("已添加到镜头素材");
  }, [shots.length]);

  const addObject = (type: StageObject["type"], name?: string, groundPosition?: [number, number, number]) => {
    const count = objects.filter((object) => object.type === type).length + 1;
    const object: StageObject = {
      id: `${type}-${Date.now()}`,
      type,
      name: name ?? (type === "camera" ? `机位 ${count}` : type === "character" ? `角色 ${count}` : `物体 ${count}`),
      position: groundPosition ? [groundPosition[0], type === "camera" ? 1.6 : 0, groundPosition[2]] : [type === "camera" ? 0 : (count - 1) * 1.5, type === "camera" ? 1.6 : 0, type === "camera" ? 4 : 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      locked: false,
      ...(type === "character" ? { modelUrl: getCharacterModelUrl(name), modelFormat: "fbx" as const } : {}),
    };
    setObjects((current) => [...current, object]);
    setSelectedId(object.id);
    setDirty(true);
  };

  const importModel = (file: File, type: "character" | "prop") => {
    const modelFormat = file.name.toLowerCase().endsWith(".fbx") ? "fbx" : file.name.toLowerCase().endsWith(".gltf") ? "gltf" : "glb";
    const object: StageObject = {
      id: `${type}-${Date.now()}`,
      type,
      name: file.name.replace(/\.(fbx|glb|gltf)$/i, ""),
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      locked: false,
      modelUrl: URL.createObjectURL(file),
      modelFormat,
    };
    setObjects((current) => [...current, object]);
    setSelectedId(object.id);
    setPendingAsset(null);
    setAssetsOpen(false);
    setDirty(true);
    setToast("模型已导入，当前会话可用");
  };

  const duplicateObject = () => {
    if (!selectedObject) return;
    const copy = { ...selectedObject, id: `${selectedObject.type}-${Date.now()}`, name: `${selectedObject.name} 副本`, locked: false };
    setObjects((current) => [...current, copy]);
    setSelectedId(copy.id);
    setObjectMenuOpen(false);
    setDirty(true);
  };

  const deleteObject = () => {
    if (!selectedObject || objects.length === 1) return;
    const remaining = objects.filter((object) => object.id !== selectedObject.id);
    setObjects(remaining);
    setSelectedId(remaining[0].id);
    setObjectMenuOpen(false);
    setDirty(true);
  };

  const exportVideo = () => {
    const canvas = document.querySelector<HTMLCanvasElement>(".stage-main-canvas canvas");
    if (!canvas || typeof MediaRecorder === "undefined") {
      setToast("当前浏览器不支持视频导出");
      return;
    }
    setMode("dynamic");
    setCurrentTime(0);
    setPlaying(true);
    setExporting(true);
    const stream = canvas.captureStream(frameRate);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `导演台-${nodeId}.webm`;
      link.click();
      URL.revokeObjectURL(url);
      stream.getTracks().forEach((track) => track.stop());
      setPlaying(false);
      setExporting(false);
      setToast("视频已导出");
    };
    recorder.start();
    window.setTimeout(() => recorder.stop(), Math.min(duration, 20) * 1000);
  };

  const switchMode = (overwriteScene: boolean) => {
    if (!overwriteScene) {
      setObjects(DEFAULT_OBJECTS);
      setSelectedId("");
    }
    setMode("dynamic");
    setSwitchOpen(false);
    setOverwrite(false);
    setDirty(true);
  };

  const changeMode = (nextMode: "static" | "dynamic") => {
    if (nextMode === "dynamic" && mode === "static") {
      staticSnapshot.current = { settings, objects };
      setSwitchOpen(true);
      return;
    }
    setPlaying(false);
    setMode(nextMode);
    if (nextMode === "static" && staticSnapshot.current) {
      setSettings(staticSnapshot.current.settings);
      setObjects(staticSnapshot.current.objects);
      setSelectedId("");
    }
  };

  const scene = (
    <StageScene
      settings={settings}
      objects={objects}
      selectedId={selectedId}
      tool={tool}
      playing={playing}
      currentTime={currentTime}
      resetKey={resetKey}
      focusKey={focusKey}
      bottomOffset={mode === "dynamic" && timelineOpen ? 220 : 0}
      placing={Boolean(pendingAsset)}
      onSelect={setSelectedId}
      onTransform={updateObject}
      onPlace={(position) => {
        if (!pendingAsset) return;
        addObject(pendingAsset.type, pendingAsset.name, position);
        setPendingAsset(null);
      }}
    />
  );

  const renderObjectGroup = (type: StageObject["type"], label: string, items: StageObject[]) => {
    if (!items.length) return null;
    return (
      <div className="px-2">
        <button type="button" className="flex h-10 w-full items-center gap-2 px-1 text-xs text-white/75" onClick={() => setExpanded((current) => ({ ...current, [type]: !current[type] }))}>
          {expanded[type] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {type === "camera" ? <Camera size={14} /> : <Box size={14} />}
          <span>{label}</span>
          <span className="ml-auto text-white/35">{items.length}</span>
        </button>
        {expanded[type] && items.map((object) => (
          <div key={object.id} role="button" tabIndex={0} onClick={() => setSelectedId(object.id)} onKeyDown={(event) => event.key === "Enter" && setSelectedId(object.id)} className={`group flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-xs ${selectedId === object.id ? "bg-white/8 text-white" : "text-white/50 hover:bg-white/5"}`}>
            <ChevronRight size={11} className="text-white/25" />
            {type === "camera" ? <Camera size={13} /> : <Box size={13} />}
            <span className="truncate">{object.name}</span>
            <div className="ml-auto flex items-center">
              <IconButton label={object.locked ? "解锁对象" : "锁定对象"} className="size-6 opacity-0 group-hover:opacity-100" onClick={() => updateObject(object.id, { ...object, locked: !object.locked })}>
                {object.locked ? <Lock size={12} className="opacity-100" /> : <Unlock size={12} />}
              </IconButton>
              <IconButton label={`聚焦选中对象 ${object.name}`} className="size-6 opacity-0 group-hover:opacity-100" onClick={() => { setSelectedId(object.id); setFocusKey((key) => key + 1); }}>
                <Focus size={12} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const timelineMarks = useMemo(() => Array.from({ length: 11 }, (_, index) => index * duration / 10), [duration]);

  return (
    <main className="flex h-full min-h-[560px] w-full flex-col overflow-hidden bg-[#111] text-white select-none">
      <header className="relative z-30 flex h-13 shrink-0 items-center border-b border-white/5 bg-[#1b1b1b] px-3">
        <div className="flex items-center gap-2 text-xs font-medium"><span>3D导演台</span><IconButton label="快捷键" onClick={() => setShortcutsOpen(true)}><HelpCircle size={15} /></IconButton><IconButton label="保存" onClick={save}><Save size={15} /></IconButton><span className="text-[10px] text-white/30">{dirty ? "未保存" : "已保存"}</span></div>
        <div role="tablist" aria-label="3D导演台" className="absolute left-1/2 flex -translate-x-1/2 rounded-lg bg-black/25 p-1">
          {(["static", "dynamic"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => changeMode(item)} className={`rounded-md px-4 py-1.5 text-xs ${mode === item ? "bg-white/10 text-white" : "text-white/35 hover:text-white/70"}`}>{item === "static" ? "静态预演" : "动态预演"}</button>)}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {mode === "dynamic" && <button type="button" disabled={exporting} onClick={exportVideo} className="mr-1 flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-white/60 hover:bg-white/8 hover:text-white disabled:opacity-40"><Download size={14} />{exporting ? "导出中" : "导出视频"}</button>}
          <IconButton label="拍摄" onClick={captureShot}><Camera size={16} /></IconButton>
          <IconButton label="镜头素材" active={shotsOpen} onClick={() => { setShotsOpen((open) => !open); setAssetsOpen(false); }}><Film size={16} /></IconButton>
          <IconButton label="返回画布" onClick={() => router.push("/pipeline")}><X size={17} /></IconButton>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {assetsOpen && <AssetPanel onClose={() => { setAssetsOpen(false); setPendingAsset(null); }} onAdd={(type, name) => setPendingAsset({ type, name })} onImport={importModel} onEnvironment={(environment) => { const presets: Record<string, Partial<StageSettings>> = { 影棚: { backgroundColor: "#171717", groundColor: "#242424", environment }, 城市: { backgroundColor: "#202833", groundColor: "#30343a", environment }, 自然: { backgroundColor: "#26322d", groundColor: "#303b32", environment }, 纯黑: { backgroundColor: "#000000", groundColor: "#080808", environment } }; updateSettings(presets[environment]); }} />}
        <section aria-label="3D viewport" className="relative min-w-0 flex-1 overflow-hidden">
          <div className="absolute inset-0">{scene}</div>

          <nav aria-label="对象" className="absolute left-3 top-3 z-20 flex flex-col items-center gap-2">
            <button type="button" aria-label="资产" onClick={() => { setAssetsOpen((open) => !open); setPendingAsset(null); setShotsOpen(false); }} className={`group relative flex size-11 items-center justify-center rounded-lg border text-xs shadow-lg ${assetsOpen ? "border-white/25 bg-[#303030] text-white" : "border-white/10 bg-[#202020]/95 text-white/65"}`}><Cuboid size={18} /><span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#2b2b2b] px-2.5 py-1.5 text-[11px] text-white/85 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">资产</span></button>
            <div className="flex w-11 flex-col items-center gap-2 rounded-lg border border-white/10 bg-[#202020]/95 p-1 shadow-lg">
              {TOOL_ITEMS.map((item) => { const Icon = item.icon; return <IconButton key={item.id} label={`${item.label} · ${item.key}`} tooltipPosition="right" active={tool === item.id} onClick={() => setTool(item.id)}><Icon size={17} /></IconButton>; })}
              <IconButton label="落到地面 · G" tooltipPosition="right" disabled={!selectedObject || selectedObject.locked} onClick={dropToGround}><ArrowDownToLine size={17} /></IconButton>
              <div className="my-1 h-px w-full bg-white/8" />
              <IconButton label="视图设置" tooltipPosition="right" active={viewMenuOpen} onClick={() => setViewMenuOpen((open) => !open)}><Eye size={17} /></IconButton>
            </div>
          </nav>

          {pendingAsset && <div className="absolute left-1/2 top-4 z-40 flex min-w-[320px] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#202020]/95 px-4 py-3 shadow-2xl"><Focus size={22} className="text-white/75" /><div><div className="text-xs font-medium">放置 {pendingAsset.name}</div><div className="mt-1 text-[10px] text-white/40">点击地面放置对象</div></div><button type="button" aria-label="取消放置" onClick={() => setPendingAsset(null)} className="ml-auto flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 text-xs text-white/65 hover:bg-white/8"><X size={13} />取消</button></div>}

          {viewMenuOpen && <div className="absolute left-16 top-[290px] z-30 w-40 rounded-lg border border-white/10 bg-[#252525] p-2 shadow-xl"><Toggle label="显示网格" checked={settings.showGrid} onChange={(showGrid) => updateSettings({ showGrid })} /><Toggle label="显示地面" checked={settings.showGround} onChange={(showGround) => updateSettings({ showGround })} /><button type="button" className="mt-1 w-full rounded-md px-2 py-2 text-left text-xs text-white/55 hover:bg-white/8" onClick={() => { setResetKey((key) => key + 1); setViewMenuOpen(false); }}>重置导演视角</button></div>}

          {previewOpen ? <div className={`absolute z-10 overflow-hidden rounded-xl border border-white/20 bg-black shadow-xl transition-all ${splitPreview ? "bottom-4 right-4 top-4" : "right-4 top-4"}`} style={splitPreview ? { width: "42%" } : { width: previewSize, height: previewSize * 0.59 }}>
            <div className="absolute inset-0"><StageScene settings={settings} objects={objects} selectedId={selectedId} tool={tool} preview playing={playing} currentTime={currentTime} /></div>
            <div className="absolute left-3 top-3 flex h-8 items-center gap-2 rounded-md border border-white/10 bg-[#202020]/90 px-2 text-xs"><MoreHorizontal size={14} className="text-white/40" /><Aperture size={13} /><span>机位</span><ChevronDown size={12} className="text-white/40" /></div>
            <IconButton label="收起机位预览" className="absolute right-3 top-3 bg-[#202020]/90" onClick={() => setPreviewOpen(false)}><ChevronDown size={15} /></IconButton>
            <button type="button" onClick={() => setSplitPreview((split) => !split)} className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] text-white/45 hover:text-white">分屏预览<Maximize2 size={11} /></button>
            <span className="absolute bottom-3 left-3 text-lg text-white/55">L</span>
            {!splitPreview && <input aria-label="拖动调整预览大小" type="range" min="240" max="480" value={previewSize} onChange={(event) => setPreviewSize(Number(event.target.value))} className="absolute bottom-1 left-1/2 h-1 w-20 -translate-x-1/2 accent-white/50" />}
          </div> : <button type="button" className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-[#202020] px-3 py-2 text-xs text-white/60" onClick={() => setPreviewOpen(true)}><Aperture size={14} />机位预览</button>}

          <div className={`absolute left-1/2 z-30 -translate-x-1/2 ${mode === "dynamic" && timelineOpen ? "bottom-[235px]" : "bottom-5"}`}><button type="button" className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#202020]/90 px-4 py-2 text-xs text-white/70" onClick={() => setResetKey((key) => key + 1)}><Aperture size={14} />导演视角<ChevronDown size={12} /></button></div>
          <div className={`absolute right-4 z-30 flex flex-col items-end gap-2 ${mode === "dynamic" && timelineOpen ? "bottom-[235px]" : "bottom-5"}`}><span className="text-[9px] text-white/40">FOV 50°</span><button type="button" className="flex items-center gap-1.5 rounded-md bg-[#202020]/90 px-2.5 py-1.5 text-[10px] text-white/60" onClick={() => setResetKey((key) => key + 1)}><RotateCcw size={12} />重置视角</button></div>
          <div className={`absolute right-3 z-30 ${mode === "dynamic" && timelineOpen ? "bottom-[305px]" : "bottom-20"}`}><IconButton label="对象操作" className="bg-[#202020]/90" onClick={() => setObjectMenuOpen((open) => !open)}><MoreHorizontal size={17} /></IconButton></div>

          {objectMenuOpen && <div className="absolute bottom-20 right-3 z-30 w-36 rounded-lg border border-white/10 bg-[#252525] p-1.5 shadow-xl"><button type="button" disabled={!selectedObject} onClick={duplicateObject} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-white/60 hover:bg-white/8 disabled:opacity-30"><Copy size={13} />复制对象</button><button type="button" disabled={!selectedObject || objects.length === 1} onClick={deleteObject} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-red-300/70 hover:bg-white/8 disabled:opacity-30"><Trash2 size={13} />删除对象</button></div>}

          {mode === "dynamic" && <section aria-label="时间轴" className={`absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#1c1c1c] transition-all ${timelineOpen ? "h-[220px]" : "h-10"}`}>
            <div className="flex h-10 items-center gap-1 border-b border-white/5 px-3"><button type="button" className="mr-2 flex items-center gap-1 text-xs text-white/60" onClick={() => setTimelineOpen((open) => !open)}><ChevronDown size={13} className={timelineOpen ? "" : "rotate-180"} />时间轴</button><IconButton label={playing ? "暂停" : "播放"} disabled={!shots.length || exporting} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={14} /> : <Play size={14} />}</IconButton><IconButton label="循环播放时间轴" active={loop} onClick={() => setLoop((value) => !value)}><Repeat size={14} /></IconButton><IconButton label="隐藏无动画对象轨道" active={hideEmpty} onClick={() => setHideEmpty((value) => !value)}>{hideEmpty ? <EyeOff size={14} /> : <Eye size={14} />}</IconButton><span className="ml-2 text-[10px] text-white/35">0:{currentTime.toFixed(2).padStart(5, "0")} · {Math.floor(currentTime * frameRate)}f / 0:{duration.toFixed(1)}</span><button type="button" className="ml-auto rounded px-2 py-1 text-[10px] text-white/45 hover:bg-white/5" onClick={() => setFrameRate((rate) => rate === 30 ? 60 : 30)}>帧率 {frameRate}</button><div className="w-32"><NumberField label="总时长" value={duration} min={1} max={120} step={1} suffix="秒" onChange={setDuration} /></div><IconButton label="时间轴缩放 −" onClick={() => setTimelineZoom((zoom) => Math.max(0.5, zoom - 0.25))}><Minus size={13} /></IconButton><input aria-label="时间轴缩放" type="range" min="0.5" max="3" step="0.25" value={timelineZoom} onChange={(event) => setTimelineZoom(Number(event.target.value))} className="w-20 accent-white" /><IconButton label="时间轴缩放 +" onClick={() => setTimelineZoom((zoom) => Math.min(3, zoom + 0.25))}><Plus size={13} /></IconButton><button type="button" className="text-[10px] text-white/40" onClick={() => setTimelineZoom(1)}>{timelineZoom}×</button></div>
            {timelineOpen && <div className="flex h-[180px]"><div className="w-44 shrink-0 border-r border-white/5 p-2"><div className="flex h-8 items-center gap-2 text-xs text-white/55"><ChevronDown size={12} /><Camera size={13} />机位<Plus size={12} className="ml-auto" /></div><div className="mt-2 border-t border-white/5 pt-3 text-xs text-white/45">分镜编排</div></div><div className="relative min-w-0 flex-1 overflow-hidden"><div className="flex h-8 items-end justify-between px-2 pb-1 text-[9px] text-white/30">{timelineMarks.map((mark) => <span key={mark}>{mark.toFixed(1)}s</span>)}</div><div className="relative mx-2 h-20 rounded bg-black/20"><div className="absolute inset-0 flex">{timelineMarks.map((mark) => <div key={mark} className="flex-1 border-l border-white/5" />)}</div>{shots.map((shot, index) => <button type="button" key={shot.id} className="absolute top-3 h-12 overflow-hidden rounded border border-blue-300/40 bg-blue-400/20 text-[9px] text-blue-100" style={{ left: `${index * 25 + 1}%`, width: "23%" }} onClick={() => setCurrentTime(index * shot.duration)}><img src={shot.image} alt="" className="h-full w-full object-cover opacity-60" /><span className="absolute inset-0 flex items-center justify-center">{shot.name}</span></button>)}<input aria-label="当前时间" type="range" min="0" max={duration} step="0.01" value={currentTime} onChange={(event) => setCurrentTime(Number(event.target.value))} className="absolute inset-x-0 top-0 h-16 w-full cursor-col-resize opacity-0" /><div className="pointer-events-none absolute bottom-0 top-0 w-px bg-red-400" style={{ left: `${currentTime / duration * 100}%` }} /></div><button type="button" onClick={captureShot} className="mt-3 flex items-center gap-1 rounded-md border border-dashed border-white/15 px-3 py-2 text-[10px] text-white/40 hover:border-white/30 hover:text-white"><Plus size={12} />{shots.length ? "添加分镜" : "选择机位并添加分镜"}</button></div></div>}
          </section>}
        </section>

        {rightPanel && <aside className="relative z-20 flex w-[300px] shrink-0 flex-col border-l border-white/5 bg-[#1b1b1b]">
          <section className="flex h-[38%] min-h-[205px] flex-col border-b-[5px] border-[#111]"><div className="flex h-12 shrink-0 items-center gap-2 px-3 text-xs font-medium"><List size={15} /><h2>对象</h2><IconButton label="收起对象与属性面板" className="ml-auto" onClick={() => setRightPanel(false)}><PanelRightClose size={14} /></IconButton></div><div className="mx-3 mb-2 flex h-9 items-center gap-2 rounded-md bg-white/[0.055] px-2"><Search size={14} className="text-white/30" /><input aria-label="搜索对象" placeholder="搜索对象" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-white/75 outline-none placeholder:text-white/25" /></div><div className="min-h-0 flex-1 overflow-y-auto">{renderObjectGroup("camera", "机位", cameras)}{renderObjectGroup("character", "角色", characters)}{renderObjectGroup("prop", "物体", props)}{!cameras.length && !characters.length && !props.length && <p className="py-8 text-center text-xs text-white/25">未找到对象</p>}</div></section>
          <section className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 [&_input[type=number]]:[font-variant-numeric:tabular-nums]"><div className="sticky top-0 z-10 flex h-12 items-center gap-2 bg-[#1b1b1b] text-xs font-medium"><SlidersHorizontal size={14} /><h2>属性</h2></div><div className="mb-2 flex items-center text-xs text-white/50"><span>环境预设</span><div className="relative ml-auto"><button type="button" aria-label="环境预设" className="flex h-8 w-32 items-center justify-between rounded-md bg-white/[0.045] px-2 text-white/65" onClick={() => setEnvironmentOpen((open) => !open)}>{settings.environment}<ChevronDown size={12} /></button>{environmentOpen && <div className="absolute right-0 top-9 z-30 w-32 rounded-md border border-white/10 bg-[#292929] p-1 shadow-xl">{ENVIRONMENTS.map((environment) => <button type="button" key={environment} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs text-white/60 hover:bg-white/8" onClick={() => { const presets: Record<string, Partial<StageSettings>> = { 影棚: { backgroundColor: "#171717", groundColor: "#242424", environment }, 城市: { backgroundColor: "#202833", groundColor: "#30343a", environment }, 自然: { backgroundColor: "#26322d", groundColor: "#303b32", environment }, 纯黑: { backgroundColor: "#000000", groundColor: "#080808", environment } }; updateSettings(presets[environment]); setEnvironmentOpen(false); }}>{environment}{settings.environment === environment && <Check size={12} />}</button>)}</div>}</div></div><ColorField label="背景颜色" value={settings.backgroundColor} onChange={(backgroundColor) => updateSettings({ backgroundColor })} /><ColorField label="地面颜色" value={settings.groundColor} onChange={(groundColor) => updateSettings({ groundColor })} /><Toggle label="显示地面" checked={settings.showGround} onChange={(showGround) => updateSettings({ showGround })} /><NumberField label="地面不透明度" value={settings.groundOpacity} min={0} max={100} step={1} suffix="%" onChange={(groundOpacity) => updateSettings({ groundOpacity })} /><NumberField label="曝光" value={settings.exposure} min={0} max={3} step={0.01} onChange={(exposure) => updateSettings({ exposure })} /><Toggle label="显示网格" checked={settings.showGrid} onChange={(showGrid) => updateSettings({ showGrid })} />
          <LightEditor title="主光" light={settings.mainLight} onChange={(patch) => updateLight("mainLight", patch)} main /><div className="my-3 h-px bg-white/5" /><LightEditor title="补光" light={settings.fillLight} onChange={(patch) => updateLight("fillLight", patch)} /><div className="my-3 h-px bg-white/5" /><LightEditor title="轮廓光" light={settings.rimLight} onChange={(patch) => updateLight("rimLight", patch)} />
          {selectedObject && <div className="mt-5 border-t border-white/8 pt-4"><h3 className="mb-3 text-xs text-white/75">{selectedObject.name} · 变换</h3><div className="space-y-2">{(["position", "rotation", "scale"] as const).map((key) => <div key={key} className="flex items-center gap-1 text-[10px] text-white/40"><span className="w-8">{key === "position" ? "位置" : key === "rotation" ? "旋转" : "缩放"}</span>{selectedObject[key].map((value, index) => <input key={index} aria-label={`${key} ${index}`} type="number" step={key === "rotation" ? 1 : 0.1} value={Number((key === "rotation" ? value * 180 / Math.PI : value).toFixed(2))} disabled={selectedObject.locked} onChange={(event) => { const values = [...selectedObject[key]] as [number, number, number]; values[index] = key === "rotation" ? Number(event.target.value) * Math.PI / 180 : Number(event.target.value); patchObject({ [key]: values }); }} className="h-8 min-w-0 flex-1 rounded bg-white/[0.045] px-1 text-center text-white/65 outline-none disabled:opacity-40" />)}</div>)}</div></div>}
          </section>
        </aside>}
        {!rightPanel && <IconButton label="展开对象与属性面板" className="absolute right-3 top-3 z-30 bg-[#202020]" onClick={() => setRightPanel(true)}><PanelRightOpen size={16} /></IconButton>}
      </div>

      {shotsOpen && <aside className="absolute right-3 top-16 z-40 w-72 rounded-xl border border-white/10 bg-[#242424] p-3 shadow-2xl"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xs"><Film size={14} />镜头素材</h2><IconButton label="关闭镜头素材" className="size-6" onClick={() => setShotsOpen(false)}><X size={13} /></IconButton></div>{shots.length ? <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto">{shots.map((shot, index) => <button type="button" key={shot.id} className="overflow-hidden rounded-lg border border-white/8 bg-black/20 text-left hover:border-white/25" onClick={() => { setCurrentTime(index * shot.duration); setMode("dynamic"); setShotsOpen(false); }}><img src={shot.image} alt={shot.name} className="aspect-video w-full object-cover" /><div className="flex justify-between p-2 text-[10px] text-white/50"><span>{shot.name}</span><span>{shot.duration}s</span></div></button>)}</div> : <div className="py-10 text-center text-xs text-white/30"><Camera size={24} className="mx-auto mb-3" />点击顶部拍摄按钮添加镜头</div>}<button type="button" onClick={captureShot} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-white/8 py-2 text-xs text-white/65 hover:bg-white/12"><Plus size={13} />拍摄当前机位</button></aside>}

      {switchOpen && <StageModal title="将静态预演场景应用于动态预演？" onClose={() => { setSwitchOpen(false); setOverwrite(false); }}><p className="text-xs leading-6 text-white/45">复制静态预演中的内容，保留演出时间轴，不复制角色姿势。时间轴中的角色须仍在静态预演中。</p><label className="my-5 flex cursor-pointer items-center gap-2 text-xs text-white/65"><input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} className="accent-white" />确认覆盖动态预演场景</label><div className="flex justify-end gap-2"><button type="button" className="rounded-md px-3 py-2 text-xs text-white/55 hover:bg-white/8" onClick={() => switchMode(false)}>不同步，直接切换</button><button type="button" disabled={!overwrite} className="rounded-md bg-white px-3 py-2 text-xs text-black disabled:opacity-25" onClick={() => switchMode(true)}>覆盖并切换</button></div></StageModal>}
      {shortcutsOpen && <StageModal title="快捷键" onClose={() => setShortcutsOpen(false)}><div className="space-y-1">{[...TOOL_ITEMS.map((item) => [item.label, item.key]), ["落到地面", "G"], ["播放 / 暂停", "Space"]].map(([label, key]) => <div key={label} className="flex items-center justify-between border-b border-white/5 py-3 text-xs text-white/55"><span>{label}</span><kbd className="rounded border border-white/10 bg-black/20 px-2 py-1 text-white/75">{key}</kbd></div>)}</div></StageModal>}
      {toast && <div role="status" className="absolute bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-white/10 bg-[#2b2b2b] px-4 py-2.5 text-xs text-white/75 shadow-xl">{toast}</div>}
    </main>
  );
}

function LightEditor({ title, light, onChange, main = false }: { title: string; light: LightSettings; onChange: (patch: Partial<LightSettings>) => void; main?: boolean }) {
  return <section><h3 className="mb-2 mt-4 text-xs font-medium text-white/75">{title}</h3><ColorField label="灯光颜色" value={light.color} onChange={(color) => onChange({ color })} /><NumberField label="强度" value={light.intensity} min={0} max={20} step={0.1} onChange={(intensity) => onChange({ intensity })} />{main && <><NumberField label="水平角度" value={light.horizontal ?? 0} min={-180} max={180} step={1} suffix="°" onChange={(horizontal) => onChange({ horizontal })} /><NumberField label="仰角" value={light.elevation ?? 0} min={0} max={90} step={1} suffix="°" onChange={(elevation) => onChange({ elevation })} /><Toggle label="阴影" checked={light.shadow ?? true} onChange={(shadow) => onChange({ shadow })} /></>}</section>;
}
