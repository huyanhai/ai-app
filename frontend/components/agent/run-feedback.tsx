"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import type { AgentFeedbackRating } from "@/api/agent/type";
import type { AgentController } from "@/hooks/use-agent-controller";
import { FEEDBACK_COMMENT_MAX, FEEDBACK_REASONS, FEEDBACK_SAVE_FAILED, feedbackNote, thumbAction } from "@/lib/agent/feedback";
import { cn } from "@/lib/utils";
import { toast } from "./toast";

export type FeedbackDraft = { reasons: string[]; comment: string };

export function RunFeedback({ runId, ctl, copyText, quiet = false, leading, below }: { runId: string; ctl: AgentController; copyText: string; quiet?: boolean; leading?: ReactNode; below?: ReactNode }) {
  const feedback = ctl.state.feedback[runId];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraft>({ reasons: [], comment: "" });
  const [saving, setSaving] = useState(false);
  const save = async (rating: AgentFeedbackRating, reasons: string[] = [], comment = "") => {
    setSaving(true);
    const ok = await ctl.rateRun(runId, { rating, reasons: reasons as never, comment });
    setSaving(false);
    if (!ok) toast.error(FEEDBACK_SAVE_FAILED);
    else setOpen(false);
  };
  const thumb = async (rating: AgentFeedbackRating) => {
    const action = thumbAction(feedback, rating);
    if (action === "cancel") { const ok = await ctl.clearRunRating(runId); if (!ok) toast.error(FEEDBACK_SAVE_FAILED); }
    else if (action === "submit-up") await save(1);
    else { setDraft({ reasons: feedback?.reasons ?? [], comment: feedback?.comment ?? "" }); setOpen(!open); }
  };
  const copy = () => { if (copyText) void navigator.clipboard.writeText(copyText).then(() => toast.success("已复制")).catch(() => toast.error("复制失败")); };
  return <div className={cn("flex flex-col gap-2", quiet && "opacity-45 transition-opacity hover:opacity-100 focus-within:opacity-100")}>
    <div className="flex min-h-7 items-center gap-1 text-zinc-500">{leading}<span className="flex-1" />{copyText && <button type="button" aria-label="复制回答" title="复制回答" onClick={copy} className="grid size-7 place-items-center rounded-md hover:bg-zinc-100 hover:text-zinc-800"><Copy className="size-3.5" /></button>}<button type="button" aria-label="有帮助" title="有帮助" disabled={saving} onClick={() => void thumb(1)} className={cn("grid size-7 place-items-center rounded-md hover:bg-zinc-100 hover:text-zinc-800", feedback?.rating === 1 && "bg-emerald-50 text-emerald-600")}><ThumbsUp className="size-3.5" /></button><button type="button" aria-label="需要改进" title="需要改进" disabled={saving} onClick={() => void thumb(-1)} className={cn("grid size-7 place-items-center rounded-md hover:bg-zinc-100 hover:text-zinc-800", feedback?.rating === -1 && "bg-amber-50 text-amber-600")}><ThumbsDown className="size-3.5" /></button>{saving && <Loader2 className="size-3.5 animate-spin" />}</div>
    {feedback && !open && <p className="-mt-1 text-[11px] text-zinc-400">{feedbackNote(feedback)}</p>}
    <AnimatePresence initial={false}>{open && <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} onSubmit={(event) => { event.preventDefault(); void save(-1, draft.reasons, draft.comment.trim()); }} className="overflow-hidden"><div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3"><p className="text-xs font-medium">哪里需要改进？</p><div className="flex flex-wrap gap-1.5">{FEEDBACK_REASONS.map((reason) => { const selected = draft.reasons.includes(reason.key); return <button key={reason.key} type="button" onClick={() => setDraft((current) => ({ ...current, reasons: selected ? current.reasons.filter((key) => key !== reason.key) : [...current.reasons, reason.key] }))} className={cn("rounded-full border px-2 py-1 text-[11px]", selected ? "border-zinc-700 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600")}>{reason.label}</button>; })}</div><textarea value={draft.comment} onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))} maxLength={FEEDBACK_COMMENT_MAX} placeholder="补充说明（选填）" className="min-h-16 rounded-lg border border-zinc-200 bg-white p-2 text-xs outline-none focus:border-blue-400" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="text-xs text-zinc-500">取消</button><button type="submit" disabled={saving} className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs text-white disabled:opacity-40">提交反馈</button></div></div></motion.form>}</AnimatePresence>
    {below}
  </div>;
}

