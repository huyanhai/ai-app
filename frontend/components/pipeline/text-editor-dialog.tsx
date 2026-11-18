"use client";

import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const EDITOR_CLASS = cn(
  "nowheel min-h-72 max-h-[60vh] overflow-y-auto px-1 py-2 text-sm leading-7 break-words whitespace-pre-wrap outline-none select-text",
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold",
  "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_p]:my-1.5 [&_strong]:font-semibold [&_s]:opacity-70",
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-white/15 [&_blockquote]:pl-3 [&_blockquote]:text-white/55",
  "[&_hr]:my-4 [&_hr]:border-white/10",
  "[&_code]:rounded [&_code]:bg-white/8 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px]",
  "[&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:bg-white/6 [&_pre]:px-3 [&_pre]:py-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
);

type ToolbarItem = {
  label: string;
  icon: ReactNode;
  run: (editor: Editor) => void;
  active?: (editor: Editor) => boolean;
  enabled?: (editor: Editor) => boolean;
};

const TOOLBAR_GROUPS: ToolbarItem[][] = [
  [
    { label: "一级标题", icon: <Heading1 />, run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: (editor) => editor.isActive("heading", { level: 1 }) },
    { label: "二级标题", icon: <Heading2 />, run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: (editor) => editor.isActive("heading", { level: 2 }) },
    { label: "三级标题", icon: <Heading3 />, run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: (editor) => editor.isActive("heading", { level: 3 }) },
  ],
  [
    { label: "加粗", icon: <Bold />, run: (editor) => editor.chain().focus().toggleBold().run(), active: (editor) => editor.isActive("bold") },
    { label: "斜体", icon: <Italic />, run: (editor) => editor.chain().focus().toggleItalic().run(), active: (editor) => editor.isActive("italic") },
    { label: "删除线", icon: <Strikethrough />, run: (editor) => editor.chain().focus().toggleStrike().run(), active: (editor) => editor.isActive("strike") },
    { label: "行内代码", icon: <Code />, run: (editor) => editor.chain().focus().toggleCode().run(), active: (editor) => editor.isActive("code") },
  ],
  [
    { label: "无序列表", icon: <List />, run: (editor) => editor.chain().focus().toggleBulletList().run(), active: (editor) => editor.isActive("bulletList") },
    { label: "有序列表", icon: <ListOrdered />, run: (editor) => editor.chain().focus().toggleOrderedList().run(), active: (editor) => editor.isActive("orderedList") },
    { label: "引用", icon: <Quote />, run: (editor) => editor.chain().focus().toggleBlockquote().run(), active: (editor) => editor.isActive("blockquote") },
    { label: "分隔线", icon: <Minus />, run: (editor) => editor.chain().focus().setHorizontalRule().run() },
  ],
  [
    { label: "撤销", icon: <Undo2 />, run: (editor) => editor.chain().focus().undo().run(), enabled: (editor) => editor.can().undo() },
    { label: "重做", icon: <Redo2 />, run: (editor) => editor.chain().focus().redo().run(), enabled: (editor) => editor.can().redo() },
  ],
];

function Toolbar({ editor }: { editor: Editor }) {
  const keepFocus = (event: MouseEvent) => event.preventDefault();
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-white/10 pb-2">
      {TOOLBAR_GROUPS.map((group, index) => (
        <div key={group[0].label} className="flex items-center gap-0.5">
          {index > 0 && <span className="mx-1.5 h-4 w-px bg-white/10" aria-hidden />}
          {group.map((item) => {
            const pressed = item.active?.(editor) ?? false;
            return (
              <Button
                key={item.label}
                type="button"
                variant="ghost"
                size="icon-sm"
                title={item.label}
                aria-label={item.label}
                aria-pressed={item.active ? pressed : undefined}
                disabled={item.enabled ? !item.enabled(editor) : false}
                className={cn("text-white/65 hover:bg-white/10 hover:text-white", pressed && "bg-white/10 text-white")}
                onMouseDown={keepFocus}
                onClick={() => item.run(editor)}
              >
                {item.icon}
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TextEditorPane({
  text,
  editable,
  onReader,
}: {
  text: string;
  editable: boolean;
  onReader: (read: (() => string) | null) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false, underline: false }), Markdown],
    content: text,
    contentType: "markdown",
    editable,
    autofocus: editable ? "end" : false,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        "aria-label": "文本内容",
        "aria-multiline": "true",
        role: "textbox",
        class: EDITOR_CLASS,
      },
    },
  });

  useEffect(() => {
    onReader(editor ? () => editor.getMarkdown() : null);
    return () => onReader(null);
  }, [editor, onReader]);

  useEffect(() => {
    editor?.setEditable(editable, false);
  }, [editable, editor]);

  if (!editor) return null;
  return (
    <>
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </>
  );
}

export default function TextEditorDialog({
  open,
  onOpenChange,
  title,
  text,
  editable = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text: string;
  editable?: boolean;
  onSave?: (text: string) => void;
}) {
  const readMarkdown = useRef<(() => string) | null>(null);
  const setReader = useCallback((read: (() => string) | null) => {
    readMarkdown.current = read;
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next && editable && onSave && readMarkdown.current) {
      const draft = readMarkdown.current();
      if (draft !== text) onSave(draft);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="border-white/10 bg-[#1c1c1e] text-white/85 ring-white/10 sm:max-w-4xl"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="pr-8 text-base font-medium text-white/90">{title}</DialogTitle>
        </DialogHeader>
        <TextEditorPane text={text} editable={editable} onReader={setReader} />
      </DialogContent>
    </Dialog>
  );
}
