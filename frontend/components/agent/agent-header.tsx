"use client";

import { useState } from "react";
import { Check, ChevronDown, Minus, Pencil, Settings, SquarePen, Trash2 } from "lucide-react";
import type { AgentSessionDto } from "@/api/agent/type";
import type { AgentController } from "@/hooks/use-agent-controller";
import { useAgentSettings } from "@/store/agent-settings";
import { cn } from "@/lib/utils";
import { AgentPopover, AgentSwitch } from "./ui";
import { AGENT_ICON_BTN } from "./styles";

function TitleHistory({ ctl, title }: { ctl: AgentController; title: string }) {
  const [open, setOpen] = useState(false);
  const choose = (session: AgentSessionDto) => { ctl.openSession(session); setOpen(false); };
  const rename = async (session: AgentSessionDto) => {
    const next = window.prompt("重命名会话", session.title)?.trim();
    if (next) await ctl.rename(next, session);
  };
  const remove = async (session: AgentSessionDto) => {
    if (window.confirm("确定删除这个会话吗？")) await ctl.remove(session);
  };
  return <AgentPopover label="对话历史" open={open} onOpenChange={setOpen} className="max-h-80 w-72 overflow-y-auto p-1.5 gap-1 flex flex-col" trigger={<span className="flex h-9 min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-white/5"><span className="max-w-56 truncate text-base font-medium">{title}</span><ChevronDown className="size-3.5 shrink-0 text-white/50" /></span>}>
    {ctl.sessions.length === 0 && <div className="px-3 py-4 text-center text-xs text-white/40">暂无历史会话</div>}
    {ctl.sessions.map((session) => <div key={session.id} className={cn("group flex items-center rounded-lg", session.id === ctl.session?.id ? "bg-white/8" : "hover:bg-white/5")}>
      <button type="button" onClick={() => choose(session)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm">
        <span className="truncate">{session.title || "新对话"}</span>
        {session.id === ctl.session?.id && <Check className="ml-auto size-3.5 shrink-0" />}
      </button>
      <button type="button" aria-label={`重命名 ${session.title}`} onClick={() => void rename(session)} className="cursor-pointer p-1.5 text-white/40 hover:text-white"><Pencil className="size-3" /></button>
      <button type="button" aria-label={`删除 ${session.title}`} disabled={ctl.busy && session.id === ctl.session?.id} onClick={() => void remove(session)} className="mr-1 cursor-pointer p-1.5 text-white/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="size-3.5" /></button>
    </div>)}
  </AgentPopover>;
}

function SettingsPopover() {
  const settings = useAgentSettings();
  return <AgentPopover label="Agent 设置" align="end" className="w-[min(260px,calc(100vw-24px))] p-3" trigger={<span className={AGENT_ICON_BTN} title="设置"><Settings /></span>}>
    <section className="flex items-center justify-between"><label htmlFor="agent-thinking" className="text-[13px]">显示思考过程</label><AgentSwitch id="agent-thinking" label="显示思考过程" checked={settings.showThinking} onCheckedChange={(value) => settings.patch({ showThinking: value })} /></section>
    <section className="mt-3 flex items-center justify-between"><span className="text-[13px]">生成前确认</span><span className="text-xs text-zinc-500">固定开</span></section>
    <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-500">Agent 模型和上下文用量在输入框右下角</p>
  </AgentPopover>;
}

export function AgentHeader({ ctl, title, onClose, closeShortcut = "⌘/" }: { ctl: AgentController; title: string; onClose?: () => void; closeShortcut?: string }) {
  return <header className="flex shrink-0 items-center justify-between px-5 py-4">
    <div className="flex min-w-0 flex-1"><TitleHistory ctl={ctl} title={title} /></div>
    <div className="flex items-center gap-1">
      <button type="button" aria-label="新对话" title={ctl.busy ? "运行中不能新建对话" : "新对话"} disabled={ctl.busy} onClick={ctl.newSession} className={AGENT_ICON_BTN}><SquarePen /></button>
      <SettingsPopover />
      {onClose && <button type="button" aria-label="收起 Agent" title={`收起 ${closeShortcut}`} onClick={onClose} className={AGENT_ICON_BTN}><Minus /></button>}
    </div>
  </header>;
}

