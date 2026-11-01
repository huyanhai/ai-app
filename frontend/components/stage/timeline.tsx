"use client";

import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Diamond,
  Eye,
  EyeOff,
  Film,
  Footprints,
  Minus,
  Move3D,
  Pause,
  Play,
  Plus,
  Repeat,
  Rotate3D,
  Route,
  Scaling,
  UserRound,
} from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { NumberField } from "./controls";
import { CameraMotion, CameraProperty, CharacterAction, CharacterProperty, Shot, StageObject } from "./types";

const CAMERA_PROPERTIES: { id: CameraProperty; label: string }[] = [
  { id: "position", label: "机位位置" },
  { id: "target", label: "注视点" },
  { id: "fov", label: "视野" },
  { id: "roll", label: "画面倾斜" },
];

const CHARACTER_PROPERTIES: { id: CharacterProperty; label: string; icon: typeof Move3D }[] = [
  { id: "position", label: "位置", icon: Move3D },
  { id: "rotation", label: "旋转", icon: Rotate3D },
  { id: "scale", label: "缩放", icon: Scaling },
];

type StageTimelineProps = {
  open: boolean;
  height?: number;
  playing: boolean;
  loop: boolean;
  hideEmpty: boolean;
  exporting: boolean;
  currentTime: number;
  duration: number;
  frameRate: number;
  zoom: number;
  shots: Shot[];
  cameras: StageObject[];
  characters: StageObject[];
  selectedCameraId: string;
  onToggle: () => void;
  onPlayingChange: (playing: boolean) => void;
  onLoopChange: (loop: boolean) => void;
  onHideEmptyChange: (hideEmpty: boolean) => void;
  onTimeChange: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onFrameRateChange: (frameRate: number) => void;
  onZoomChange: (zoom: number) => void;
  onCaptureShot: () => void;
  onCameraSelect: (id: string) => void;
  onCharacterSelect: (id: string) => void;
  onCharacterAction: (id: string) => void;
  onCharacterPath: (id: string, kind: "walk" | "move") => void;
  onCameraPath: (id: string, kind: "camera" | "target") => void;
  onCameraPreset: (id: string) => void;
  onCameraMotionMove: (cameraId: string, motionId: string, start: number) => void;
  onCameraMotionDelete: (cameraId: string, motionId: string) => void;
  onCameraKeyframesDelete: (
    selection: { cameraId: string; property: CameraProperty; time: number }[],
  ) => void;
  onCharacterKeyframesDelete: (
    selection: { characterId: string; property: CharacterProperty; time: number }[],
  ) => void;
  onActionDurationChange: (
    objectId: string,
    actionId: string,
    duration: number,
  ) => void;
};

const keyframeKey = (
  cameraId: string,
  property: CameraProperty | CharacterProperty,
  time: number,
) => `${cameraId}:${property}:${time}`;

const hasCharacterAnimation = (object: StageObject) => Boolean(
  object.actions?.length || Object.values(object.characterKeyframes ?? {}).some((frames) => frames?.length),
);

export function StageTimeline({
  open,
  height = 300,
  playing,
  loop,
  hideEmpty,
  exporting,
  currentTime,
  duration,
  frameRate,
  zoom,
  shots,
  cameras,
  characters,
  selectedCameraId,
  onToggle,
  onPlayingChange,
  onLoopChange,
  onHideEmptyChange,
  onTimeChange,
  onDurationChange,
  onFrameRateChange,
  onZoomChange,
  onCaptureShot,
  onCameraSelect,
  onCharacterSelect,
  onCharacterAction,
  onCharacterPath,
  onCameraPath,
  onCameraPreset,
  onCameraMotionMove,
  onCameraMotionDelete,
  onCameraKeyframesDelete,
  onCharacterKeyframesDelete,
  onActionDurationChange,
}: StageTimelineProps) {
  const resizing = useRef<{
    objectId: string;
    actionId: string;
    startX: number;
    initialDuration: number;
    pixelsPerSecond: number;
  } | null>(null);
  const motionDragging = useRef<{
    cameraId: string;
    motionId: string;
    startX: number;
    initialStart: number;
    pixelsPerSecond: number;
  } | null>(null);
  const motionWasDragged = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const trackScrollRef = useRef<HTMLDivElement>(null);
  const shotScrollRef = useRef<HTMLDivElement>(null);
  const [expandedCameras, setExpandedCameras] = useState<
    Record<string, boolean>
  >({});
  const [expandedCharacters, setExpandedCharacters] = useState<
    Record<string, boolean>
  >({});
  const [cameraMenu, setCameraMenu] = useState<string | null>(null);
  const [characterMenu, setCharacterMenu] = useState<string | null>(null);
  const [selectedKeyframes, setSelectedKeyframes] = useState<Set<string>>(
    new Set(),
  );
  const [selectedMotion, setSelectedMotion] = useState<{ cameraId: string; motionId: string } | null>(null);
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const marks = Array.from(
    { length: 11 },
    (_, index) => (index * duration) / 10,
  );
  const playheadLeft = `calc(${(currentTime / duration) * 100}% + ${7.5 - (16 * currentTime) / duration}px)`;
  const snapTimes = [
    ...cameras.flatMap((camera) => CAMERA_PROPERTIES.flatMap((property) => camera.cameraKeyframes?.[property.id]?.map((frame) => frame.time) ?? [])),
    ...characters.flatMap((character) => CHARACTER_PROPERTIES.flatMap((property) => character.characterKeyframes?.[property.id]?.map((frame) => frame.time) ?? [])),
  ];
  const snapTime = (time: number) => {
    const width = rulerScrollRef.current?.scrollWidth ?? 0;
    if (!width) return time;
    const threshold = (duration / width) * 8;
    const closest = snapTimes.reduce<number | undefined>((nearest, frameTime) => {
      if (Math.abs(frameTime - time) > threshold) return nearest;
      return nearest === undefined || Math.abs(frameTime - time) < Math.abs(nearest - time) ? frameTime : nearest;
    }, undefined);
    return closest ?? time;
  };
  const selectKeyframes = (keys: string[]) => {
    setSelectedKeyframes(new Set(keys));
    setSelectedMotion(null);
  };
  const selectCameraMotion = (camera: StageObject, motion: CameraMotion, start = motion.start) => {
    const delta = start - motion.start;
    const keys = CAMERA_PROPERTIES.flatMap((property) => (camera.cameraKeyframes?.[property.id] ?? [])
      .filter((frame) => frame.motionId === motion.id || (!frame.motionId && frame.time >= motion.start - 0.0001 && frame.time <= motion.start + motion.duration + 0.0001))
      .map((frame) => keyframeKey(camera.id, property.id, Math.round((frame.time + delta) * frameRate) / frameRate)));
    setSelectedKeyframes(new Set(keys));
    setSelectedMotion({ cameraId: camera.id, motionId: motion.id });
  };
  const visibleCharacters = characters.filter(
    (object) => !hideEmpty || hasCharacterAnimation(object),
  );
  const hasAnimation =
    shots.length > 0 ||
    characters.some(hasCharacterAnimation) ||
    cameras.some((object) =>
      Object.values(object.cameraKeyframes ?? {}).some(
        (frames) => frames?.length,
      ),
    );

  useEffect(() => {
    if (!cameraMenu && !characterMenu) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setCameraMenu(null);
        setCharacterMenu(null);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCameraMenu(null);
        setCharacterMenu(null);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [cameraMenu, characterMenu]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable
      )
        return;
      if (event.key === "Escape") {
        setSelectedKeyframes(new Set());
        setSelectedMotion(null);
      }
      if (!["Delete", "Backspace"].includes(event.key)) return;
      if (selectedMotion) {
        event.preventDefault();
        onCameraMotionDelete(selectedMotion.cameraId, selectedMotion.motionId);
        setSelectedMotion(null);
        setSelectedKeyframes(new Set());
        return;
      }
      if (!selectedKeyframes.size) return;
      event.preventDefault();
      const selection = [...selectedKeyframes].map((key) => {
        const [objectId, property, time] = key.split(":");
        return { objectId, property: property as CameraProperty, time: Number(time) };
      });
      const cameraSelection = selection.filter((item) => cameras.some((camera) => camera.id === item.objectId));
      const characterSelection = selection.filter((item) => characters.some((character) => character.id === item.objectId));
      if (cameraSelection.length) onCameraKeyframesDelete(cameraSelection.map((item) => ({ cameraId: item.objectId, property: item.property, time: item.time })));
      if (characterSelection.length) onCharacterKeyframesDelete(characterSelection.map((item) => ({ characterId: item.objectId, property: item.property as CharacterProperty, time: item.time })));
      setSelectedKeyframes(new Set());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cameras, characters, onCameraKeyframesDelete, onCameraMotionDelete, onCharacterKeyframesDelete, selectedKeyframes, selectedMotion]);

  const startResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    objectId: string,
    action: CharacterAction,
  ) => {
    const segment = event.currentTarget.parentElement;
    if (!segment) return;
    event.preventDefault();
    event.stopPropagation();
    resizing.current = {
      objectId,
      actionId: action.id,
      startX: event.clientX,
      initialDuration: action.duration,
      pixelsPerSecond: segment.getBoundingClientRect().width / action.duration,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const updateResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = resizing.current;
    if (!drag) return;
    const nextDuration =
      drag.initialDuration +
      (event.clientX - drag.startX) / drag.pixelsPerSecond;
    onActionDurationChange(
      drag.objectId,
      drag.actionId,
      Math.max(1 / frameRate, Math.round(nextDuration * frameRate) / frameRate),
    );
  };
  const stopResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    resizing.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const startMotionDrag = (event: ReactPointerEvent<HTMLButtonElement>, camera: StageObject, motion: CameraMotion) => {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    event.stopPropagation();
    selectCameraMotion(camera, motion);
    onCameraSelect(camera.id);
    motionWasDragged.current = false;
    motionDragging.current = {
      cameraId: camera.id,
      motionId: motion.id,
      startX: event.clientX,
      initialStart: motion.start,
      pixelsPerSecond: bounds.width / duration,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const updateMotionDrag = (event: ReactPointerEvent<HTMLButtonElement>, camera: StageObject, motion: CameraMotion) => {
    const drag = motionDragging.current;
    if (!drag) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 2) motionWasDragged.current = true;
    const start = Math.min(
      Math.max(0, Math.round((drag.initialStart + distance / drag.pixelsPerSecond) * frameRate) / frameRate),
      Math.max(0, duration - motion.duration),
    );
    onCameraMotionMove(drag.cameraId, drag.motionId, start);
    selectCameraMotion(camera, motion, start);
  };
  const stopMotionDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    motionDragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const trackGrid = () => (
    <div className="pointer-events-none absolute inset-0 flex border-b border-white/[0.07]">
      {marks.map((mark) => (
        <div key={mark} className="flex-1 border-l border-white/[0.07]" />
      ))}
    </div>
  );
  const syncHorizontalScroll = (source: HTMLDivElement) => {
    for (const target of [
      rulerScrollRef.current,
      trackScrollRef.current,
      shotScrollRef.current,
    ]) {
      if (target && target.scrollLeft !== source.scrollLeft) {
        target.scrollLeft = source.scrollLeft;
      }
    }
  };
  const startMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button, input")
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    event.currentTarget.setPointerCapture(event.pointerId);
    setMarquee({
      left: bounds.left,
      top: bounds.top,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
  };
  const updateMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!marquee) return;
    setMarquee({
      ...marquee,
      currentX: event.clientX - marquee.left,
      currentY: event.clientY - marquee.top,
    });
  };
  const finishMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!marquee) return;
    const left = marquee.left + Math.min(marquee.startX, marquee.currentX);
    const right = marquee.left + Math.max(marquee.startX, marquee.currentX);
    const top = marquee.top + Math.min(marquee.startY, marquee.currentY);
    const bottom = marquee.top + Math.max(marquee.startY, marquee.currentY);
    const selection = new Set<string>();
    event.currentTarget
      .querySelectorAll<HTMLElement>("[data-camera-keyframe], [data-character-keyframe]")
      .forEach((element) => {
        const bounds = element.getBoundingClientRect();
        const x = bounds.left + bounds.width / 2;
        const y = bounds.top + bounds.height / 2;
        const key = element.dataset.cameraKeyframe ?? element.dataset.characterKeyframe;
        if (
          x >= left &&
          x <= right &&
          y >= top &&
          y <= bottom &&
          key
        )
          selection.add(key);
      });
    selectKeyframes([...selection]);
    setMarquee(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const renderActionSegments = (object: StageObject) =>
    object.actions?.map((action) => (
      <div
        key={action.id}
        className="group absolute inset-y-1 rounded overflow-hidden"
        style={{
          left: `${(action.start / duration) * 100}%`,
          width: `${Math.max(3, (action.duration / duration) * 100)}%`,
        }}
      >
        <button
          type="button"
          title={`${action.name} · ${action.duration.toFixed(2)}秒`}
          onClick={() => onTimeChange(action.start)}
          className={`block h-full w-full overflow-hidden rounded border px-2 text-left text-[10px] leading-5 ${action.kind === "action" ? "border-violet-300/30 bg-violet-400/25 text-violet-100" : "border-emerald-300/30 bg-emerald-400/25 text-emerald-100"}`}
        >
          {action.name}
        </button>
        <button
          type="button"
          aria-label={`调整${action.name}时长`}
          title="拖动调整时长"
          onPointerDown={(event) => startResize(event, object.id, action)}
          onPointerMove={updateResize}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          className="absolute right-0 top-0 bottom-0 z-10 w-1 cursor-ew-resize bg-white/0 transition-colors hover:bg-white/80 group-hover:bg-white/35"
        />
      </div>
    ));

  const renderCharacterKeyframes = (object: StageObject, property: CharacterProperty, connect = false) => {
    const frames = [...(object.characterKeyframes?.[property] ?? [])].sort((a, b) => a.time - b.time);
    const label = CHARACTER_PROPERTIES.find((item) => item.id === property)?.label ?? property;
    return <>
      {connect && frames.length > 1 && <div
        className="pointer-events-none absolute top-1/2 h-px -translate-y-1/2 bg-white/25"
        style={{
          left: `${(frames[0].time / duration) * 100}%`,
          width: `${((frames[frames.length - 1].time - frames[0].time) / duration) * 100}%`,
        }}
      />}
      {frames.map((frame) => {
        const key = keyframeKey(object.id, property, frame.time);
        const selected = selectedKeyframes.has(key);
        return <button
          type="button"
          key={key}
          data-character-keyframe={key}
          aria-label={`${object.name}${label}关键帧 ${frame.time.toFixed(2)}秒`}
          title={`${frame.time.toFixed(2)} 秒`}
          onClick={() => { selectKeyframes([key]); onCharacterSelect(object.id); onTimeChange(frame.time); }}
          className={`absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-sm p-1 hover:bg-white/10 ${selected ? "text-white" : "text-white/30 hover:text-white/60"}`}
          style={{ left: `${(frame.time / duration) * 100}%` }}
        >
          <Diamond size={10} fill="currentColor" />
        </button>;
      })}
    </>;
  };

  const renderCharacterMainKeyframes = (object: StageObject) => {
    const times = [...new Set(CHARACTER_PROPERTIES.flatMap((property) => object.characterKeyframes?.[property.id]?.map((frame) => frame.time) ?? []))].sort((a, b) => a - b);
    return times.map((time) => {
      const keys = CHARACTER_PROPERTIES.filter((property) => object.characterKeyframes?.[property.id]?.some((frame) => Math.abs(frame.time - time) < 0.0001)).map((property) => keyframeKey(object.id, property.id, time));
      const selected = keys.some((key) => selectedKeyframes.has(key));
      return <button type="button" key={time} aria-label={`${object.name}关键帧 ${time.toFixed(2)}秒`} title={`${time.toFixed(2)} 秒`} onClick={() => { selectKeyframes(keys); onCharacterSelect(object.id); onTimeChange(time); }} className={`absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-sm p-1 hover:bg-white/10 ${selected ? "text-white" : "text-white/30 hover:text-white/60"}`} style={{ left: `${(time / duration) * 100}%` }}><Diamond size={10} fill="currentColor" /></button>;
    });
  };

  return (
    <section
      aria-label="时间轴"
      style={open ? { height } : undefined}
      className={`relative z-20 flex w-full shrink-0 flex-col border-t border-white/10 bg-[#1c1c1c] ${open ? "" : "h-10"}`}
    >
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-white/5 px-3">
        <button
          type="button"
          className="mr-2 flex items-center gap-1 text-xs text-white/60"
          onClick={onToggle}
        >
          <ChevronDown size={13} className={open ? "" : "rotate-180"} />
          时间轴
        </button>
        <IconButton
          label={playing ? "暂停" : "播放"}
          disabled={!hasAnimation || exporting}
          onClick={() => onPlayingChange(!playing)}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </IconButton>
        <IconButton
          label="循环播放时间轴"
          active={loop}
          onClick={() => onLoopChange(!loop)}
        >
          <Repeat size={14} />
        </IconButton>
        <IconButton
          label="隐藏无动画对象轨道"
          active={hideEmpty}
          onClick={() => onHideEmptyChange(!hideEmpty)}
        >
          {hideEmpty ? <EyeOff size={14} /> : <Eye size={14} />}
        </IconButton>
        <span className="ml-2 text-[10px] text-white/35">
          0:{currentTime.toFixed(2).padStart(5, "0")} ·{" "}
          {Math.floor(currentTime * frameRate)}f / 0:{duration.toFixed(1)}
        </span>
        {selectedKeyframes.size > 0 && (
          <span className="text-[10px] text-white/55">
            已选 {selectedKeyframes.size} 个 · Delete 删除
          </span>
        )}
        <button
          type="button"
          className="ml-auto rounded px-2 py-1 text-[10px] text-white/45 hover:bg-white/5"
          onClick={() => onFrameRateChange(frameRate === 30 ? 60 : 30)}
        >
          帧率 {frameRate}
        </button>
        <div className="w-32">
          <NumberField
            label="总时长"
            value={duration}
            min={1}
            max={120}
            step={1}
            suffix="秒"
            onChange={onDurationChange}
          />
        </div>
        <IconButton
          label="时间轴缩放 −"
          onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))}
        >
          <Minus size={13} />
        </IconButton>
        <input
          aria-label="时间轴缩放"
          type="range"
          min="0.5"
          max="3"
          step="0.25"
          value={zoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
          className="w-20 accent-white"
        />
        <IconButton
          label="时间轴缩放 +"
          onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
        >
          <Plus size={13} />
        </IconButton>
        <button
          type="button"
          className="text-[10px] text-white/40"
          onClick={() => onZoomChange(1)}
        >
          1×
        </button>
      </div>
      {open && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0">
            <div className="h-8 w-44 shrink-0 border-r border-white/5" />
            <div
              ref={rulerScrollRef}
              onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
              className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div
                className="relative h-8 min-w-full"
                style={{ width: `${Math.max(100, zoom * 100)}%` }}
              >
                <div className="relative flex h-8 items-end justify-between px-2 pb-1 text-[9px] text-white/30">
                  {marks.map((mark) => (
                    <span key={mark}>{mark.toFixed(1)}s</span>
                  ))}
                  <input
                    aria-label="当前时间"
                    type="range"
                    min="0"
                    max={duration}
                    step={0.01}
                    value={currentTime}
                    onChange={(event) => onTimeChange(snapTime(Number(event.target.value)))}
                    className="absolute inset-0 h-8 w-full cursor-col-resize opacity-0"
                  />
                </div>
                <div
                  className="pointer-events-none absolute bottom-0 top-0 w-px bg-red-400"
                  style={{ left: playheadLeft }}
                >
                  <div className="absolute left-0 top-0 h-8 w-1.5 -translate-x-1/2 rounded-full bg-red-400" />
                </div>
              </div>
            </div>
          </div>
          <div
            data-timeline-scroll
            className="flex min-h-0 flex-1 overflow-y-auto"
          >
          <div className="flex min-h-full w-44 shrink-0 flex-col self-start border-r border-white/5 text-xs text-white/50">
            {cameras.map((camera) => (
              <div key={camera.id} className="relative">
                <div
                  className={`flex h-8 items-center pr-2 ${selectedCameraId === camera.id ? "bg-white/[0.06] text-white/80" : ""}`}
                >
                  <button
                    type="button"
                    aria-label={`${expandedCameras[camera.id] ? "收起" : "展开"}${camera.name}属性`}
                    onClick={() =>
                      setExpandedCameras((current) => ({
                        ...current,
                        [camera.id]: !current[camera.id],
                      }))
                    }
                    className="flex min-w-0 flex-1 items-center gap-1 px-2 text-left"
                  >
                    {expandedCameras[camera.id] ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                    <Camera size={13} />
                    <span
                      className="truncate"
                      onClick={() => onCameraSelect(camera.id)}
                    >
                      {camera.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`添加${camera.name}运镜`}
                    onClick={() => {
                      setCameraMenu(
                        cameraMenu === camera.id ? null : camera.id,
                      );
                      setCharacterMenu(null);
                    }}
                    className="rounded p-1 text-white/35 hover:bg-white/10 hover:text-white"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                {cameraMenu === camera.id && (
                  <div
                    ref={menuRef}
                    className="absolute left-2 top-8 z-50 w-40 rounded-lg border border-white/10 bg-[#292929] p-1.5 shadow-2xl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onCameraPreset(camera.id);
                        setCameraMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-white/8"
                    >
                      <Film size={13} />
                      添加运镜
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCameraPath(camera.id, "camera");
                        setCameraMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-white/8"
                    >
                      <Route size={13} />
                      绘制机位路径
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCameraPath(camera.id, "target");
                        setCameraMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-white/8"
                    >
                      <Crosshair size={13} />
                      绘制注视点路径
                    </button>
                  </div>
                )}
                {expandedCameras[camera.id] &&
                  CAMERA_PROPERTIES.map((property) => (
                    <button
                      type="button"
                      key={property.id}
                      onClick={() => onCameraSelect(camera.id)}
                      className="flex h-8 w-full items-center gap-2 pl-8 pr-3 text-left text-[11px] text-white/40 hover:bg-white/5"
                    >
                      <Diamond size={9} />
                      <span>{property.label}</span>
                    </button>
                  ))}
              </div>
            ))}
            {visibleCharacters.map((object) => (
              <div key={object.id} className="relative">
                <div className="mt-1 flex h-8 items-center pr-2">
                  <button
                    type="button"
                    aria-label={`${expandedCharacters[object.id] ? "收起" : "展开"}${object.name}属性`}
                    onClick={() => {
                      setExpandedCharacters((current) => ({
                        ...current,
                        [object.id]: !current[object.id],
                      }));
                      onCharacterSelect(object.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1 px-2 text-left"
                  >
                    {expandedCharacters[object.id] ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                    <UserRound size={13} />
                    <span className="truncate">{object.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`添加${object.name}动作与路径`}
                    onClick={() => {
                      setCharacterMenu(
                        characterMenu === object.id ? null : object.id,
                      );
                      setCameraMenu(null);
                    }}
                    className="rounded p-1 text-white/35 hover:bg-white/10 hover:text-white"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                {characterMenu === object.id && (
                  <div
                    ref={menuRef}
                    className="absolute bottom-9 left-2 z-50 w-44 rounded-lg border border-white/10 bg-[#292929] p-1.5 shadow-2xl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onCharacterAction(object.id);
                        setCharacterMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-white/8"
                    >
                      <Film size={13} />
                      添加动作到时间轴
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCharacterPath(object.id, "walk");
                        setExpandedCharacters((current) => ({
                          ...current,
                          [object.id]: true,
                        }));
                        setCharacterMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-white/8"
                    >
                      <Footprints size={13} />
                      绘制行走路径
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCharacterPath(object.id, "move");
                        setExpandedCharacters((current) => ({
                          ...current,
                          [object.id]: true,
                        }));
                        setCharacterMenu(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-white/8"
                    >
                      <Move3D size={13} />
                      绘制移动路径
                    </button>
                  </div>
                )}
                {expandedCharacters[object.id] && (
                  <>
                    <button
                      type="button"
                      onClick={() => onCharacterSelect(object.id)}
                      className="flex h-8 w-full items-center gap-2 pl-8 pr-3 text-left text-[11px] text-white/40 hover:bg-white/5"
                    >
                      <Film size={11} />
                      <span>动作</span>
                    </button>
                    {CHARACTER_PROPERTIES.map((property) => {
                      const Icon = property.icon;
                      return (
                        <div key={property.id} className="flex h-8 w-full items-center pr-3 text-[11px] text-white/40 hover:bg-white/5">
                          <button
                            type="button"
                            onClick={() => onCharacterSelect(object.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 pl-8 text-left"
                          >
                            <Icon size={11} />
                            <span>{property.label}</span>
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            ))}
          </div>
          <div
            ref={trackScrollRef}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
            className="flex min-h-full min-w-0 flex-1 flex-col self-start overflow-x-auto overflow-y-hidden"
          >
            <div
              className="relative flex min-w-full flex-1 flex-col"
              style={{ width: `${Math.max(100, zoom * 100)}%` }}
              onPointerDown={startMarquee}
              onPointerMove={updateMarquee}
              onPointerUp={finishMarquee}
              onPointerCancel={() => setMarquee(null)}
            >
              {cameras.map((camera) => {
                const keyframeTimes = [
                  ...new Set(
                    CAMERA_PROPERTIES.flatMap(
                      (property) =>
                        camera.cameraKeyframes?.[property.id]?.map(
                          (frame) => frame.time,
                        ) ?? [],
                    ),
                  ),
                ].sort((a, b) => a - b);
                return (
                  <div key={camera.id} className="mx-2">
                    <div className="relative h-8 rounded bg-black/20">
                      {trackGrid()}
                      {camera.cameraMotions?.map((motion) => {
                        const selected = selectedMotion?.cameraId === camera.id && selectedMotion.motionId === motion.id;
                        return (
                          <button
                            type="button"
                            key={motion.id}
                            aria-label={`选择${motion.name}运镜`}
                            aria-pressed={selected}
                            title={`${motion.name} · ${motion.start.toFixed(2)}–${(motion.start + motion.duration).toFixed(2)} 秒`}
                            onPointerDown={(event) => startMotionDrag(event, camera, motion)}
                            onPointerMove={(event) => updateMotionDrag(event, camera, motion)}
                            onPointerUp={stopMotionDrag}
                            onPointerCancel={stopMotionDrag}
                            onClick={(event) => {
                              if (motionWasDragged.current) {
                                event.preventDefault();
                                motionWasDragged.current = false;
                                return;
                              }
                              selectCameraMotion(camera, motion);
                              onTimeChange(motion.start);
                            }}
                            className={`absolute inset-y-1 flex min-w-0 cursor-grab items-center overflow-hidden rounded-md border px-2 text-left text-[10px] whitespace-nowrap active:cursor-grabbing ${selected ? "border-white bg-white text-black" : "border-white/20 bg-[#2b2b2b]/90 text-white/60"}`}
                            style={{
                              left: `${(motion.start / duration) * 100}%`,
                              width: `${(motion.duration / duration) * 100}%`,
                            }}
                          >
                            <span className={`relative z-20 ml-3 flex min-w-0 items-center gap-1.5 py-0.5 pr-1 ${selected ? "bg-white" : "bg-[#2b2b2b]"}`}>
                              <Route size={11} className="shrink-0" />
                              <span className="truncate">{motion.name} · {motion.duration.toFixed(1)} 秒</span>
                            </span>
                          </button>
                        );
                      })}
                      {keyframeTimes.map((time) => {
                        const selected = CAMERA_PROPERTIES.some((property) =>
                          selectedKeyframes.has(
                            keyframeKey(camera.id, property.id, time),
                          ),
                        );
                        return (
                          <button
                            type="button"
                            key={time}
                            aria-label={`${camera.name}关键帧 ${time.toFixed(2)}秒`}
                            title={`${time.toFixed(2)} 秒`}
                            onClick={() => { selectKeyframes(CAMERA_PROPERTIES.filter((property) => camera.cameraKeyframes?.[property.id]?.some((frame) => Math.abs(frame.time - time) < 0.0001)).map((property) => keyframeKey(camera.id, property.id, time))); onCameraSelect(camera.id); onTimeChange(time); }}
                            className={`absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-sm p-1 hover:bg-white/10 ${selected ? "text-white" : "text-white/30 hover:text-white/60"}`}
                            style={{ left: `${(time / duration) * 100}%` }}
                          >
                            <Diamond size={10} fill="currentColor" />
                          </button>
                        );
                      })}
                    </div>
                    {expandedCameras[camera.id] &&
                      CAMERA_PROPERTIES.map((property) => {
                        const frames = [
                          ...(camera.cameraKeyframes?.[property.id] ?? []),
                        ].sort((a, b) => a.time - b.time);
                        return (
                          <div
                            key={property.id}
                            className="relative h-8 rounded bg-black/20"
                          >
                            {trackGrid()}
                            {frames.length > 1 && (
                              <div
                                className="pointer-events-none absolute top-1/2 h-px -translate-y-1/2 bg-white/25"
                                style={{
                                  left: `${(frames[0].time / duration) * 100}%`,
                                  width: `${((frames[frames.length - 1].time - frames[0].time) / duration) * 100}%`,
                                }}
                              />
                            )}
                            {frames.map((frame) => {
                              const key = keyframeKey(
                                camera.id,
                                property.id,
                                frame.time,
                              );
                              const selected = selectedKeyframes.has(key);
                              return (
                                <button
                                  type="button"
                                  key={key}
                                  data-camera-keyframe={key}
                                  aria-label={`${camera.name}${property.label}关键帧 ${frame.time.toFixed(2)}秒`}
                                  title={`${frame.time.toFixed(2)} 秒`}
                                  onClick={() => { selectKeyframes([key]); onCameraSelect(camera.id); onTimeChange(frame.time); }}
                                  className={`absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-sm p-1 hover:bg-white/10 ${selected ? "text-white" : "text-white/30 hover:text-white/60"}`}
                                  style={{
                                    left: `${(frame.time / duration) * 100}%`,
                                  }}
                                >
                                  <Diamond size={10} fill="currentColor" />
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
              {marquee && (
                <div
                  className="pointer-events-none absolute z-30 border border-sky-300/80 bg-sky-300/10"
                  style={{
                    left: Math.min(marquee.startX, marquee.currentX),
                    top: Math.min(marquee.startY, marquee.currentY),
                    width: Math.abs(marquee.currentX - marquee.startX),
                    height: Math.abs(marquee.currentY - marquee.startY),
                  }}
                />
              )}
              <div className="mx-2 mt-1">
                {visibleCharacters.map((object) => (
                  <div key={object.id}>
                    <div className="relative h-8 rounded bg-black/20">
                      {trackGrid()}
                      {renderActionSegments(object)}
                      {renderCharacterMainKeyframes(object)}
                    </div>
                    {expandedCharacters[object.id] && (
                      <>
                        <div className="relative h-8 rounded bg-black/20">
                          {trackGrid()}
                          <div className="absolute inset-0">
                            {renderActionSegments(object)}
                          </div>
                        </div>
                        {CHARACTER_PROPERTIES.map((property) => (
                          <div
                            key={property.id}
                            className="relative h-8 rounded bg-black/20"
                          >
                            {trackGrid()}
                            {renderCharacterKeyframes(object, property.id, true)}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-red-400"
                style={{ left: playheadLeft }}
              />
            </div>
          </div>
          </div>
          <div className="flex h-8 shrink-0">
            <button
              type="button"
              onClick={onCaptureShot}
              className="flex h-8 w-44 shrink-0 items-center gap-2 border-r border-white/5 px-3 text-left text-xs text-white/50 hover:bg-white/5"
            >
              <Film size={13} />
              <span>分镜编排</span>
              <Plus size={12} className="ml-auto text-white/30" />
            </button>
            <div
              ref={shotScrollRef}
              onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
              className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div
                className="relative h-8 min-w-full"
                style={{ width: `${Math.max(100, zoom * 100)}%` }}
              >
                <div className="relative mx-2 h-8 rounded bg-black/20">
                  {trackGrid()}
                  {shots.map((shot, index) => (
                    <button
                      type="button"
                      key={shot.id}
                      className="absolute top-1 h-6 overflow-hidden rounded border border-blue-300/40 bg-blue-400/20 text-[9px] text-blue-100"
                      style={{ left: `${index * 25 + 1}%`, width: "23%" }}
                      onClick={() => onTimeChange(index * shot.duration)}
                    >
                      <img
                        src={shot.image}
                        alt=""
                        className="h-full w-full object-cover opacity-60"
                      />
                      <span className="absolute inset-0 flex items-center justify-center">
                        {shot.name}
                      </span>
                    </button>
                  ))}
                  {!shots.length && (
                    <button
                      type="button"
                      onClick={onCaptureShot}
                      className="absolute inset-1 flex items-center justify-center gap-1 rounded border border-dashed border-white/10 text-[10px] text-white/30 hover:border-white/25"
                    >
                      <Plus size={11} />
                      添加分镜
                    </button>
                  )}
                </div>
                <div
                  className="pointer-events-none absolute bottom-0 top-0 w-px bg-red-400"
                  style={{ left: playheadLeft }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
