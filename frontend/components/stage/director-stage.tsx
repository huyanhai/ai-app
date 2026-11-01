"use client";

import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
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
  Film,
  Focus,
  HelpCircle,
  List,
  Lock,
  Maximize2,
  MoreHorizontal,
  MousePointer2,
  Move3D,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Rotate3D,
  RotateCcw,
  Route,
  Save,
  Scaling,
  Search,
  SlidersHorizontal,
  Trash2,
  Unlock,
  Undo2,
  X,
} from "lucide-react";
import { ColorField, NumberField, NumericInput, StageModal, Toggle } from "./controls";
import { IconButton } from "@/components/ui/icon-button";
import { AssetPanel } from "./asset-panel";
import { ActionPanel, ActionPreset } from "./action-panel";
import { StageScene } from "./scene";
import { StageTimeline } from "./timeline";
import { PosePanel } from "./pose-panel";
import { CameraPanel } from "./camera-panel";
import { CharacterPanel } from "./character-panel";
import { CameraPresetDialog, CameraPresetWizard } from "./camera-preset-panel";
import { applyCameraPresetResult, CameraPresetDefinition, CameraPresetDraft, createCameraPresetResult } from "./camera-presets";
import { getCharacterValue } from "./character";
import { bakeCharacterPose } from "./motion";
import { createBezierPath, getCameraPathOrigin, getCameraValue, hasCameraKeyframe } from "./camera";
import { CameraProperty, CharacterKeyframe, CharacterProperty, DEFAULT_OBJECTS, DEFAULT_SETTINGS, LightSettings, Shot, StageObject, StagePoint, StageSettings, StageTool } from "./types";

const ENVIRONMENTS = ["影棚", "城市", "自然", "纯黑"];
const getCharacterModelUrl = (name = "") => name.includes("女性") ? "/stage/models/xbot.fbx" : "/stage/models/ybot.fbx";
const getCharacterPosition = (object: StageObject, time: number): StagePoint => {
  const action = object.actions?.findLast((item) => time >= item.start && time <= item.start + item.duration);
  if (!action || action.kind === "action" || !object.path) return object.position;
  const curve = createBezierPath([object.pathOrigin ?? object.position, ...object.path]);
  if (!curve) return object.position;
  const point = curve.getPoint(Math.min(1, Math.max(0, (time - action.start) / action.duration)));
  return [point.x, point.y, point.z];
};
const withCharacterPositionKeyframes = (object: StageObject, frames: CharacterKeyframe[]): StageObject => {
  const pathPatch: Partial<StageObject> = {};
  if (object.path !== undefined || object.pathOrigin !== undefined) {
    const pathFrames = object.pathActionId ? frames.filter((frame) => frame.actionId === object.pathActionId) : frames;
    const points = pathFrames.map((frame) => frame.value);
    pathPatch.pathOrigin = points[0];
    pathPatch.path = points.length ? points.slice(1) : undefined;
    if (!points.length) pathPatch.pathActionId = undefined;
  }
  return { ...object, characterKeyframes: { ...object.characterKeyframes, position: frames }, ...pathPatch };
};
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
  const [actionObjectId, setActionObjectId] = useState<string | null>(null);
  const [propertyTab, setPropertyTab] = useState<"object" | "pose">("object");
  const [selectedBone, setSelectedBone] = useState<string>();
  const [pathDraft, setPathDraft] = useState<{ objectId: string; kind: "character" | "camera" | "target"; origin: StagePoint; points: StagePoint[]; redo: StagePoint[] } | null>(null);
  const [pathActionOpen, setPathActionOpen] = useState(false);
  const [cameraPresetCameraId, setCameraPresetCameraId] = useState<string | null>(null);
  const [cameraPresetDraft, setCameraPresetDraft] = useState<CameraPresetDraft | null>(null);
  const [cameraPresetTime, setCameraPresetTime] = useState(0);
  const [freeCameraMovement, setFreeCameraMovement] = useState(false);
  const [showPath, setShowPath] = useState(true);
  const [shots, setShots] = useState<Shot[]>([]);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(20);
  const [frameRate, setFrameRate] = useState(30);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [timelineHeight, setTimelineHeight] = useState(300);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState("");
  const staticSnapshot = useRef<{ settings: StageSettings; objects: StageObject[] } | null>(null);
  const timelineResize = useRef<{ startY: number; startHeight: number } | null>(null);

  const selectedObject = objects.find((object) => object.id === selectedId);
  const rotationLocked = selectedObject?.type === "character" && selectedObject.pathAutoRotate;
  const cameras = objects.filter((object) => object.type === "camera" && object.name.includes(search));
  const characters = objects.filter((object) => object.type === "character" && object.name.includes(search));
  const props = objects.filter((object) => object.type === "prop" && object.name.includes(search));
  const hasCharacterActions = objects.some((object) => object.actions?.length);
  const hasCameraMovement = objects.some((object) => Object.values(object.cameraKeyframes ?? {}).some((frames) => frames?.length));
  const keyframeTime = Math.round(currentTime * frameRate) / frameRate;
  const cameraPresetCamera = objects.find((object) => object.id === cameraPresetDraft?.cameraId && object.type === "camera");
  const cameraPresetResult = cameraPresetCamera && cameraPresetDraft ? createCameraPresetResult(cameraPresetCamera, cameraPresetDraft, frameRate) : null;
  const cameraPresetObjects = cameraPresetCamera && cameraPresetResult ? objects.map((object) => object.id === cameraPresetCamera.id ? applyCameraPresetResult(object, cameraPresetResult) : object) : objects;
  const sceneObjects = cameraPresetDraft?.step === 3 ? cameraPresetObjects : objects;
  const sceneTime = cameraPresetDraft?.step === 3 ? cameraPresetTime : currentTime;

  useEffect(() => {
    setSelectedBone(undefined);
    if (mode !== "static" || selectedObject?.type !== "character") setPropertyTab("object");
  }, [mode, selectedId, selectedObject?.type]);

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

  useEffect(() => {
    if (cameraPresetDraft?.step !== 3) return;
    const start = cameraPresetDraft.start;
    const end = start + cameraPresetDraft.duration;
    setCameraPresetTime(start);
    const timer = window.setInterval(() => {
      setCameraPresetTime((time) => time + 0.05 >= end ? start : time + 0.05);
    }, 50);
    return () => window.clearInterval(timer);
  }, [cameraPresetDraft?.step, cameraPresetDraft?.start, cameraPresetDraft?.duration]);

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
      if (item && (item.id !== "rotate" || !rotationLocked)) setTool(item.id);
      if (event.key.toLowerCase() === "g") dropToGround();
      if (event.code === "Space" && mode === "dynamic" && (shots.length || hasCharacterActions || hasCameraMovement)) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
      if (event.key === "Escape") {
        setPathDraft(null);
        setPathActionOpen(false);
        setActionObjectId(null);
        setFreeCameraMovement(false);
        setCameraPresetDraft(null);
        setCameraPresetCameraId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dropToGround, hasCameraMovement, hasCharacterActions, mode, rotationLocked, shots.length]);

  const startPath = (objectId: string) => {
    const object = objects.find((item) => item.id === objectId);
    if (!object) return;
    setSelectedId(objectId);
    setPendingAsset(null);
    setPathDraft({ objectId, kind: "character", origin: object.pathOrigin ?? object.position, points: object.path ?? [], redo: [] });
    setShowPath(true);
  };

  const startCameraPath = (objectId: string, kind: "camera" | "target") => {
    const object = objects.find((item) => item.id === objectId && item.type === "camera");
    if (!object) return;
    setFreeCameraMovement(false);
    setSelectedId(objectId);
    const savedOrigin = kind === "camera" ? object.cameraPathOrigin : object.targetPathOrigin;
    setPathDraft({ objectId, kind, origin: savedOrigin ?? getCameraPathOrigin(object, kind, currentTime), points: (kind === "camera" ? object.cameraPath : object.targetPath) ?? [], redo: [] });
    setShowPath(true);
  };

  const openCameraPresets = (objectId: string) => {
    setSelectedId(objectId);
    setCameraPresetCameraId(objectId);
    setPreviewOpen(true);
    setPlaying(false);
  };

  const startCameraPreset = (preset: CameraPresetDefinition) => {
    const camera = objects.find((object) => object.id === cameraPresetCameraId && object.type === "camera");
    if (!camera) return;
    const position = getCameraValue(camera, "position", currentTime) as StagePoint;
    const target = getCameraValue(camera, "target", currentTime) as StagePoint;
    const distance = Math.max(1, Math.hypot(position[0] - target[0], position[2] - target[2]));
    setCameraPresetDraft({
      cameraId: camera.id,
      preset,
      step: 1,
      position,
      target,
      angle: Math.atan2(position[0] - target[0], position[2] - target[2]),
      distance,
      start: keyframeTime,
      duration: 3,
      amplitude: 1,
      placingTarget: false,
    });
    setCameraPresetCameraId(null);
    setPathDraft(null);
    setPendingAsset(null);
    setPreviewOpen(true);
  };

  const updateCameraPreset = (patch: Partial<CameraPresetDraft>) => {
    setCameraPresetDraft((current) => current ? { ...current, ...patch } : current);
  };

  const applyCameraPreset = () => {
    if (!cameraPresetCamera || !cameraPresetResult || !cameraPresetDraft) return;
    updateObject(cameraPresetCamera.id, applyCameraPresetResult(cameraPresetCamera, cameraPresetResult));
    setDuration((current) => Math.max(current, cameraPresetResult.end));
    setCurrentTime(cameraPresetDraft.start);
    setSelectedId(cameraPresetCamera.id);
    setCameraPresetDraft(null);
    setToast(`已添加运镜：${cameraPresetDraft.preset.name}`);
  };

  const startCustomCameraMovement = (kind: "camera" | "target" | "free") => {
    if (!cameraPresetCameraId) return;
    const cameraId = cameraPresetCameraId;
    setCameraPresetCameraId(null);
    startCameraPath(cameraId, kind === "camera" ? "camera" : "target");
    setFreeCameraMovement(kind === "free");
  };

  const finishCameraPath = () => {
    if (!pathDraft || pathDraft.kind === "character") return;
    const object = objects.find((item) => item.id === pathDraft.objectId);
    if (!object) return;
    const property = pathDraft.kind === "target" ? "target" : "position";
    const origin = pathDraft.origin;
    const interval = Math.round(1.5 * frameRate) / frameRate;
    const frames = [origin, ...pathDraft.points].map((value, index) => ({
      time: Math.round((keyframeTime + index * interval) * frameRate) / frameRate,
      value,
    }));
    const frameTimes = new Set(frames.map((frame) => frame.time));
    const existingFrames = object.cameraKeyframes?.[property] ?? [];
    updateObject(object.id, {
      ...object,
      ...(property === "target" ? { targetPath: pathDraft.points, targetPathOrigin: origin } : { cameraPath: pathDraft.points, cameraPathOrigin: origin }),
      cameraKeyframes: {
        ...object.cameraKeyframes,
        [property]: [...existingFrames.filter((frame) => !frameTimes.has(frame.time)), ...frames].sort((a, b) => a.time - b.time),
      },
    });
    setDuration((current) => Math.max(current, frames[frames.length - 1].time));
    if (freeCameraMovement && property === "target") {
      setPathDraft({ objectId: object.id, kind: "camera", origin: getCameraPathOrigin(object, "camera", currentTime), points: object.cameraPath ?? [], redo: [] });
      setToast("注视点路径已生成，请继续绘制机位路径");
      return;
    }
    setFreeCameraMovement(false);
    setPathDraft(null);
    setToast(property === "target" ? "已生成注视点路径关键帧" : "已生成机位路径关键帧");
  };

  const toggleCameraKeyframe = (objectId: string, property: CameraProperty) => {
    const object = objects.find((item) => item.id === objectId && item.type === "camera");
    if (!object) return;
    const frames = object.cameraKeyframes?.[property] ?? [];
    const exists = hasCameraKeyframe(object, property, keyframeTime);
    const nextFrames = exists
      ? frames.filter((frame) => Math.abs(frame.time - keyframeTime) >= 0.0001)
      : [...frames, { time: keyframeTime, value: getCameraValue(object, property, currentTime) }].sort((a, b) => a.time - b.time);
    updateObject(objectId, { ...object, cameraKeyframes: { ...object.cameraKeyframes, [property]: nextFrames } });
  };

  const deleteCameraKeyframes = (selection: { cameraId: string; property: CameraProperty; time: number }[]) => {
    setObjects((current) => current.map((object) => {
      const selected = selection.filter((item) => item.cameraId === object.id);
      if (!selected.length) return object;
      const cameraKeyframes = { ...object.cameraKeyframes };
      const pathPatch: Partial<StageObject> = {};
      selected.forEach(({ property, time }) => {
        cameraKeyframes[property] = (cameraKeyframes[property] ?? []).filter((frame) => Math.abs(frame.time - time) >= 0.0001);
      });
      (["position", "target"] as const).forEach((property) => {
        if (!selected.some((item) => item.property === property)) return;
        if (property === "position" && object.cameraPath === undefined) return;
        if (property === "target" && object.targetPath === undefined) return;
        const points = (cameraKeyframes[property] ?? []).flatMap((frame) => Array.isArray(frame.value) ? [frame.value] : []);
        if (property === "position") {
          pathPatch.cameraPath = points.length ? points.slice(1) : undefined;
          pathPatch.cameraPathOrigin = points[0];
        } else {
          pathPatch.targetPath = points.length ? points.slice(1) : undefined;
          pathPatch.targetPathOrigin = points[0];
        }
      });
      return { ...object, cameraKeyframes, ...pathPatch };
    }));
    setDirty(true);
  };

  const toggleCharacterKeyframe = (objectId: string, property: CharacterProperty) => {
    const object = objects.find((item) => item.id === objectId && item.type === "character");
    if (!object || (property === "rotation" && object.pathAutoRotate)) return;
    const frames = object.characterKeyframes?.[property] ?? [];
    const exists = frames.some((frame) => Math.abs(frame.time - keyframeTime) < 0.0001);
    const nextFrames = exists
      ? frames.filter((frame) => Math.abs(frame.time - keyframeTime) >= 0.0001)
      : [...frames, { time: keyframeTime, value: property === "position" ? getCharacterPosition(object, currentTime) : getCharacterValue(object, property, currentTime) }].sort((a, b) => a.time - b.time);
    updateObject(objectId, property === "position" && exists
      ? withCharacterPositionKeyframes(object, nextFrames)
      : { ...object, characterKeyframes: { ...object.characterKeyframes, [property]: nextFrames } });
  };

  const deleteCharacterKeyframes = (selection: { characterId: string; property: CharacterProperty; time: number }[]) => {
    setObjects((current) => current.map((object) => {
      const selected = selection.filter((item) => item.characterId === object.id);
      if (!selected.length) return object;
      const characterKeyframes = { ...object.characterKeyframes };
      selected.forEach(({ property, time }) => {
        characterKeyframes[property] = (characterKeyframes[property] ?? []).filter((frame) => Math.abs(frame.time - time) >= 0.0001);
      });
      return selected.some((item) => item.property === "position") ? withCharacterPositionKeyframes({ ...object, characterKeyframes }, characterKeyframes.position ?? []) : { ...object, characterKeyframes };
    }));
    setDirty(true);
  };

  const changeCameraValue = (property: CameraProperty, value: StagePoint | number) => {
    if (!selectedObject || selectedObject.type !== "camera") return;
    const frames = selectedObject.cameraKeyframes?.[property] ?? [];
    const nextFrames = frames.length
      ? [...frames.filter((frame) => Math.abs(frame.time - keyframeTime) >= 0.0001), { time: keyframeTime, value }].sort((a, b) => a.time - b.time)
      : frames;
    updateObject(selectedObject.id, { ...selectedObject, [property]: value, cameraKeyframes: { ...selectedObject.cameraKeyframes, [property]: nextFrames } });
  };

  const transformObject = (id: string, next: StageObject) => {
    const previous = objects.find((object) => object.id === id);
    const transform = previous?.type === "character" && previous.pathAutoRotate ? { ...next, rotation: previous.rotation } : next;
    const frames = transform.type === "camera" ? transform.cameraKeyframes?.position ?? [] : [];
    const positionFrames = frames.length
      ? [...frames.filter((frame) => Math.abs(frame.time - keyframeTime) >= 0.0001), { time: keyframeTime, value: transform.position }].sort((a, b) => a.time - b.time)
      : frames;
    if (transform.type === "camera") {
      updateObject(id, { ...transform, cameraKeyframes: { ...transform.cameraKeyframes, position: positionFrames } });
      return;
    }
    if (transform.type === "character") {
      const characterKeyframes = { ...transform.characterKeyframes };
      (["position", "rotation", "scale"] as const).forEach((property) => {
        if (previous && transform[property].every((value, axis) => value === previous[property][axis])) return;
        const frames = characterKeyframes[property] ?? [];
        if (!frames.length) return;
        const currentFrame = frames.find((frame) => Math.abs(frame.time - keyframeTime) < 0.0001);
        characterKeyframes[property] = [...frames.filter((frame) => Math.abs(frame.time - keyframeTime) >= 0.0001), { ...currentFrame, time: keyframeTime, value: transform[property] }].sort((a, b) => a.time - b.time);
      });
      const nextObject = { ...transform, characterKeyframes };
      updateObject(id, characterKeyframes.position?.length ? withCharacterPositionKeyframes(nextObject, characterKeyframes.position) : nextObject);
      return;
    }
    updateObject(id, transform);
  };

  const applyPose = async (objectId: string, preset: Pick<ActionPreset, "name" | "assetId">) => {
    const target = objects.find((object) => object.id === objectId);
    if (!target?.modelUrl || !preset.assetId) {
      setToast("当前角色无法应用该姿势");
      return;
    }
    setToast(`正在应用姿势：${preset.name}`);
    try {
      const rotations = await bakeCharacterPose(target.modelUrl, `/api/motions/${preset.assetId}`);
      setObjects((current) => current.map((object) => object.id === objectId ? { ...object, pose: { name: preset.name, assetId: preset.assetId, rotations } } : object));
      setSelectedBone(undefined);
      setPropertyTab("pose");
      setRightPanel(true);
      setDirty(true);
      setToast(`已应用姿势：${preset.name}`);
    } catch {
      setToast("姿势资源加载失败，请重试");
    }
  };

  const selectAction = async (preset: ActionPreset) => {
    const objectId = pathActionOpen ? pathDraft?.objectId : actionObjectId;
    if (!objectId) return;
    if (mode === "static") {
      setActionObjectId(null);
      await applyPose(objectId, preset);
      return;
    }
    const target = objects.find((object) => object.id === objectId);
    const lastActionEnd = Math.max(0, ...(target?.actions ?? []).map((action) => action.start + action.duration));
    const start = target?.actions?.length ? lastActionEnd : currentTime;
    const actionId = `${preset.id}-${Date.now()}`;
    const characterPath = pathActionOpen && pathDraft ? { origin: pathDraft.origin, points: pathDraft.points } : null;
    const pathPoints = characterPath ? [characterPath.origin, ...characterPath.points] : [];
    const positionFrames: CharacterKeyframe[] = pathPoints.map((value, index) => ({
      time: Math.round((start + index * preset.duration / Math.max(1, pathPoints.length - 1)) * frameRate) / frameRate,
      value,
      actionId,
    }));
    const frameTimes = new Set(positionFrames.map((frame) => frame.time));
    setObjects((current) => current.map((object) => object.id === objectId ? {
      ...object,
      ...(characterPath ? {
        path: characterPath.points,
        pathOrigin: characterPath.origin,
        pathActionId: actionId,
        characterKeyframes: {
          ...object.characterKeyframes,
          position: [...(object.characterKeyframes?.position ?? []).filter((frame) => !frameTimes.has(frame.time)), ...positionFrames].sort((a, b) => a.time - b.time),
        },
      } : {}),
      actions: [...(object.actions ?? []), { id: actionId, name: preset.name, kind: preset.kind, start, duration: preset.duration, motionAssetId: preset.assetId }],
    } : object));
    setActionObjectId(null);
    setPathActionOpen(false);
    if (pathActionOpen) setPathDraft(null);
    setMode("dynamic");
    setTimelineOpen(true);
    setDuration((current) => Math.max(current, start + preset.duration));
    setDirty(true);
    setToast(`已添加动作：${preset.name}`);
  };

  const updatePoseBone = (objectId: string, boneName: string, rotation: StagePoint, position?: StagePoint) => {
    setObjects((current) => current.map((object) => object.id === objectId && object.pose ? { ...object, pose: { ...object.pose, rotations: { ...object.pose.rotations, [boneName]: rotation }, ...(position ? { positions: { ...object.pose.positions, [boneName]: position } } : {}) } } : object));
    setDirty(true);
  };

  const resizeAction = (objectId: string, actionId: string, nextDuration: number) => {
    setObjects((current) => current.map((object) => {
      if (object.id !== objectId || !object.actions) return object;
      const actions = [...object.actions].sort((a, b) => a.start - b.start);
      let end = actions[0]?.start ?? 0;
      return {
        ...object,
        actions: actions.map((action, index) => {
          const start = index === 0 ? action.start : end;
          const duration = action.id === actionId ? Math.max(1 / frameRate, nextDuration) : action.duration;
          end = start + duration;
          return { ...action, start, duration };
        }),
      };
    }));
    setDirty(true);
  };

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
    if (type === "character") setHideEmpty(false);
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
    if (type === "character") setHideEmpty(false);
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
    if (pathDraft?.objectId === selectedObject.id) setPathDraft(null);
    if (actionObjectId === selectedObject.id) setActionObjectId(null);
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
      objects={sceneObjects}
      selectedId={cameraPresetDraft && cameraPresetDraft.step !== 3 ? "" : selectedId}
      tool={tool}
      playing={playing}
      currentTime={sceneTime}
      resetKey={resetKey}
      focusKey={focusKey}
      placing={Boolean(pendingAsset)}
      pathDraft={pathDraft}
      cameraPreset={cameraPresetDraft && cameraPresetResult ? {
        step: cameraPresetDraft.step,
        target: cameraPresetDraft.target,
        cameraPath: cameraPresetResult.cameraPath ? [cameraPresetResult.cameraPathOrigin!, ...cameraPresetResult.cameraPath] : [],
        targetPath: cameraPresetResult.targetPath ? [cameraPresetResult.targetPathOrigin!, ...cameraPresetResult.targetPath] : [],
        placingTarget: cameraPresetDraft.placingTarget,
        onTargetChange: (target) => updateCameraPreset({ target }),
        onTargetPlace: (target) => updateCameraPreset({ target, placingTarget: false }),
        onAngleChange: (angle) => updateCameraPreset({ angle }),
      } : null}
      showPath={showPath}
      onSelect={cameraPresetDraft ? undefined : setSelectedId}
      onTransform={transformObject}
      onAddAction={setActionObjectId}
      onStartPath={startPath}
      poseMode={mode === "static"}
      selectedBone={selectedBone}
      onSelectBone={(_objectId, boneName) => { setSelectedBone(boneName); setPropertyTab("pose"); setRightPanel(true); }}
      onPoseChange={updatePoseBone}
      onPathPoint={(point) => setPathDraft((current) => {
        if (!current) return current;
        return { ...current, points: [...current.points, point], redo: [] };
      })}
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

  const startTimelineResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineResize.current = { startY: event.clientY, startHeight: timelineHeight };
  };

  const updateTimelineResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!timelineResize.current) return;
    const workspaceHeight = event.currentTarget.parentElement?.clientHeight ?? 560;
    const nextHeight = timelineResize.current.startHeight + timelineResize.current.startY - event.clientY;
    setTimelineHeight(Math.min(Math.max(160, workspaceHeight - 180), Math.max(160, nextHeight)));
  };

  const stopTimelineResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    timelineResize.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

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

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
        {assetsOpen && <AssetPanel onClose={() => { setAssetsOpen(false); setPendingAsset(null); }} onAdd={(type, name) => setPendingAsset({ type, name })} onImport={importModel} onEnvironment={(environment) => { const presets: Record<string, Partial<StageSettings>> = { 影棚: { backgroundColor: "#171717", groundColor: "#242424", environment }, 城市: { backgroundColor: "#202833", groundColor: "#30343a", environment }, 自然: { backgroundColor: "#26322d", groundColor: "#303b32", environment }, 纯黑: { backgroundColor: "#000000", groundColor: "#080808", environment } }; updateSettings(presets[environment]); }} />}
        <section aria-label="3D viewport" className="relative min-w-0 flex-1 overflow-hidden">
          <div className="absolute inset-0">{scene}</div>
          {cameraPresetDraft && <CameraPresetWizard draft={cameraPresetDraft} onChange={updateCameraPreset} onClose={() => setCameraPresetDraft(null)} onApply={applyCameraPreset} />}

          <nav aria-label="对象" className="absolute left-3 top-3 z-20 flex flex-col items-center gap-2">
            <button type="button" aria-label="资产" onClick={() => { setAssetsOpen((open) => !open); setPendingAsset(null); setShotsOpen(false); }} className={`group relative flex size-11 items-center justify-center rounded-lg border text-xs shadow-lg ${assetsOpen ? "border-white/25 bg-[#303030] text-white" : "border-white/10 bg-[#202020]/95 text-white/65"}`}><Cuboid size={18} /><span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#2b2b2b] px-2.5 py-1.5 text-[11px] text-white/85 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">资产</span></button>
            <div className="flex w-11 flex-col items-center gap-2 rounded-lg border border-white/10 bg-[#202020]/95 p-1 shadow-lg">
              {TOOL_ITEMS.map((item) => { const Icon = item.icon; return <IconButton key={item.id} label={`${item.label} · ${item.key}`} tooltipPosition="right" disabled={item.id === "rotate" && rotationLocked} active={tool === item.id} onClick={() => setTool(item.id)}><Icon size={17} /></IconButton>; })}
              <IconButton label="落到地面 · G" tooltipPosition="right" disabled={!selectedObject || selectedObject.locked} onClick={dropToGround}><ArrowDownToLine size={17} /></IconButton>
              <div className="my-1 h-px w-full bg-white/8" />
              <IconButton label="视图设置" tooltipPosition="right" active={viewMenuOpen} onClick={() => setViewMenuOpen((open) => !open)}><Eye size={17} /></IconButton>
            </div>
          </nav>

          {pendingAsset && <div className="absolute left-1/2 top-4 z-40 flex min-w-[320px] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#202020]/95 px-4 py-3 shadow-2xl"><Focus size={22} className="text-white/75" /><div><div className="text-xs font-medium">放置 {pendingAsset.name}</div><div className="mt-1 text-[10px] text-white/40">点击地面放置对象</div></div><button type="button" aria-label="取消放置" onClick={() => setPendingAsset(null)} className="ml-auto flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 text-xs text-white/65 hover:bg-white/8"><X size={13} />取消</button></div>}

          {pathDraft && <div className="absolute left-1/2 top-4 z-40 flex w-[min(760px,calc(100%-180px))] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#202020]/95 px-4 py-3 shadow-2xl"><Route size={20} className="shrink-0 text-white/70" /><span className="min-w-0 flex-1 truncate text-xs text-white/65">已添加 {pathDraft.points.length} 个点 · 按住地面定点，向上拖动设置高度</span><IconButton label="显示或隐藏路径" active={showPath} onClick={() => setShowPath((visible) => !visible)}><Eye size={15} /></IconButton><IconButton label="撤销路径点" disabled={!pathDraft.points.length} onClick={() => setPathDraft((current) => { if (!current?.points.length) return current; const point = current.points[current.points.length - 1]; return { ...current, points: current.points.slice(0, -1), redo: [...current.redo, point] }; })}><Undo2 size={15} /></IconButton><IconButton label="重做路径点" disabled={!pathDraft.redo.length} onClick={() => setPathDraft((current) => { if (!current?.redo.length) return current; const point = current.redo[current.redo.length - 1]; return { ...current, points: [...current.points, point], redo: current.redo.slice(0, -1) }; })}><Redo2 size={15} /></IconButton><button type="button" className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/8" onClick={() => { setPathDraft(null); setPathActionOpen(false); setFreeCameraMovement(false); }}><X size={13} />取消</button><button type="button" disabled={pathDraft.points.length < (pathDraft.kind === "character" ? 2 : 1)} className="flex items-center gap-1 rounded-md bg-white px-3 py-2 text-xs text-black disabled:opacity-25" onClick={() => pathDraft.kind === "character" ? setPathActionOpen(true) : finishCameraPath()}><Check size={13} />完成</button></div>}

          {viewMenuOpen && <div className="absolute left-16 top-[290px] z-30 w-40 rounded-lg border border-white/10 bg-[#252525] p-2 shadow-xl"><Toggle label="显示网格" checked={settings.showGrid} onChange={(showGrid) => updateSettings({ showGrid })} /><Toggle label="显示地面" checked={settings.showGround} onChange={(showGround) => updateSettings({ showGround })} /><button type="button" className="mt-1 w-full rounded-md px-2 py-2 text-left text-xs text-white/55 hover:bg-white/8" onClick={() => { setResetKey((key) => key + 1); setViewMenuOpen(false); }}>重置导演视角</button></div>}

          {previewOpen ? <div className={`absolute z-10 overflow-hidden rounded-xl border border-white/20 bg-black shadow-xl transition-all ${splitPreview ? "bottom-4 right-4 top-4" : "right-4 top-4"}`} style={splitPreview ? { width: "42%" } : { width: previewSize, height: previewSize * 0.59 }}>
            <div className="absolute inset-0"><StageScene settings={settings} objects={cameraPresetDraft ? cameraPresetObjects : objects} selectedId={selectedId} tool={tool} preview playing={playing} currentTime={cameraPresetDraft?.step === 3 ? cameraPresetTime : cameraPresetDraft?.start ?? currentTime} /></div>
            <div className="absolute left-3 top-3 flex h-8 items-center gap-2 rounded-md border border-white/10 bg-[#202020]/90 px-2 text-xs"><MoreHorizontal size={14} className="text-white/40" /><Aperture size={13} /><span>机位</span><ChevronDown size={12} className="text-white/40" /></div>
            <IconButton label="收起机位预览" className="absolute right-3 top-3 bg-[#202020]/90" onClick={() => setPreviewOpen(false)}><ChevronDown size={15} /></IconButton>
            <button type="button" onClick={() => setSplitPreview((split) => !split)} className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] text-white/45 hover:text-white">分屏预览<Maximize2 size={11} /></button>
            <span className="absolute bottom-3 left-3 text-lg text-white/55">L</span>
            {!splitPreview && <input aria-label="拖动调整预览大小" type="range" min="240" max="480" value={previewSize} onChange={(event) => setPreviewSize(Number(event.target.value))} className="absolute bottom-1 left-1/2 h-1 w-20 -translate-x-1/2 accent-white/50" />}
          </div> : <button type="button" className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-[#202020] px-3 py-2 text-xs text-white/60" onClick={() => setPreviewOpen(true)}><Aperture size={14} />机位预览</button>}

          <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2"><button type="button" className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#202020]/90 px-4 py-2 text-xs text-white/70" onClick={() => setResetKey((key) => key + 1)}><Aperture size={14} />导演视角<ChevronDown size={12} /></button></div>
          <div className="absolute bottom-5 right-4 z-30 flex flex-col items-end gap-2"><span className="text-[9px] text-white/40">FOV 50°</span><button type="button" className="flex items-center gap-1.5 rounded-md bg-[#202020]/90 px-2.5 py-1.5 text-[10px] text-white/60" onClick={() => setResetKey((key) => key + 1)}><RotateCcw size={12} />重置视角</button></div>
          <div className="absolute bottom-20 right-3 z-30"><IconButton label="对象操作" className="bg-[#202020]/90" onClick={() => setObjectMenuOpen((open) => !open)}><MoreHorizontal size={17} /></IconButton></div>

          {objectMenuOpen && <div className="absolute bottom-20 right-3 z-30 w-36 rounded-lg border border-white/10 bg-[#252525] p-1.5 shadow-xl"><button type="button" disabled={!selectedObject} onClick={duplicateObject} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-white/60 hover:bg-white/8 disabled:opacity-30"><Copy size={13} />复制对象</button><button type="button" disabled={!selectedObject || objects.length === 1} onClick={deleteObject} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-red-300/70 hover:bg-white/8 disabled:opacity-30"><Trash2 size={13} />删除对象</button></div>}

        </section>

        {rightPanel && <aside className="relative z-20 flex w-[300px] shrink-0 flex-col border-l border-white/5 bg-[#1b1b1b]">
          <section className="flex h-[38%] min-h-[205px] flex-col border-b-[5px] border-[#111]"><div className="flex h-12 shrink-0 items-center gap-2 px-3 text-xs font-medium"><List size={15} /><h2>对象</h2><IconButton label="收起对象与属性面板" className="ml-auto" onClick={() => setRightPanel(false)}><PanelRightClose size={14} /></IconButton></div><div className="mx-3 mb-2 flex h-9 items-center gap-2 rounded-md bg-white/[0.055] px-2"><Search size={14} className="text-white/30" /><input aria-label="搜索对象" placeholder="搜索对象" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-white/75 outline-none placeholder:text-white/25" /></div><div className="min-h-0 flex-1 overflow-y-auto">{renderObjectGroup("camera", "机位", cameras)}{renderObjectGroup("character", "角色", characters)}{renderObjectGroup("prop", "物体", props)}{!cameras.length && !characters.length && !props.length && <p className="py-8 text-center text-xs text-white/25">未找到对象</p>}</div></section>
          <section className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 [&_input[type=number]]:[font-variant-numeric:tabular-nums]"><div className="sticky top-0 z-10 flex h-12 items-center gap-2 bg-[#1b1b1b] text-xs font-medium"><SlidersHorizontal size={14} /><h2>属性</h2></div>{mode === "static" && selectedObject?.type === "character" && <div role="tablist" aria-label="角色属性" className="mb-4 grid grid-cols-2 rounded-lg bg-black/25 p-1">{(["object", "pose"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={propertyTab === tab} onClick={() => setPropertyTab(tab)} className={propertyTab === tab ? "rounded-md py-2 text-xs bg-white/10 text-white" : "rounded-md py-2 text-xs text-white/35 hover:text-white/70"}>{tab === "object" ? "对象" : "姿势"}</button>)}</div>}{propertyTab === "pose" && mode === "static" && selectedObject?.type === "character" ? <PosePanel object={selectedObject} selectedBone={selectedBone} onChange={(boneName, rotation) => updatePoseBone(selectedObject.id, boneName, rotation)} onReset={() => { if (selectedObject.pose?.assetId) void applyPose(selectedObject.id, selectedObject.pose); }} /> : <>{!selectedObject && <><div className="mb-2 flex items-center text-xs text-white/50"><span>环境预设</span><div className="relative ml-auto"><button type="button" aria-label="环境预设" className="flex h-8 w-32 items-center justify-between rounded-md bg-white/[0.045] px-2 text-white/65" onClick={() => setEnvironmentOpen((open) => !open)}>{settings.environment}<ChevronDown size={12} /></button>{environmentOpen && <div className="absolute right-0 top-9 z-30 w-32 rounded-md border border-white/10 bg-[#292929] p-1 shadow-xl">{ENVIRONMENTS.map((environment) => <button type="button" key={environment} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs text-white/60 hover:bg-white/8" onClick={() => { const presets: Record<string, Partial<StageSettings>> = { 影棚: { backgroundColor: "#171717", groundColor: "#242424", environment }, 城市: { backgroundColor: "#202833", groundColor: "#30343a", environment }, 自然: { backgroundColor: "#26322d", groundColor: "#303b32", environment }, 纯黑: { backgroundColor: "#000000", groundColor: "#080808", environment } }; updateSettings(presets[environment]); setEnvironmentOpen(false); }}>{environment}{settings.environment === environment && <Check size={12} />}</button>)}</div>}</div></div><ColorField label="背景颜色" value={settings.backgroundColor} onChange={(backgroundColor) => updateSettings({ backgroundColor })} /><ColorField label="地面颜色" value={settings.groundColor} onChange={(groundColor) => updateSettings({ groundColor })} /><Toggle label="显示地面" checked={settings.showGround} onChange={(showGround) => updateSettings({ showGround })} /><NumberField label="地面不透明度" value={settings.groundOpacity} min={0} max={100} step={1} suffix="%" onChange={(groundOpacity) => updateSettings({ groundOpacity })} /><NumberField label="曝光" value={settings.exposure} min={0} max={3} step={0.01} onChange={(exposure) => updateSettings({ exposure })} /><Toggle label="显示网格" checked={settings.showGrid} onChange={(showGrid) => updateSettings({ showGrid })} />
          <LightEditor title="主光" light={settings.mainLight} onChange={(patch) => updateLight("mainLight", patch)} main /><div className="my-3 h-px bg-white/5" /><LightEditor title="补光" light={settings.fillLight} onChange={(patch) => updateLight("fillLight", patch)} /><div className="my-3 h-px bg-white/5" /><LightEditor title="轮廓光" light={settings.rimLight} onChange={(patch) => updateLight("rimLight", patch)} /></>}
          {selectedObject?.type === "camera" ? <div className="mt-5 border-t border-white/8 pt-4"><h3 className="mb-3 text-xs text-white/75">{selectedObject.name} · 镜头属性</h3><CameraPanel object={selectedObject} currentTime={currentTime} keyframeTime={keyframeTime} onChange={changeCameraValue} onToggleKeyframe={(property) => toggleCameraKeyframe(selectedObject.id, property)} /></div> : selectedObject?.type === "character" ? <div className="mt-5 border-t border-white/8 pt-4"><h3 className="mb-3 text-xs text-white/75">{selectedObject.name} · 变换</h3><CharacterPanel object={selectedObject} currentTime={currentTime} keyframeTime={keyframeTime} onChange={(property, value) => transformObject(selectedObject.id, { ...selectedObject, [property]: value })} onToggleKeyframe={(property) => toggleCharacterKeyframe(selectedObject.id, property)} onAutoRotateChange={(checked) => { updateObject(selectedObject.id, { ...selectedObject, pathAutoRotate: checked }); if (checked && tool === "rotate") setTool("translate"); }} /></div> : selectedObject && <div className="mt-5 border-t border-white/8 pt-4"><h3 className="mb-3 text-xs text-white/75">{selectedObject.name} · 变换</h3><div className="space-y-2">{(["position", "rotation", "scale"] as const).map((key) => <div key={key} className="flex items-center gap-1 text-[10px] text-white/40"><span className="w-8">{key === "position" ? "位置" : key === "rotation" ? "旋转" : "缩放"}</span>{selectedObject[key].map((value, index) => <NumericInput key={index} label={`${key} ${index}`} step={key === "rotation" ? 1 : 0.1} value={Number((key === "rotation" ? value * 180 / Math.PI : value).toFixed(2))} disabled={selectedObject.locked} onChange={(nextValue) => { const values = [...selectedObject[key]] as [number, number, number]; values[index] = key === "rotation" ? nextValue * Math.PI / 180 : nextValue; transformObject(selectedObject.id, { ...selectedObject, [key]: values }); }} className="h-8 min-w-0 flex-1 rounded bg-white/[0.045] px-1 text-center text-white/65 outline-none disabled:opacity-40" />)}</div>)}</div></div>}</>}
          </section>
        </aside>}
        {!rightPanel && <IconButton label="展开对象与属性面板" className="absolute right-3 top-3 z-30 bg-[#202020]" onClick={() => setRightPanel(true)}><PanelRightOpen size={16} /></IconButton>}
        </div>
        {mode === "dynamic" && timelineOpen && <div
          role="separator"
          aria-label="拖拽调整时间轴高度"
          aria-orientation="horizontal"
          className="group relative z-30 h-px shrink-0 cursor-row-resize bg-white/15"
          onPointerDown={startTimelineResize}
          onPointerMove={updateTimelineResize}
          onPointerUp={stopTimelineResize}
          onPointerCancel={stopTimelineResize}
        ><span className="absolute -inset-y-1 inset-x-0" /><span className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white/35 opacity-0 transition-opacity group-hover:opacity-100" /></div>}
        {mode === "dynamic" && <StageTimeline
          open={timelineOpen}
          height={timelineHeight}
          playing={playing}
          loop={loop}
          hideEmpty={hideEmpty}
          exporting={exporting}
          currentTime={sceneTime}
          duration={duration}
          frameRate={frameRate}
          zoom={timelineZoom}
          shots={shots}
          cameras={objects.filter((object) => object.type === "camera")}
          characters={objects.filter((object) => object.type === "character")}
          selectedCameraId={selectedId}
          onToggle={() => setTimelineOpen((open) => !open)}
          onPlayingChange={setPlaying}
          onLoopChange={setLoop}
          onHideEmptyChange={setHideEmpty}
          onTimeChange={cameraPresetDraft?.step === 3 ? setCameraPresetTime : setCurrentTime}
          onDurationChange={setDuration}
          onFrameRateChange={setFrameRate}
          onZoomChange={setTimelineZoom}
          onCaptureShot={captureShot}
          onCameraSelect={(id) => { setSelectedId(id); setRightPanel(true); }}
          onCharacterSelect={(id) => { setSelectedId(id); setRightPanel(true); }}
          onCharacterAction={setActionObjectId}
          onCharacterPath={(id) => startPath(id)}
          onCameraPath={startCameraPath}
          onCameraPreset={openCameraPresets}
          onCameraKeyframesDelete={deleteCameraKeyframes}
          onCharacterKeyframesDelete={deleteCharacterKeyframes}
          onActionDurationChange={resizeAction}
        />}
      </div>

      {shotsOpen && <aside className="absolute right-3 top-16 z-40 w-72 rounded-xl border border-white/10 bg-[#242424] p-3 shadow-2xl"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xs"><Film size={14} />镜头素材</h2><IconButton label="关闭镜头素材" className="size-6" onClick={() => setShotsOpen(false)}><X size={13} /></IconButton></div>{shots.length ? <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto">{shots.map((shot, index) => <button type="button" key={shot.id} className="overflow-hidden rounded-lg border border-white/8 bg-black/20 text-left hover:border-white/25" onClick={() => { setCurrentTime(index * shot.duration); setMode("dynamic"); setShotsOpen(false); }}><img src={shot.image} alt={shot.name} className="aspect-video w-full object-cover" /><div className="flex justify-between p-2 text-[10px] text-white/50"><span>{shot.name}</span><span>{shot.duration}s</span></div></button>)}</div> : <div className="py-10 text-center text-xs text-white/30"><Camera size={24} className="mx-auto mb-3" />点击顶部拍摄按钮添加镜头</div>}<button type="button" onClick={captureShot} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-white/8 py-2 text-xs text-white/65 hover:bg-white/12"><Plus size={13} />拍摄当前机位</button></aside>}

      {actionObjectId && <ActionPanel poseMode={mode === "static"} onClose={() => setActionObjectId(null)} onSelect={selectAction} />}
      {pathActionOpen && pathDraft && <ActionPanel pathMode onClose={() => setPathActionOpen(false)} onSelect={selectAction} />}
      {cameraPresetCameraId && <CameraPresetDialog onClose={() => setCameraPresetCameraId(null)} onSelect={startCameraPreset} onCustom={startCustomCameraMovement} />}

      {switchOpen && <StageModal title="将静态预演场景应用于动态预演？" onClose={() => { setSwitchOpen(false); setOverwrite(false); }}><p className="text-xs leading-6 text-white/45">复制静态预演中的内容，保留演出时间轴，不复制角色姿势。时间轴中的角色须仍在静态预演中。</p><label className="my-5 flex cursor-pointer items-center gap-2 text-xs text-white/65"><input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} className="accent-white" />确认覆盖动态预演场景</label><div className="flex justify-end gap-2"><button type="button" className="rounded-md px-3 py-2 text-xs text-white/55 hover:bg-white/8" onClick={() => switchMode(false)}>不同步，直接切换</button><button type="button" disabled={!overwrite} className="rounded-md bg-white px-3 py-2 text-xs text-black disabled:opacity-25" onClick={() => switchMode(true)}>覆盖并切换</button></div></StageModal>}
      {shortcutsOpen && <StageModal title="快捷键" onClose={() => setShortcutsOpen(false)}><div className="space-y-1">{[...TOOL_ITEMS.map((item) => [item.label, item.key]), ["落到地面", "G"], ["播放 / 暂停", "Space"]].map(([label, key]) => <div key={label} className="flex items-center justify-between border-b border-white/5 py-3 text-xs text-white/55"><span>{label}</span><kbd className="rounded border border-white/10 bg-black/20 px-2 py-1 text-white/75">{key}</kbd></div>)}</div></StageModal>}
      {toast && <div role="status" className="absolute bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-white/10 bg-[#2b2b2b] px-4 py-2.5 text-xs text-white/75 shadow-xl">{toast}</div>}
    </main>
  );
}

function LightEditor({ title, light, onChange, main = false }: { title: string; light: LightSettings; onChange: (patch: Partial<LightSettings>) => void; main?: boolean }) {
  return <section><h3 className="mb-2 mt-4 text-xs font-medium text-white/75">{title}</h3><ColorField label="灯光颜色" value={light.color} onChange={(color) => onChange({ color })} /><NumberField label="强度" value={light.intensity} min={0} max={20} step={0.1} onChange={(intensity) => onChange({ intensity })} />{main && <><NumberField label="水平角度" value={light.horizontal ?? 0} min={-180} max={180} step={1} suffix="°" onChange={(horizontal) => onChange({ horizontal })} /><NumberField label="仰角" value={light.elevation ?? 0} min={0} max={90} step={1} suffix="°" onChange={(elevation) => onChange({ elevation })} /><Toggle label="阴影" checked={light.shadow ?? true} onChange={(shadow) => onChange({ shadow })} /></>}</section>;
}
