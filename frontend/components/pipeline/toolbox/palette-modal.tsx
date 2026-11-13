"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  ImagePlus,
  Layers,
  MoreHorizontal,
  Palette,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import ToolboxModal from "./toolbox-modal";
import PaletteEditor from "./palette-editor";
import { PALETTES, TPalette } from "./data";
import { paletteFromImage } from "./palette-image";
import type { TPaletteSelection } from "../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STORAGE_KEY = "jimeng-custom-palettes";
const DEFAULT_COLORS = [
  "#4B90E2",
  "#E24B90",
  "#90E24C",
  "#2F598C",
  "#8C2E59",
  "#588C2F",
  "#B2D5FF",
  "#FFB2D5",
  "#D5FFB2",
  "#668FC0",
  "#C0668F",
];
const HEX_PATTERN = /^#[0-9A-F]{6}$/;

const menuClassName =
  "z-[80] min-w-36 border-white/10 bg-[#29292b] p-1.5 text-white shadow-2xl";
const menuItemClassName =
  "cursor-pointer rounded-md px-2.5 py-2 text-white/80 focus:bg-white/10 focus:text-white";

const PalettePreview = ({ palette }: { palette: TPalette }) =>
  palette.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={palette.image} alt={palette.name} className="h-32 w-full object-cover" />
  ) : (
    <div
      className="h-32 w-full"
      style={{
        background: `linear-gradient(135deg, ${palette.colors.join(",")})`,
      }}
    />
  );

const PaletteModal = ({
  open,
  value,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value?: string | TPaletteSelection;
  onClose: () => void;
  onConfirm: (palette: TPaletteSelection | null) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [palettes, setPalettes] = useState<TPalette[]>(PALETTES);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<TPalette | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [imageError, setImageError] = useState("");
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TPalette[];
        if (Array.isArray(parsed)) setPalettes(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [palettes, storageReady]);

  useEffect(() => {
    if (open) {
      setSelected(typeof value === "string" ? value : value?.name ?? null);
      setDraft(null);
      setEditingName(null);
      setImageError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nextCustomName = () => {
    let index = palettes.length ? 1 : 0;
    let name = index ? `未命名配色 ${index}` : "未命名配色";
    while (palettes.some((palette) => palette.name === name)) {
      index += 1;
      name = `未命名配色 ${index}`;
    }
    return name;
  };

  const createCustom = () => {
    setEditingName(null);
    setDraft({ name: nextCustomName(), colors: [...DEFAULT_COLORS], image: "" });
  };

  const editPalette = (palette: TPalette) => {
    setEditingName(palette.name);
    setDraft({ ...palette, colors: [...palette.colors] });
  };

  const deletePalette = (name: string) => {
    setPalettes((current) => current.filter((palette) => palette.name !== name));
    if (selected === name) setSelected(null);
  };

  const importImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setExtracting(true);
    setImageError("");
    try {
      const extracted = await paletteFromImage(file);
      setEditingName(null);
      setDraft({
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 30) || nextCustomName(),
        ...extracted,
      });
    } catch {
      setImageError("图片读取失败，请换一张图片重试");
    } finally {
      setExtracting(false);
    }
  };

  const trimmedName = draft?.name.trim() ?? "";
  const invalidColors = draft?.colors.some((color) => !HEX_PATTERN.test(color)) ?? false;
  const duplicateName = draft
    ? palettes.some(
        (palette) => palette.name === trimmedName && palette.name !== editingName,
      )
    : false;
  const draftInvalid = !trimmedName || invalidColors || duplicateName || !draft?.colors.length;

  const saveDraft = () => {
    if (!draft || draftInvalid) return;
    const saved = {
      ...draft,
      name: trimmedName,
      colors: draft.colors.map((color) => color.toUpperCase()),
    };
    setPalettes((current) =>
      editingName
        ? current.map((palette) => (palette.name === editingName ? saved : palette))
        : [saved, ...current],
    );
    setSelected(saved.name);
    setDraft(null);
    setEditingName(null);
  };

  if (draft) {
    return (
      <PaletteEditor
        draft={draft}
        duplicateName={duplicateName}
        confirmDisabled={draftInvalid}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSave={saveDraft}
      />
    );
  }

  return (
    <ToolboxModal
      open={open}
      title="配色"
      width={920}
      onClose={onClose}
      onConfirm={() => {
        const palette = palettes.find((item) => item.name === selected);
        if (palette) onConfirm({ name: palette.name, colors: palette.colors });
      }}
      confirmDisabled={!palettes.some((palette) => palette.name === selected)}
      headerAction={
        selected ? (
          <button
            onClick={() => onConfirm(null)}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <RotateCcw size={14} />
            全部重置
          </button>
        ) : undefined
      }
    >
      <input ref={fileRef} type="file" accept="image/*" onChange={importImage} className="hidden" />
      <div className="grid max-h-[52vh] grid-cols-4 gap-4 overflow-y-auto px-6 pt-4 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={extracting}
            className="flex flex-col text-left outline-none cursor-pointer disabled:cursor-wait"
          >
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 text-white/35 transition-colors hover:border-white/30 hover:text-white/70">
              {extracting ? <span className="text-xs">正在提取颜色…</span> : <Layers size={22} />}
            </div>
            <div className="pt-5 pb-2 text-center text-xs text-white/60">创建配色</div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className={menuClassName}>
            <DropdownMenuItem className={menuItemClassName} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={15} />
              从图片创建
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItemClassName} onClick={createCustom}>
              <Palette size={15} />
              自定义配色
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {palettes.map((palette) => (
          <div key={palette.name} className="group relative flex flex-col">
            <button
              aria-pressed={selected === palette.name}
              onClick={() => setSelected(palette.name)}
              className="flex flex-col text-left cursor-pointer"
            >
              <div
                className={`overflow-hidden rounded-xl border-2 transition-colors ${
                  selected === palette.name ? "border-white" : "border-transparent"
                }`}
              >
                <PalettePreview palette={palette} />
              </div>
              <div className="flex min-h-5 flex-wrap justify-center gap-1 px-1 pt-2">
                {palette.colors.map((color, index) => (
                  <span
                    key={`${color}-${index}`}
                    className="size-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div
                className={`truncate px-1 py-1.5 text-center text-xs transition-colors ${
                  selected === palette.name ? "text-white" : "text-white/60"
                }`}
                title={palette.name}
              >
                {palette.name}
              </div>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`${palette.name}操作`}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-lg bg-black/55 text-white/75 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100 cursor-pointer"
              >
                <MoreHorizontal size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent className={menuClassName} align="end">
                <DropdownMenuItem className={menuItemClassName} onClick={() => editPalette(palette)}>
                  <Pencil size={15} />
                  编辑配色
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={`${menuItemClassName} text-red-300 focus:text-red-500`}
                  onClick={() => deletePalette(palette.name)}
                >
                  <Trash2 size={15} />
                  删除配色
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
      {(imageError || storageError) && (
        <div className="px-6 pt-2 text-xs text-red-300">
          {imageError || "本地存储空间不足，新配色可能无法在刷新后保留"}
        </div>
      )}
    </ToolboxModal>
  );
};

export default PaletteModal;
