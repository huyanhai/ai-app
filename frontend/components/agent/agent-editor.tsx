"use client";

import {
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import { Clapperboard, FileText, Group, Image as ImageIcon, Lightbulb, Music, UserRound } from "lucide-react";
import type { Chip } from "@/lib/agent/chips";
import { parseMessage, serializeChip } from "@/lib/agent/chips";
import type { RefNode, RefNodeKind } from "@/lib/agent/selection-refs";
import { filterSkills, skillMenuNotice } from "@/lib/agent/skills";
import { cn } from "@/lib/utils";
import { SuggestionMenu } from "./suggestion-menu";
import { useSkillCatalog } from "./use-skill-catalog";

export type NodeOption = { id: string; label: string; kind: RefNodeKind };
export type AgentEditorHandle = {
  insertChip: (chip: Chip) => void;
  insertText: (text: string) => void;
  setText: (text: string) => void;
  clear: () => void;
  focus: () => void;
};

type MenuState = { type: "node" | "skill"; query: string; range: Range };
const KIND_ICON = { script: FileText, image: ImageIcon, video: Clapperboard, audio: Music, character: UserRound, group: Group } as const;
const CHIP_CLASS = "mx-0.5 inline-flex h-6 max-w-44 items-center rounded-md bg-white/8 px-1.5 align-middle text-xs text-white/65 ring-1 ring-white/10";

function chipElement(chip: Chip) {
  const element = document.createElement("span");
  element.contentEditable = "false";
  element.dataset.chipType = chip.type;
  element.dataset.chipId = chip.id;
  element.dataset.chipName = chip.name;
  element.className = cn(CHIP_CLASS, (chip.type === "model" || chip.type === "skill") && "bg-[#33a3ff]/15 text-[#8ccfff] ring-[#33a3ff]/20");
  element.textContent = chip.name;
  element.title = `${chip.type}:${chip.id}`;
  return element;
}

function insertNodeAtCaret(node: Node, range?: Range | null) {
  const selection = window.getSelection();
  const target = range ?? (selection?.rangeCount ? selection.getRangeAt(0) : null);
  if (!target) return false;
  target.deleteContents();
  target.insertNode(node);
  target.setStartAfter(node);
  target.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(target);
  return true;
}

function serialize(root: HTMLElement) {
  const visit = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return "";
    if (node.tagName === "BR") return "\n";
    if (node.dataset.chipType) return serializeChip({ type: node.dataset.chipType as Chip["type"], id: node.dataset.chipId ?? "", name: node.dataset.chipName ?? "" });
    let value = Array.from(node.childNodes).map(visit).join("");
    if (node !== root && ["DIV", "P"].includes(node.tagName) && value && !value.endsWith("\n")) value += "\n";
    return value;
  };
  return visit(root).replace(/\n$/, "").replace(/\u00a0/g, " ");
}

export function AgentEditor({
  handleRef,
  nodes,
  selection,
  refNodes,
  placeholder,
  onChange,
  onSubmit,
  onImages,
  mentions = true,
  skills = true,
}: {
  handleRef: Ref<AgentEditorHandle>;
  nodes: NodeOption[];
  selection: readonly string[];
  refNodes: readonly RefNode[];
  placeholder: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onImages?: (files: ArrayLike<File> | null | undefined) => void;
  mentions?: boolean;
  skills?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [empty, setEmpty] = useState(true);
  const [focused, setFocused] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [active, setActive] = useState(0);
  const catalog = useSkillCatalog(menu?.type === "skill");
  const nodeItems = useMemo(() => {
    const query = menu?.type === "node" ? menu.query.toLowerCase() : "";
    return nodes.filter((node) => !query || node.label.toLowerCase().includes(query)).slice(0, 20);
  }, [menu, nodes]);
  const skillItems = useMemo(() => menu?.type === "skill" ? filterSkills(catalog.skills, menu.query).slice(0, 20) : [], [catalog.skills, menu]);
  const itemCount = menu?.type === "node" ? nodeItems.length : skillItems.length;

  const update = () => {
    if (!root.current) return;
    const value = serialize(root.current);
    setEmpty(!value.trim());
    onChange(value);
  };

  const detectMenu = () => {
    const selectionObject = window.getSelection();
    if (!selectionObject?.rangeCount || !root.current?.contains(selectionObject.anchorNode)) return setMenu(null);
    const range = selectionObject.getRangeAt(0);
    if (!range.collapsed || range.startContainer.nodeType !== Node.TEXT_NODE) return setMenu(null);
    const before = (range.startContainer.textContent ?? "").slice(0, range.startOffset);
    const match = before.match(/(?:^|\s)([@\/])([\p{L}\p{N}_-]*)$/u);
    if (!match || (match[1] === "@" ? !mentions : !skills)) return setMenu(null);
    const start = range.startOffset - match[0].length + (match[0].startsWith(" ") || match[0].startsWith("\n") ? 1 : 0);
    const trigger = range.cloneRange();
    trigger.setStart(range.startContainer, start);
    trigger.setEnd(range.startContainer, range.startOffset);
    setActive(0);
    setMenu({ type: match[1] === "@" ? "node" : "skill", query: match[2], range: trigger });
  };

  const insertChip = (chip: Chip, range?: Range | null) => {
    root.current?.focus();
    const element = chipElement(chip);
    if (!insertNodeAtCaret(element, range ?? savedRange.current) && root.current) root.current.append(element);
    insertNodeAtCaret(document.createTextNode("\u00a0"));
    setMenu(null);
    update();
  };

  const renderText = (text: string) => {
    if (!root.current) return;
    root.current.replaceChildren();
    for (const part of parseMessage(text)) {
      if (part.kind === "chip") root.current.append(chipElement(part.chip), document.createTextNode("\u00a0"));
      else root.current.append(document.createTextNode(part.text));
    }
    const range = document.createRange();
    range.selectNodeContents(root.current);
    range.collapse(false);
    const selectionObject = window.getSelection();
    selectionObject?.removeAllRanges();
    selectionObject?.addRange(range);
    update();
  };

  useImperativeHandle(handleRef, () => ({
    insertChip: (chip) => insertChip(chip),
    insertText: (text) => {
      root.current?.focus();
      if (!insertNodeAtCaret(document.createTextNode(text), savedRange.current) && root.current) root.current.append(document.createTextNode(text));
      update();
    },
    setText: renderText,
    clear: () => { root.current?.replaceChildren(); setMenu(null); update(); },
    focus: () => root.current?.focus(),
  }));

  const committedIds = new Set(Array.from(root.current?.querySelectorAll<HTMLElement>("[data-chip-id]") ?? []).map((element) => element.dataset.chipId));
  const pending = focused ? [] : refNodes.filter((node) => selection.includes(node.id) && !committedIds.has(node.id));
  const commitSelection = () => {
    window.requestAnimationFrame(() => {
      if (!root.current) return;
      const committed = new Set(Array.from(root.current.querySelectorAll<HTMLElement>("[data-chip-id]")).map((element) => element.dataset.chipId));
      refNodes.filter((node) => selection.includes(node.id) && !committed.has(node.id)).forEach((node) => insertChip({ type: "node", id: node.id, name: node.label || "未命名节点" }));
    });
  };

  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (files.length && onImages) {
      event.preventDefault();
      onImages(files);
      return;
    }
    event.preventDefault();
    insertNodeAtCaret(document.createTextNode(event.clipboardData.getData("text/plain")));
    update();
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    if (files.length && onImages) {
      event.preventDefault();
      onImages(files);
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (menu && itemCount > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + itemCount) % itemCount);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        if (menu.type === "node") {
          const node = nodeItems[active];
          if (node) insertChip({ type: "node", id: node.id, name: node.label }, menu.range);
        } else {
          const skill = skillItems[active];
          if (skill) insertChip({ type: "skill", id: skill.name, name: skill.title }, menu.range);
        }
        return;
      }
    }
    if (event.key === "Escape" && menu) {
      event.preventDefault();
      setMenu(null);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative px-1">
      {empty && !focused && pending.length > 0 && <div className="pointer-events-none absolute left-2 top-0 flex max-w-[calc(100%-16px)] flex-wrap gap-1">{pending.map((node) => <span key={node.id} className="inline-flex h-6 max-w-36 items-center gap-1 rounded-md border border-dashed border-zinc-300 px-1.5 text-xs text-zinc-400">{node.kind === "group" ? <Group className="size-3" /> : <FileText className="size-3" />}<span className="truncate">{node.label}</span></span>)}</div>}
      {empty && pending.length === 0 && <span className="pointer-events-none absolute left-2 top-0 text-[13.5px] leading-[1.75] text-white/30">{placeholder}</span>}
      <div
        ref={root}
        role="textbox"
        aria-label="Agent 消息"
        aria-multiline
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={() => { update(); detectMenu(); }}
        onKeyUp={detectMenu}
        onClick={detectMenu}
        onKeyDown={keyDown}
        onFocus={() => { setFocused(true); commitSelection(); }}
        onBlur={() => {
          setFocused(false);
          const selectionObject = window.getSelection();
          if (selectionObject?.rangeCount) savedRange.current = selectionObject.getRangeAt(0).cloneRange();
          setMenu(null);
        }}
        onPaste={paste}
        onDrop={drop}
        className="agent-scroll max-h-40 min-h-[60px] overflow-y-auto whitespace-pre-wrap break-words rounded-lg px-1 py-0 text-[13.5px] leading-6 text-white/90 outline-none empty:before:content-none"
      />
      {menu?.type === "node" && <SuggestionMenu label="引用节点" items={nodeItems.map((node) => ({ key: node.id, icon: KIND_ICON[node.kind], title: node.label || "未命名节点" }))} active={active} onActive={setActive} notice={nodeItems.length ? null : "没有匹配的节点"} onPick={(index) => { const node = nodeItems[index]; if (node) insertChip({ type: "node", id: node.id, name: node.label }, menu.range); }} />}
      {menu?.type === "skill" && <SuggestionMenu label="插入技能" items={skillItems.map((skill) => ({ key: skill.name, icon: Lightbulb, title: skill.title, hint: skill.description }))} active={active} onActive={setActive} notice={skillMenuNotice(catalog.status, catalog.skills.length, skillItems.length)} onPick={(index) => { const skill = skillItems[index]; if (skill) insertChip({ type: "skill", id: skill.name, name: skill.title }, menu.range); }} />}
    </div>
  );
}

