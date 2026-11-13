"use client";

import { DragEvent, MouseEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Grip, Pencil, Plus, X } from "lucide-react";
import ToolboxModal from "./toolbox-modal";
import ColorWheel from "./color-wheel";
import ColorPicker from "./color-picker";
import { IconButton } from "@/components/ui/icon-button";
import { TPalette } from "./data";
import {
  contrastingText,
  harmonizePalette,
  PaletteColorMode,
} from "./palette-color";

const HEX_PATTERN = /^#[0-9A-F]{6}$/;
const MODES: { id: PaletteColorMode; label: string; icon: ReactNode }[] = [
  {
    id: "custom",
    label: "自定义取色",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="8" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="14" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="2" /></svg>,
  },
  {
    id: "analogous",
    label: "临近色取色",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M12 6v11m-4-4 4 4 4-4" /></svg>,
  },
  {
    id: "complementary",
    label: "互补色",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M12 3v18M12 12l7.8-4.5M12 12l7.8 4.5" /></svg>,
  },
  {
    id: "triadic",
    label: "三等分取色",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M12 12V3m0 9 7.8 4.5M12 12l-7.8 4.5" /></svg>,
  },
];

const PaletteEditor = ({
  draft,
  duplicateName,
  confirmDisabled,
  onChange,
  onClose,
  onSave,
}: {
  draft: TPalette;
  duplicateName: boolean;
  confirmDisabled: boolean;
  onChange: (draft: TPalette) => void;
  onClose: () => void;
  onSave: () => void;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [nameEditing, setNameEditing] = useState(false);
  const [mode, setMode] = useState<PaletteColorMode>("custom");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pickerPosition, setPickerPosition] = useState({ left: 16, top: 16 });
  const [pickingImage, setPickingImage] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0];

  useEffect(() => {
    if (!nameEditing || !nameRef.current) return;
    nameRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(nameRef.current);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [nameEditing]);

  const updateColor = (index: number, color: string) => {
    onChange({
      ...draft,
      colors: harmonizePalette(draft.colors, index, color, mode),
    });
  };

  const changeMode = (nextMode: PaletteColorMode) => {
    setMode(nextMode);
    onChange({
      ...draft,
      colors: harmonizePalette(draft.colors, activeIndex, draft.colors[activeIndex], nextMode),
    });
  };

  const dropColor = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    const sourceIndex = Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isInteger(sourceIndex) || sourceIndex === targetIndex) {
      setDraggingIndex(null);
      return;
    }
    const colors = [...draft.colors];
    const [moved] = colors.splice(sourceIndex, 1);
    colors.splice(targetIndex, 0, moved);
    onChange({ ...draft, colors });
    setActiveIndex(targetIndex);
    setDraggingIndex(null);
  };

  const openPicker = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const height = 207;
    const left = Math.max(16, Math.min(rect.left - 30, window.innerWidth - 242));
    const above = rect.top - height - 12;
    const top = above >= 16
      ? above
      : Math.min(rect.bottom + 12, window.innerHeight - height - 16);
    setActiveIndex(index);
    setPickerPosition({ left, top });
    setPickerIndex(index);
    setPickingImage(false);
  };

  const pickImage = async () => {
    const EyeDropperApi = (window as Window & {
      EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
    }).EyeDropper;
    if (EyeDropperApi && pickerIndex !== null) {
      try {
        const result = await new EyeDropperApi().open();
        updateColor(pickerIndex, result.sRGBHex.toUpperCase());
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPickingImage(true);
      }
      return;
    }
    setPickingImage(true);
  };

  const pickImagePixel = (event: MouseEvent<HTMLImageElement>) => {
    if (!pickingImage || pickerIndex === null || !imageRef.current) return;
    const image = imageRef.current;
    const rect = image.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - rect.left) / rect.width * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - rect.top) / rect.height * canvas.height)));
    const pixel = context.getImageData(x, y, 1, 1).data;
    const color = `#${[pixel[0], pixel[1], pixel[2]]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`.toUpperCase();
    updateColor(pickerIndex, color);
    setPickingImage(false);
  };

  return (
    <ToolboxModal
      open
      title={
        <span className="flex min-w-0 items-center gap-1">
          <span
            ref={nameRef}
            role={nameEditing ? "textbox" : undefined}
            tabIndex={nameEditing ? 0 : undefined}
            contentEditable={nameEditing}
            suppressContentEditableWarning
            aria-label="配色名称"
            onBlur={(event) => {
              if (!nameEditing) return;
              onChange({
                ...draft,
                name: event.currentTarget.textContent?.slice(0, 30) ?? "",
              });
              setNameEditing(false);
            }}
            onKeyDown={(event) => {
              if (!nameEditing) return;
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.currentTarget.textContent = draft.name;
                event.currentTarget.blur();
              }
            }}
            className="min-w-0 max-w-72 overflow-hidden whitespace-nowrap rounded-md bg-transparent px-2 py-1 text-md text-white caret-white outline-none focus:bg-white/5"
          >{draft.name}</span>
          {!nameEditing && (
            <button
              type="button"
              aria-label="编辑配色名称"
              onClick={() => setNameEditing(true)}
              className="shrink-0 text-white/55 transition-colors hover:text-white cursor-pointer"
            >
              <Pencil size={17} />
            </button>
          )}
        </span>
      }
      width={580}
      onClose={onClose}
      onConfirm={onSave}
      confirmLabel="保存"
      confirmDisabled={confirmDisabled}
      closeIconSize={24}
      classNames={{
        panel: "max-h-[90vh] overflow-y-auto rounded-[24px] border-black/20 bg-[#242424]",
        header: "px-6 pt-5",
        title: "min-w-0 flex-1",
        close: "size-8 text-white/75",
        footer: "px-6 pb-5 pt-4",
        confirm: "h-10 w-24 rounded-xl px-0 py-0 text-sm font-medium",
      }}
    >
      <div className="px-6 pt-5">
        {!draft.image && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/75">{activeMode.label}</span>
            <div className="flex h-9 items-center gap-1 rounded-xl border border-white/10 bg-[#1c1c1e]/95 p-1 shadow-2xl">
              {MODES.map((item) => (
                <IconButton
                  key={item.id}
                  label={item.label}
                  active={mode === item.id}
                  aria-pressed={mode === item.id}
                  className="size-7"
                  onClick={() => changeMode(item.id)}
                >
                  <span className="size-4">{item.icon}</span>
                </IconButton>
              ))}
            </div>
          </div>
        )}
        {duplicateName && <div className="mt-2 text-xs text-red-300">配色名称已存在</div>}
        {draft.image ? (
          <div className="relative">
            {pickingImage && (
              <div className="absolute left-3 top-3 z-10 rounded-lg bg-black/65 px-3 py-2 text-xs text-white">
                点击图片吸取颜色
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={draft.image}
              alt={draft.name}
              onClick={pickImagePixel}
              className={`aspect-[1.9] w-full rounded-2xl object-cover ${
                pickingImage ? "cursor-crosshair" : ""
              }`}
            />
          </div>
        ) : (
          <div className="mx-auto my-3.5" style={{ width: "min(21vh, 210px)" }}>
            <ColorWheel
              colors={draft.colors}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
              onChange={updateColor}
            />
          </div>
        )}
        <div className="mb-3 mt-5 flex items-center justify-between">
          <span className="text-[12px] text-white/65">{draft.colors.length} 个颜色</span>
        </div>
        <div
          className="grid grid-cols-7 gap-2"
          style={{ gridAutoRows: "68px" }}
        >
          {draft.colors.map((color, index) => {
            const validColor = HEX_PATTERN.test(color) ? color : "#000000";
            const textColor = contrastingText(validColor);
            return (
              <div
                key={index}
                draggable
                role="button"
                tabIndex={0}
                aria-label={`${index === 0 ? "主色" : `颜色 ${index + 1}`}，拖拽调整位置`}
                aria-pressed={activeIndex === index}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setActiveIndex(index);
                }}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(index));
                  setDraggingIndex(index);
                  setActiveIndex(index);
                }}
                onDragEnd={() => setDraggingIndex(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropColor(event, index)}
                className={`group relative cursor-grab rounded-xl border-2 p-2 transition-[opacity,border-color] active:cursor-grabbing ${
                  index === 0 ? "row-span-2 col-span-2" : ""
                } ${activeIndex === index ? "border-white" : "border-transparent"} ${
                  draggingIndex === index ? "opacity-35" : "opacity-100"
                }`}
                style={{ backgroundColor: validColor, color: textColor }}
              >
                {index === 0 && (
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-center gap-1 whitespace-nowrap text-xs font-medium">
                      <Grip size={14} />
                      主色
                    </div>
                    <input
                      aria-label="主色色值"
                      value={color}
                      maxLength={7}
                      onChange={(event) => updateColor(0, event.target.value.toUpperCase())}
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => event.stopPropagation()}
                      className="w-full bg-transparent font-mono text-xs uppercase outline-none"
                      style={{ color: textColor }}
                    />
                  </div>
                )}
                {index > 0 && (
                  <Grip
                    size={14}
                    className="pointer-events-none absolute left-2 top-2"
                  />
                )}
                {draft.image && (
                  <button
                    type="button"
                    aria-label={`编辑颜色 ${index + 1}`}
                    onClick={(event) => openPicker(event, index)}
                    className={`absolute bottom-1.5 right-1.5 flex size-5 items-center justify-center transition-opacity focus:opacity-100 group-hover:opacity-100 cursor-pointer ${
                      activeIndex === index ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <Pencil size={15} />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`删除颜色 ${index + 1}`}
                  disabled={draft.colors.length === 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange({
                      ...draft,
                      colors: draft.colors.filter((_, colorIndex) => colorIndex !== index),
                    });
                    setActiveIndex(Math.max(0, activeIndex - (index <= activeIndex ? 1 : 0)));
                  }}
                  className={`absolute -right-2.5 -top-2.5 flex size-5 border border-white/5 shadow-2xl bg-[#26262a] items-center justify-center rounded-full text-white opacity-0 transition-opacity hover:bg-black/45 focus:opacity-100 group-hover:opacity-100 disabled:hidden cursor-pointer`}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
          {draft.colors.length < 11 && (
            <button
              type="button"
              aria-label="添加颜色"
              onClick={() => {
                onChange({ ...draft, colors: [...draft.colors, "#FFFFFF"] });
                setActiveIndex(draft.colors.length);
              }}
              className="flex items-center justify-center rounded-xl bg-white/[0.035] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white cursor-pointer"
            >
              <Plus size={28} />
            </button>
          )}
          {Array.from({
            length: Math.max(0, 11 - draft.colors.length - (draft.colors.length < 11 ? 1 : 0)),
          }).map((_, index) => (
            <div key={`empty-${index}`} className="rounded-xl bg-white/[0.025]" />
          ))}
        </div>
      </div>
      {pickerIndex !== null && draft.colors[pickerIndex] !== undefined && (
        <>
          <div className={`fixed inset-0 z-[60] ${pickingImage ? "pointer-events-none" : ""}`} onClick={() => {
            setPickerIndex(null);
            setPickingImage(false);
          }} />
          <div
            className={`fixed z-[70] ${pickingImage ? "pointer-events-none" : ""}`}
            style={pickerPosition}
            onClick={(event) => event.stopPropagation()}
          >
            <ColorPicker
              color={draft.colors[pickerIndex]}
              pickingImage={pickingImage}
              onChange={(color) => updateColor(pickerIndex, color)}
              onPickImage={() => void pickImage()}
            />
          </div>
        </>
      )}
    </ToolboxModal>
  );
};

export default PaletteEditor;
