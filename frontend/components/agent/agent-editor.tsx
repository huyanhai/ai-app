"use client";

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import { FileText, Lightbulb } from "lucide-react";
import Editor, { type IEditorRef } from "@/components/pipeline/editor";
import type { EditorToken } from "@/components/pipeline/editor/nodes";
import { InlineTokenActionsContext } from "@/components/pipeline/editor/nodes";
import ReferencePicker from "@/components/pipeline/reference-picker";
import type { SubjectReference } from "@/components/chat/types";
import type { Chip } from "@/lib/agent/chips";
import { parseMessage, serializeChip } from "@/lib/agent/chips";
import type { TrayItem } from "@/lib/agent/attachments";
import type { RefNode, RefNodeKind } from "@/lib/agent/selection-refs";
import { filterSkills, skillMenuNotice } from "@/lib/agent/skills";
import { cn } from "@/lib/utils";
import { SuggestionMenu } from "./suggestion-menu";
import type { AgentAttachments } from "./use-agent-attachments";
import { useSkillCatalog } from "./use-skill-catalog";

export type NodeOption = {
  id: string;
  label: string;
  kind: RefNodeKind;
  url?: string;
};
export type AgentEditorHandle = {
  insertChip: (chip: Chip) => void;
  insertText: (text: string) => void;
  addAttachments: (
    files: ArrayLike<File> | null | undefined,
    kind: "image" | "document",
  ) => void;
  commitSelection: () => string;
  setText: (text: string) => void;
  clear: () => void;
  focus: () => void;
};

type MenuState =
  | { type: "node"; query: string; trigger: "@"; position: { left: number; top: number } }
  | { type: "skill"; query: string; trigger: "/" };
const CHIP_CLASS =
  "mx-0.5 inline-flex h-6 max-w-44 items-center rounded-md bg-white/8 px-1.5 align-middle text-xs text-white/65 ring-1 ring-white/10";

function nodeReferenceKind(kind: RefNode["kind"]): SubjectReference["kind"] {
  if (kind === "script") return "text";
  if (kind === "character") return "subject";
  return kind === "group" ? undefined : kind;
}

function chipToken(chip: Chip, refNodes: readonly RefNode[] = []): EditorToken {
  const node =
    chip.type === "node"
      ? refNodes.find((item) => item.id === chip.id)
      : undefined;
  const referenceKind = node ? nodeReferenceKind(node.kind) : undefined;
  return {
    id: chip.id,
    kind: chip.type,
    label: chip.name,
    className: cn(
      CHIP_CLASS,
      (chip.type === "model" || chip.type === "skill") &&
        "bg-white/10 text-zinc-200 ring-white/15",
    ),
    showIcon: node?.kind === "image",
    url: node?.url,
    referenceKind,
    title: `${chip.type}:${chip.id}`,
  };
}

function tokenText(token: EditorToken) {
  if (token.kind === "attachment" || token.kind === "pending") return "";
  return serializeChip({
    type: token.kind as Chip["type"],
    id: token.id,
    name: token.label,
  });
}

function attachmentToken(item: TrayItem): EditorToken {
  return {
    id: item.id,
    kind: "attachment",
    label: item.name,
    className: CHIP_CLASS,
    url: item.previewUrl || item.asset?.url,
    attachmentKind: item.kind === "document" ? "document" : "image",
    status: item.status,
    progress: item.progress,
    error: item.error,
    size: item.size,
  };
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
  attachments,
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
  attachments?: AgentAttachments;
  mentions?: boolean;
  skills?: boolean;
}) {
  const editor = useRef<IEditorRef>(null);
  const root = useRef<HTMLDivElement>(null);
  const dismissedMenu = useRef<string | null>(null);
  const committing = useRef(false);
  const pendingRef = useRef<RefNode[]>([]);
  const ghostPosition = useRef({ left: 0, top: 0 });
  const [value, setValue] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [active, setActive] = useState(0);
  const selectionKey = selection.join("\u0000");
  const catalog = useSkillCatalog(menu?.type === "skill");
  const references = useMemo<SubjectReference[]>(
    () => nodes.map((node) => ({
      id: node.id,
      name: node.label || "未命名节点",
      kind: nodeReferenceKind(node.kind),
      url: node.url,
    })),
    [nodes],
  );
  const skillItems = useMemo(
    () =>
      menu?.type === "skill"
        ? filterSkills(catalog.skills, menu.query).slice(0, 20)
        : [],
    [catalog.skills, menu],
  );
  const itemCount = menu?.type === "skill" ? skillItems.length : 0;

  useEffect(() => setActive(0), [menu?.type, menu?.query]);

  const updateValue = (next: string) => {
    setValue(next);
    onChange(next);
  };

  const insertChip = (chip: Chip, trigger?: "/" | "@") => {
    dismissedMenu.current = null;
    editor.current?.insertToken(chipToken(chip, refNodes), "current", trigger);
    setMenu(null);
  };

  const addAttachments = (
    files: ArrayLike<File> | null | undefined,
    kind: "image" | "document",
  ) => {
    attachments
      ?.add(files, kind)
      .forEach((item) =>
        editor.current?.insertToken(attachmentToken(item), "current"),
      );
  };

  const attachmentItems = attachments?.items;
  useEffect(() => {
    if (attachmentItems)
      editor.current?.syncTokens(
        attachmentItems.map(attachmentToken),
        "attachment",
      );
  }, [attachmentItems]);

  useImperativeHandle(handleRef, () => ({
    insertChip: (chip) => insertChip(chip),
    insertText: (text) => editor.current?.insertText(text, "current"),
    addAttachments,
    commitSelection: () => commitSelection(),
    setText: (text) => {
      setMenu(null);
      editor.current?.replaceContent(
        parseMessage(text).map((part) =>
          part.kind === "chip" ? chipToken(part.chip, refNodes) : part.text,
        ),
      );
    },
    clear: () => {
      setMenu(null);
      editor.current?.clear();
    },
    focus: () => {
      editor.current?.focus();
    },
  }));

  const committedIds = useMemo(
    () =>
      new Set(
        parseMessage(value).flatMap((part) =>
          part.kind === "chip" && part.chip.type === "node"
            ? [part.chip.id]
            : [],
        ),
      ),
    [value],
  );
  useEffect(() => {
    setDismissed((current) => {
      const next = current.filter((id) => selection.includes(id));
      return next.length === current.length ? current : next;
    });
  }, [selection]);
  useEffect(() => {
    editor.current?.blur();
  }, [selectionKey]);
  useEffect(() => {
    const blur = () => editor.current?.blur();
    window.addEventListener("agent:canvas-node-click", blur);
    return () => window.removeEventListener("agent:canvas-node-click", blur);
  }, []);
  const pending = useMemo(
    () =>
      refNodes.filter(
        (node) => selection.includes(node.id) && !committedIds.has(node.id) && !dismissed.includes(node.id),
      ),
    [committedIds, dismissed, refNodes, selection],
  );
  pendingRef.current = pending;
  const commitSelection = () => {
    if (committing.current) return editor.current?.getSerializedText() ?? "";
    const selected = pendingRef.current;
    pendingRef.current = [];
    committing.current = true;
    selected.forEach((node) =>
        insertChip({
          type: "node",
          id: node.id,
          name: node.label || "未命名节点",
        }),
      );
    committing.current = false;
    return editor.current?.getSerializedText() ?? "";
  };

  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length && onImages) {
      event.preventDefault();
      event.stopPropagation();
      onImages(files);
    }
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length && onImages) {
      event.preventDefault();
      event.stopPropagation();
      onImages(files);
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      (event.key.length === 1 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey) ||
      event.key === "Enter"
    )
      commitSelection();
    if (menu?.type === "skill" && itemCount > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setActive(
          (current) =>
            (current + (event.key === "ArrowDown" ? 1 : -1) + itemCount) %
            itemCount,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        const skill = skillItems[active];
        if (skill)
          insertChip(
            { type: "skill", id: skill.name, name: skill.title },
            menu.trigger,
          );
        return;
      }
    }
    if (event.key === "Escape" && menu) {
      event.preventDefault();
      event.stopPropagation();
      dismissedMenu.current = `${menu.trigger}${menu.query}`;
      setMenu(null);
      return;
    }
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.stopPropagation();
      onSubmit();
    }
  };

  return (
    <div ref={root} className="relative">
      <InlineTokenActionsContext.Provider
        value={{
          onRemove: (id) => attachments?.remove(id),
          onRetry: (id) => attachments?.retry(id),
        }}
      >
        <Editor
          ref={editor}
          onSubmit={onSubmit}
          images={[]}
          initialState=""
          noImageMention
          autoFocus={false}
          submitOnEnter={false}
          ariaLabel="Agent 消息"
          placeholder={pending.length ? "" : placeholder}
          className="agent-scroll max-h-40 min-h-[60px] overflow-y-auto whitespace-pre-wrap break-words rounded-lg py-0 text-[13.5px] leading-6 text-white/90 caret-white outline-none [&_p]:m-0 [&_p]:min-h-6 [&_p]:whitespace-pre-wrap [&_[data-lexical-text='true']]:align-middle"
          placeholderClassName="pointer-events-none absolute left-0 top-0 text-[13.5px] leading-[1.75] text-white/30"
          onFocus={() => requestAnimationFrame(() => commitSelection())}
          serializeToken={tokenText}
          onSerializedTextChange={updateValue}
          onTriggerQueryChange={(next) => {
            if (!next) {
              dismissedMenu.current = null;
              setMenu(null);
              return;
            }
            const menuKey = `${next.trigger}${next.query}`;
            if (
              dismissedMenu.current === menuKey ||
              (next.trigger === "@" ? !mentions : !skills)
            )
              setMenu(null);
            else {
              dismissedMenu.current = null;
              if (next.trigger === "@") {
                const caret = editor.current?.getCaretRect();
                setMenu(caret ? {
                  type: "node",
                  query: next.query,
                  trigger: "@",
                  position: {
                    left: Math.min(window.innerWidth - 272, Math.max(16, caret.left - 128)),
                    top: caret.top,
                  },
                } : null);
              } else {
                setMenu({ type: "skill", query: next.query, trigger: "/" });
              }
            }
          }}
          onBlur={() => {
            const rootRect = root.current?.getBoundingClientRect();
            const caret = editor.current?.getCaretRect();
            if (rootRect && caret) {
              ghostPosition.current = { left: caret.left - rootRect.left, top: caret.top - rootRect.top };
            }
            dismissedMenu.current = null;
            setMenu(null);
          }}
          onPaste={paste}
          onDrop={drop}
          onKeyDown={keyDown}
          onTokenRemove={(token) => {
            if (token.kind === "attachment") attachments?.remove(token.id);
            if (token.kind === "node") {
              setDismissed((current) => current.includes(token.id) ? current : [...current, token.id]);
            }
          }}
        />
        {pending.length > 0 && (
          <div
            className="pointer-events-none absolute z-10 flex max-w-full select-none flex-wrap items-center"
            style={ghostPosition.current}
          >
            {pending.map((node) => (
              <span
                key={node.id}
                title="聚焦输入框后引用此节点"
                className="mx-0.5 inline-flex h-6 max-w-36 items-center gap-1 rounded-md border border-dashed border-zinc-300 px-1.5 align-middle text-xs text-zinc-400"
              >
                <FileText className="size-3 shrink-0 opacity-50" />
                <span className="truncate">{node.label || "未命名节点"}</span>
              </span>
            ))}
          </div>
        )}
      </InlineTokenActionsContext.Provider>
      {menu?.type === "node" && (
        <ReferencePicker
          references={references}
          position={menu.position}
          query={menu.query}
          onSelect={(reference) => {
            const node = nodes.find((item) => item.id === reference.id);
            if (node) insertChip({ type: "node", id: node.id, name: node.label }, menu.trigger);
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {menu?.type === "skill" && (
        <SuggestionMenu
          label="插入技能"
          items={skillItems.map((skill) => ({
            key: skill.name,
            icon: Lightbulb,
            title: skill.title,
            hint: skill.description,
          }))}
          active={active}
          onActive={setActive}
          notice={skillMenuNotice(
            catalog.status,
            catalog.skills.length,
            skillItems.length,
          )}
          onPick={(index) => {
            const skill = skillItems[index];
            if (skill)
              insertChip(
                { type: "skill", id: skill.name, name: skill.title },
                menu.trigger,
              );
          }}
        />
      )}
    </div>
  );
}
