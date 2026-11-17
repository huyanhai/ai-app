"use client";

import { useRef } from "react";
import { FileText, ImagePlus, Paperclip, Plus } from "lucide-react";
import type { AgentAttachments } from "./use-agent-attachments";
import { AgentMenuButton, AgentPopover } from "./ui";
import { AGENT_ICON_BTN } from "./styles";

export function AttachPopover({ attachments, vision }: { attachments: AgentAttachments; vision: boolean }) {
  const images = useRef<HTMLInputElement>(null);
  const documents = useRef<HTMLInputElement>(null);
  return (
    <>
      <AgentPopover label="添加附件" side="top" className="w-52 p-1.5" trigger={<span className={AGENT_ICON_BTN} title="添加附件"><Plus /></span>}>
        {(close) => <>
          <AgentMenuButton disabled={!vision} onClick={() => { images.current?.click(); close(); }}><ImagePlus className="size-4" />上传图片{!vision && <span className="ml-auto text-[11px] text-zinc-400">模型不能看图</span>}</AgentMenuButton>
          <AgentMenuButton onClick={() => { documents.current?.click(); close(); }}><FileText className="size-4" />上传故事或剧本<span className="ml-auto text-[11px] text-zinc-400">TXT / MD</span></AgentMenuButton>
        </>}
      </AgentPopover>
      <input ref={images} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(event) => { attachments.add(event.target.files); event.target.value = ""; }} />
      <input ref={documents} type="file" accept=".txt,.md,text/plain,text/markdown" multiple className="hidden" onChange={(event) => { attachments.addDocuments(event.target.files); event.target.value = ""; }} />
      <span className="hidden"><Paperclip /></span>
    </>
  );
}

