"use client";

import { useState } from "react";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import type {
  AgentApprovalDto,
  AgentAskPayload,
  AgentAskQuestion,
} from "@/api/agent/type";
import type { AgentController } from "@/hooks/use-agent-controller";
import {
  answeredCount,
  askQuestions,
  askState,
  buildAskDecision,
  canSubmit,
  CUSTOM,
  emptyDraft,
  type AskDraft,
} from "@/lib/agent/ask";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AskForm({
  approval,
  ctl,
}: {
  approval: AgentApprovalDto;
  ctl: AgentController;
}) {
  const payload = approval.payload as AgentAskPayload;
  const questions = askQuestions(payload);
  const [drafts, setDrafts] = useState<Record<string, AskDraft>>({});
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const update = (id: string, change: (draft: AskDraft) => AskDraft) =>
    setDrafts((current) => ({
      ...current,
      [id]: change(current[id] ?? emptyDraft()),
    }));
  const decide = async (request: Parameters<AgentController["decide"]>[1]) => {
    setBusy(true);
    await ctl.decide(approval.id, request);
    setBusy(false);
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit(questions, drafts))
          void decide(buildAskDecision(questions, drafts));
      }}
      className="flex flex-col gap-3 rounded-xl border border-white/15 bg-white/[0.03] p-3"
    >
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <MessageCircleQuestion className="size-4 text-zinc-300" />
        {payload.question}
        <span className="ml-auto text-[11px] font-normal text-zinc-500">
          {answeredCount(questions, drafts)} / {questions.length}
        </span>
      </div>
      {questions.map((question, index) => (
        <QuestionBlock
          key={question.id}
          question={question}
          index={index}
          draft={drafts[question.id] ?? emptyDraft()}
          disabled={busy}
          onChange={(change) => update(question.id, change)}
        />
      ))}
      {rejecting && (
        <textarea
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={2000}
          placeholder="告诉 Agent 怎么调整（可直接跳过）"
          className="min-h-16 rounded-lg border border-zinc-200 bg-white p-2 text-xs outline-none focus:border-blue-400"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            rejecting
              ? void decide({ decision: "reject", answer: reason.trim() })
              : setRejecting(true)
          }
          className="text-xs text-zinc-500 hover:text-zinc-800"
        >
          {rejecting ? "提交跳过说明" : "跳过，并告诉 Agent 怎么改"}
        </button>
        <Button
          type="submit"
          size="sm"
          disabled={busy || !canSubmit(questions, drafts)}
        >
          {busy && <Loader2 className="animate-spin" />}提交
        </Button>
      </div>
    </form>
  );
}

function QuestionBlock({
  question,
  index,
  draft,
  disabled,
  onChange,
}: {
  question: AgentAskQuestion;
  index: number;
  draft: AskDraft;
  disabled: boolean;
  onChange: (change: (draft: AskDraft) => AskDraft) => void;
}) {
  const multi = question.kind === "choice" && question.multi === true;
  const choices: Array<{
    key: string;
    label: string;
    hint?: string;
    follow?: string;
  }> =
    question.kind === "choice"
      ? [
          ...(question.options ?? []).map((option) => ({
            key: option.label,
            label: option.label,
            follow: option.follow,
          })),
          ...(question.allow_custom
            ? [{ key: CUSTOM, label: "其他，我来说", follow: "自己写" }]
            : []),
        ]
      : (question.models ?? []).map((model) => ({
          key: model.key,
          label: model.name,
          hint: model.hint,
          follow: undefined,
        }));
  const pick = (key: string) =>
    onChange((current) => ({
      ...current,
      picked: multi
        ? current.picked.includes(key)
          ? current.picked.filter((value) => value !== key)
          : [...current.picked, key]
        : [key],
    }));
  const state = askState(question, draft);
  return (
    <div
      role="group"
      aria-label={question.question}
      className={cn(
        "flex flex-col gap-1.5",
        index > 0 && "pt-3",
      )}
    >
      <div className="flex items-start gap-2 text-[13px] font-medium">
        <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-zinc-100 text-[11px]">
          {index + 1}
        </span>
        <span className="leading-5">{question.question}</span>
        {!question.required && (
          <span className="ml-auto text-[11px] font-normal text-zinc-400">
            选填
          </span>
        )}
      </div>
      {choices.length > 0 && (
        <div
          role={multi ? "group" : "radiogroup"}
          className="flex flex-col gap-1"
        >
          {choices.map((choice, choiceIndex) => {
            const selected = draft.picked.includes(choice.key);
            const custom = choice.key === CUSTOM;
            return (
              <div key={choice.key}>
                <button
                  type="button"
                  role={multi ? "checkbox" : "radio"}
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => pick(choice.key)}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-left text-[13px]",
                    selected && "border-zinc-500 bg-zinc-50",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-zinc-100 text-[11px]",
                      selected && "bg-zinc-900 text-white",
                    )}
                  >
                    {String.fromCharCode(65 + choiceIndex)}
                  </span>
                  <span>{choice.label}</span>
                  {"hint" in choice && choice.hint && (
                    <span className="text-xs text-zinc-400">{choice.hint}</span>
                  )}
                </button>
                {selected && (choice.follow || custom) && (
                  <input
                    autoFocus
                    disabled={disabled}
                    value={
                      custom ? draft.custom : (draft.follow[choice.key] ?? "")
                    }
                    onChange={(event) =>
                      onChange((current) =>
                        custom
                          ? { ...current, custom: event.target.value }
                          : {
                              ...current,
                              follow: {
                                ...current.follow,
                                [choice.key]: event.target.value,
                              },
                            },
                      )
                    }
                    placeholder={choice.follow ?? "自己写"}
                    className="ml-7 mt-1 h-8 w-[calc(100%-28px)] rounded-lg border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      {["text", "url", "number"].includes(question.kind) && (
        <>
          <input
            disabled={disabled}
            type={question.kind === "number" ? "text" : question.kind}
            inputMode={question.kind === "number" ? "decimal" : undefined}
            value={draft.text}
            onChange={(event) =>
              onChange((current) => ({ ...current, text: event.target.value }))
            }
            placeholder={question.placeholder ?? "请输入"}
            className={cn(
              "h-9 rounded-lg border bg-white px-2.5 text-xs outline-none",
              state === "bad"
                ? "border-red-400"
                : "border-zinc-200 focus:border-blue-400",
            )}
          />
          {state === "bad" && (
            <span className="text-[11px] text-red-600">
              {question.kind === "url"
                ? "请输入完整的 http(s) 链接"
                : "请输入有效数字"}
            </span>
          )}
        </>
      )}
    </div>
  );
}
