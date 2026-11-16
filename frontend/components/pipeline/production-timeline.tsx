import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Film } from "lucide-react";
import { Markdown } from "@/components/markdown";
import type { ProductionProject, ProductionStreamPreview } from "./hooks/use-production";

type TextStage = "requirements" | "story" | "script" | "characters" | "storyboard" | "imagePrompts" | "videoPrompts";
type AgentStage = TextStage | "references" | "storyboards" | "videos" | "media";
type MediaStage = "references" | "storyboards" | "videos";

const STREAMING_LABELS: Record<string, string> = {
  requirements: "正在梳理故事方向与创作需求…",
  story: "正在扩展完整故事…",
  storyReview: "正在审查故事的因果与连续性…",
  script: "正在将故事改编为场景剧本…",
  characters: "正在设计角色形象与人物设定…",
  storyboard: "正在构思镜头语言与分镜节奏…",
  imagePrompts: "正在设计分镜画面与图片提示词…",
  videoPrompts: "正在设计角色表演、运镜与拍摄提示词…",
  references: "正在设计角色与场景参考图…",
  storyboards: "正在绘制分镜关键帧…",
  videos: "正在制作镜头动画与视频…",
};

const STREAMING_STEPS: Record<string, string[]> = {
  requirements: ["整理用户输入与历史补充", "判断关键创作缺项", "形成可确认的需求摘要"],
  story: ["区分原文依据与创作补充", "建立人物目标与因果", "写出完整故事与结尾"],
  storyReview: ["核对原文与演绎边界", "检查因果和状态连续性", "整理有依据的审查意见"],
  script: ["读取已确认的完整故事", "选择可演绎的事件", "编写场景动作与对白", "检查整体节奏与时长"],
  characters: ["提取主要角色与关键道具", "统一角色外貌与道具细节", "整理角色和道具三视图设定"],
  storyboard: ["分析剧本节拍与场景", "设计镜头内容与动作运镜", "检查镜头连续性与时长"],
  imagePrompts: ["读取已确认的分镜表", "设计构图、景别、光线与画面", "逐镜补充分镜图提示词"],
  videoPrompts: ["结合剧本与分镜图提示词", "设计角色表演和动作过程", "补充运镜、节奏与镜头连续性"],
};

type Props = {
  project: ProductionProject;
  advancing: boolean;
  streamPreview: ProductionStreamPreview | null;
  onConfirmStage: (mode?: "auto" | "manual", continuity?: boolean) => void;
  onConfirm: () => void;
  onStartPhase: (phase: MediaStage) => void;
  onPause: () => void;
  onRetry: (nodeId: string, independent?: boolean) => void;
  onRetryRequirements: () => void;
  onModify: (stage: TextStage) => void;
  onAutoCompleteRequirements: () => void;
  initialResponse?: ReactNode;
};

export function ProductionStreamingPreview({ preview }: { preview: ProductionStreamPreview | null }) {
  const stage = preview?.stage ?? "";
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    if (!stage) return;
    const timer = window.setInterval(() => setStep((current) => current + 1), 3500);
    return () => window.clearInterval(timer);
  }, [stage]);
  if (!preview) return null;
  const steps = STREAMING_STEPS[preview.stage] ?? [];
  const currentStep = Math.min(step, Math.max(0, steps.length - 1));
  return (
    <div className="rounded-xl border border-fuchsia-300/10 bg-black/20 p-3">
      <div className="flex items-center gap-2 text-xs text-fuchsia-100/70"><span className="size-1.5 animate-pulse rounded-full bg-fuchsia-300" /><span className="thinking-shimmer">{STREAMING_LABELS[preview.stage] ?? "正在思考创作方案…"}</span></div>
      {steps.length > 0 && <ol className="mt-3 space-y-1.5 text-xs">{steps.map((label, index) => <li key={label} className={`flex items-center gap-2 ${index < currentStep ? "text-white/35" : index === currentStep ? "text-white/75" : "text-white/25"}`}><span className={`flex size-4 items-center justify-center rounded-full ${index === currentStep ? "bg-fuchsia-300/15 text-fuchsia-200" : "bg-white/5"}`}>{index < currentStep ? "✓" : index + 1}</span><span className={index === currentStep ? "thinking-shimmer" : undefined}>{label}{index === currentStep ? "…" : ""}</span></li>)}</ol>}
      {preview.data !== undefined && <div className="mt-3 rounded-xl bg-black/20 p-4"><ProductionAnswer stage={preview.stage} data={preview.data} /></div>}
    </div>
  );
}

const primaryButton = "w-full cursor-pointer rounded-xl bg-white/10 px-4 py-3 text-sm text-white/90 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton = "w-full cursor-pointer rounded-xl border border-white/10 px-4 py-3 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white/85";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const mediaUrl = (url: string) => url.startsWith("/") ? `${API_BASE}${url}` : url;
const formatRequirementBrief = (value: string) => value.replace(/\s*(?=(?:[一二三四五六七八九十]+、|主角：|目标：|核心冲突：|场景：|结局：|目标时长：|视觉形式：|类型：|情感弧线：))/g, "\n\n");
const AgentIcon = ({ name }: { name: string }) => <img src={`/agent-icons/${name}.png`} alt="" className="size-full object-contain" />;

function ProductionAnswer({ stage, data }: { stage: string; data: any }) {
  if (!data) return null;
  if (stage === "requirements" && data.brief) return <div><Markdown className="agent-markdown text-sm leading-6 text-white/70">{formatRequirementBrief(data.brief)}</Markdown>{data.questions?.length > 0 && <ul className="mt-3 space-y-2 text-sm text-amber-100/75">{data.questions.map((question: string) => <li key={question}>• {question}</li>)}</ul>}</div>;
  if (stage === "story") return <div>{data.title && <h4 className="text-base font-medium text-white/90">{data.title}</h4>}{data.synopsis && <p className="mt-2 text-sm leading-6 text-white/55">{data.synopsis}</p>}{data.story && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">{data.story}</p>}</div>;
  if (stage === "script") return <div>{data.title && <h4 className="text-base font-medium text-white/90">{data.title}</h4>}{data.adaptationNote && <p className="mt-2 text-sm leading-6 text-amber-200/80">{data.adaptationNote}</p>}{data.scenes?.length > 0 && <div className="mt-4 space-y-2">{data.scenes.map((scene: any) => <div key={scene.id ?? scene.title} className="rounded-lg bg-white/5 p-3"><div className="text-sm text-white/75">{scene.title}{scene.location ? ` · ${scene.location}` : ""}</div>{scene.script && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-white/50">{scene.script}</p>}</div>)}</div>}</div>;
  if (stage === "characters" && (data.characters?.length || data.props?.length)) return <div className="grid grid-cols-1 gap-2">{data.characters?.map((character: any) => <div key={character.id ?? character.name} className="rounded-xl bg-black/20 p-3"><div className="text-sm font-medium text-white/80">{character.name}</div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-white/50">{character.description}</p></div>)}{data.props?.map((prop: any) => <div key={prop.id ?? prop.name} className="rounded-xl bg-black/20 p-3"><div className="text-sm font-medium text-white/80">关键道具 · {prop.name}</div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-white/50">{prop.description}</p>{prop.textContent && <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-5 text-amber-100/65">{prop.textContent}</pre>}</div>)}</div>;
  if (["storyboard", "imagePrompts", "videoPrompts"].includes(stage) && data.scenes?.length) return <div className="space-y-2">{data.scenes.flatMap((scene: any) => scene.shots?.map((shot: any) => <div key={shot.id ?? shot.title} className="rounded-xl bg-black/20 p-3"><div className="text-sm text-white/75">{scene.title ? `${scene.title} / ` : ""}{shot.title ?? shot.id}</div>{stage === "storyboard" ? <><p className="mt-2 text-xs leading-5 text-white/55">{shot.description}</p><p className="mt-1 text-xs leading-5 text-white/40">动作与运镜：{shot.movement}</p></> : <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-white/55">{(stage === "imagePrompts" ? shot.visualPrompt : shot.motionPrompt) || "待生成"}</p>}</div>) ?? [])}</div>;
  return null;
}

function AgentCard({ title, stage, events, history, icon, children, defaultOpen = true, active = false }: { title: string; stage: AgentStage; events: ProductionProject["events"]; history: ProductionProject["history"]; icon: ReactNode; children: ReactNode; defaultOpen?: boolean; active?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [now, setNow] = useState(Date.now());
  const stageEvents = events.filter((event) => event.stage === stage);
  const lastEvent = stageEvents.at(-1);
  const lastRunStart = stageEvents.findLast((event) => /(?:Agent.*(?:正在|开始生成)|^(?:手动启动|开始生成))/.test(event.message));
  const runStart = active && lastEvent?.message.startsWith("用户修改意见") ? lastEvent : lastRunStart;
  const first = runStart ? Date.parse(runStart.createdAt) : 0;
  const completedEvent = runStart ? stageEvents.find((event) => Date.parse(event.createdAt) > first && /等待用户|已结束|执行失败|已暂停|已停止/.test(event.message)) : undefined;
  const end = completedEvent ? Date.parse(completedEvent.createdAt) : now;
  const seconds = first ? Math.max(0, Math.round((end - first) / 1000)) : 0;
  const runStartIndex = runStart ? stageEvents.findIndex((event) => event.id === runStart.id) : -1;
  const visibleStartIndex = runStartIndex > 0 && stageEvents[runStartIndex - 1].message.startsWith("用户修改意见") ? runStartIndex - 1 : runStartIndex;
  const currentEvents = runStart ? stageEvents.slice(Math.max(0, visibleStartIndex)) : stageEvents;
  const pendingFeedback = currentEvents.findLast((event) => event.message.startsWith("用户修改意见"))?.message.replace(/^用户修改意见：/, "");
  const visibleEvents = currentEvents.filter((event) => !event.message.startsWith("用户修改意见"));
  const stageHistory = history.filter((entry) => entry.stage === stage);
  const previousAnswers = (active ? stageHistory : stageHistory.slice(0, -1)).map((entry, index) => ({
    entry,
    response: stageHistory[index + 1]?.feedback ?? (index === stageHistory.length - 1 ? pendingFeedback : undefined),
  }));
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (defaultOpen || active) setOpen(true);
  }, [active, defaultOpen]);
  return (
    <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#1d1d1f]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left">
        <span className="flex size-14 shrink-0 items-center justify-center text-fuchsia-200">{icon}</span>
        <span className="font-medium text-white/90">{title}</span>
        <ChevronDown size={15} className={`ml-auto text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="text-xs text-white/35">{runStart ? `用时 ${seconds} 秒` : "等待处理"}</span>
      </button>
      {open && <div className="px-4 pb-4">
        {previousAnswers.length > 0 && <div className="mb-3 space-y-2">{previousAnswers.map(({ entry, response }) => <div key={entry.id}><ProductionAnswer stage={stage} data={entry.data} />{response && <div className="mt-3 flex justify-end"><div className="max-w-[88%] whitespace-pre-wrap rounded-2xl bg-white/10 px-3 py-2 text-sm leading-6 text-white/80">{response}</div></div>}</div>)}</div>}
        {visibleEvents.length > 0 && <ul className="mb-4 space-y-2 text-sm leading-6 text-white/65">{visibleEvents.map((event) => <li key={event.id} className="flex gap-2"><span className="text-white/30">•</span><span>{event.message}</span></li>)}</ul>}
        {children}
      </div>}
    </section>
  );
}

export default function ProductionTimeline({ project, advancing, streamPreview, onConfirmStage, onConfirm, onStartPhase, onPause, onRetry, onRetryRequirements, onModify, onAutoCompleteRequirements, initialResponse }: Props) {
  const { plan, requirements, status } = project;
  const hasStoryboard = plan.scenes?.some((scene) => scene.shots?.length);
  const storyIssues = plan.storyReview?.issues ?? [];
  const storyBlocked = storyIssues.some((issue) => issue.severity === "blocking");
  const actions = (stage: TextStage, label: string, review: boolean) => review && !advancing && <div className="mt-3 space-y-2">
    <button type="button" disabled={advancing} onClick={() => onConfirmStage()} className={primaryButton}>{label}</button>
    <button type="button" disabled={advancing} onClick={() => onModify(stage)} className={secondaryButton}>我想修改</button>
  </div>;
  const promptRows = (kind: "image" | "video") => plan.scenes?.flatMap((scene) => scene.shots?.map((shot) => <div key={shot.id} className="rounded-xl bg-black/20 p-3"><div className="text-sm text-white/75">{scene.title} / {shot.title}</div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-white/55">{(kind === "image" ? shot.visualPrompt : shot.motionPrompt) || "待生成"}</p></div>));
  const mediaBatch = (stage: MediaStage, title: string) => {
    const kinds = stage === "references" ? ["characterReference", "propReference", "sceneReference"] : stage === "storyboards" ? ["storyboard"] : ["video"];
  const nodes = project.nodes.filter((node) => (node.type === "imageNode" || node.type === "videoNode") && kinds.includes(node.data.production?.kind ?? ""));
    const visible = nodes.length > 0 && (project.events.some((event) => event.stage === stage) || status.startsWith(`${stage}_`) || (stage === "videos" && status === "media_completed"));
    if (!visible) return null;
    const failed = nodes.filter((node) => "status" in node.data && node.data.status === 3);
    const pending = nodes.filter((node) => !("status" in node.data) || node.data.status !== 2);
    const actionable = project.mediaMode === "manual" ? pending : failed;
    const nodeButtons = actionable.map((node) => <div key={node.id} className="flex items-center gap-2">
      <button type="button" onClick={() => onRetry(node.id)} className="flex-1 cursor-pointer rounded-lg bg-white/8 px-3 py-2 text-left text-xs text-white/75 hover:bg-white/12">
        {"status" in node.data && node.data.status === 3 ? "重试" : "生成"}：{node.data.title || node.id}
      </button>
      {node.data.production?.continuity && <button type="button" title="忽略上一镜，使用本分镜图生成" onClick={() => onRetry(node.id, true)} className="shrink-0 cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:bg-white/5">独立生成</button>}
    </div>);
    return <AgentCard title={title} stage={stage} events={project.events} history={project.history} icon={<Film size={18} />} defaultOpen={status.startsWith(`${stage}_`)} active={status === `${stage}_running`}>
      <div className="grid grid-cols-2 gap-2">{nodes.filter((node) => "url" in node.data && node.data.url).map((node) => <div key={node.id} className="overflow-hidden rounded-xl bg-black/20">
        {node.type === "imageNode" ? <img src={mediaUrl("url" in node.data ? node.data.url ?? "" : "")} alt={node.data.title || node.id} className="aspect-video w-full object-cover" /> : <video src={mediaUrl("url" in node.data ? node.data.url ?? "" : "")} controls className="aspect-video w-full object-cover" />}
        <div className="p-2 text-xs text-white/55">{node.data.title || node.id}</div>
      </div>)}</div>
      {status === `${stage}_ready` && project.mediaMode !== "manual" && <button type="button" onClick={() => onStartPhase(stage)} className={`${primaryButton} mt-3`}>开始生成当前批次</button>}
      {status === `${stage}_ready` && project.mediaMode === "manual" && <div className="mt-3 space-y-2">{nodeButtons}</div>}
      {status === `${stage}_running` && <button type="button" onClick={onPause} className={`${secondaryButton} mt-3`}>暂停后续任务</button>}
      {status === `${stage}_paused` && <button type="button" onClick={onConfirm} className={`${primaryButton} mt-3`}>继续当前批次</button>}
      {status === `${stage}_review` && <div className="mt-3 space-y-2">
        {nodeButtons}
        <button type="button" disabled={advancing} onClick={() => onConfirmStage()} className={primaryButton}>{stage === "videos" ? "确认视频，完成制作" : "确认当前批次，继续下一阶段"}</button>
      </div>}
      {stage === "videos" && status === "media_completed" && <div className="mt-3 text-sm text-emerald-300">全部制作已确认完成</div>}
    </AgentCard>;
  };

  return <div className="space-y-4">
    {(requirements || streamPreview?.stage === "requirements" || (status === "failed" && !requirements)) && <AgentCard title="导演 Agent · 需求澄清" stage="requirements" events={project.events} history={project.history} icon={<AgentIcon name="director" />} defaultOpen={status.startsWith("requirements_") || status === "failed"} active={streamPreview?.stage === "requirements"}>
      {initialResponse && <div className="mb-3 flex justify-end"><div className="max-w-[88%] whitespace-pre-wrap rounded-2xl bg-white/10 px-3.5 py-2.5 text-sm leading-6 text-white/90">{initialResponse}</div></div>}
      {streamPreview?.stage === "requirements" && <div className="mb-3"><ProductionStreamingPreview preview={streamPreview} /></div>}
      {requirements && !advancing && status !== "requirements_pending" && <div className="rounded-xl bg-black/20 p-4"><Markdown className="agent-markdown text-sm leading-6 text-white/70">{formatRequirementBrief(requirements.brief)}</Markdown>{requirements.questions.length > 0 && <ul className="mt-3 space-y-2 text-sm text-amber-100/75">{requirements.questions.map((question) => <li key={question}>• {question}</li>)}</ul>}</div>}
      {status === "requirements_clarifying" && !advancing && <div className="mt-3 space-y-2"><button type="button" onClick={onAutoCompleteRequirements} className={primaryButton}>让 Agent 帮我补充</button><button type="button" onClick={() => onModify("requirements")} className={secondaryButton}>自己回答</button></div>}
      {status === "failed" && !requirements && !advancing && <div className="space-y-2"><p className="text-sm text-red-300">{project.error || "需求分析执行失败"}</p><button type="button" onClick={onRetryRequirements} className={primaryButton}>继续执行</button></div>}
      {actions("requirements", "确认需求，开发完整故事", status === "requirements_review")}
    </AgentCard>}

    {(plan.storyReview || streamPreview?.stage === "story" || streamPreview?.stage === "storyReview" || status === "story_pending" || status === "story_review") && <AgentCard title="故事开发与审查" stage="story" events={project.events} history={project.history} icon={<AgentIcon name="screenwriter" />} defaultOpen={status === "story_review" || status === "story_pending"} active={streamPreview?.stage === "story" || streamPreview?.stage === "storyReview"}>
      {(streamPreview?.stage === "story" || streamPreview?.stage === "storyReview") && <div className="mb-3"><ProductionStreamingPreview preview={streamPreview} /></div>}
      {plan.story && <div className="rounded-xl bg-black/20 p-4"><h4 className="text-base font-medium text-white/90">{plan.title}</h4><p className="mt-2 text-sm leading-6 text-white/55">{plan.synopsis}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">{plan.story}</p>{plan.sourceBasis?.length ? <div className="mt-4 text-xs leading-5 text-white/45">原文依据：{plan.sourceBasis.join("；")}</div> : null}{plan.creativeAdditions?.length ? <div className="mt-2 text-xs leading-5 text-white/45">创作补充：{plan.creativeAdditions.join("；")}</div> : null}</div>}
      {plan.storyReview && <div className="mt-3 space-y-2"><div className="text-sm font-medium text-white/75">故事审查</div>{storyIssues.length === 0 ? <p className="text-sm text-emerald-300/80">未发现需要修订的问题</p> : storyIssues.map((issue, index) => <div key={`${issue.category}-${index}`} className="border-l-2 border-white/15 bg-black/20 px-3 py-2 text-sm leading-6"><div className={issue.severity === "blocking" ? "text-amber-200" : "text-white/65"}>{issue.severity === "blocking" ? "需修复" : "建议"} · {issue.problem}</div><p className="mt-1 text-xs text-white/45">依据：{issue.evidence}</p><p className="mt-1 text-xs text-white/55">建议：{issue.suggestion}</p></div>)}</div>}
      {status === "story_review" && !plan.storyReview && project.error && <p className="mt-3 text-sm text-red-300">{project.error}</p>}
      {status === "story_review" && !advancing && <div className="mt-3 space-y-2"><button type="button" disabled={Boolean(plan.storyReview) && storyBlocked} onClick={() => onConfirmStage()} className={primaryButton}>{!plan.storyReview ? "重试故事审查" : storyBlocked ? "修复审查问题后继续" : "确认完整故事，开始改编剧本"}</button><button type="button" onClick={() => onModify("story")} className={secondaryButton}>修改故事</button></div>}
    </AgentCard>}

    {((plan.scenes?.length ?? 0) > 0 || streamPreview?.stage === "script" || status === "script_pending") && <AgentCard title="编剧 Agent" stage="script" events={project.events} history={project.history} icon={<AgentIcon name="screenwriter" />} defaultOpen={status === "script_review" || status === "script_pending"} active={streamPreview?.stage === "script"}>
      {streamPreview?.stage === "script" && <div className="mb-3"><ProductionStreamingPreview preview={streamPreview} /></div>}
      {(plan.scenes?.length ?? 0) > 0 && <div className="rounded-xl bg-black/20 p-4"><h4 className="text-base font-medium text-white/90">{plan.title}</h4>{plan.adaptationNote && <p className="mt-2 text-sm leading-6 text-amber-200/80">{plan.adaptationNote}</p>}<div className="mt-4 space-y-2">{plan.scenes?.map((scene) => <div key={scene.id} className="rounded-lg bg-white/5 p-3"><div className="text-sm text-white/75">{scene.title} · {scene.location}</div><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-white/50">{scene.script}</p></div>)}</div></div>}
      {actions("script", "确认剧本，继续生成角色", status === "script_review")}
    </AgentCard>}

    {((plan.characters?.length ?? 0) > 0 || (plan.props?.length ?? 0) > 0 || streamPreview?.stage === "characters" || status === "characters_pending") && <AgentCard title="角色与关键道具" stage="characters" events={project.events} history={project.history} icon={<AgentIcon name="character-designer" />} defaultOpen={status === "characters_review" || status === "characters_pending"} active={streamPreview?.stage === "characters"}>
      {streamPreview?.stage === "characters" && <div className="mb-3"><ProductionStreamingPreview preview={streamPreview} /></div>}
      {(plan.characters?.length ?? 0) > 0 && <div className="grid grid-cols-1 gap-2">{plan.characters?.map((character) => <div key={character.id} className="rounded-xl bg-black/20 p-3"><div className="text-sm font-medium text-white/80">{character.name}</div><p className="mt-2 text-xs leading-5 text-white/50">{character.description}</p></div>)}</div>}
      {(plan.props?.length ?? 0) > 0 && <div className="mt-2 grid grid-cols-1 gap-2">{plan.props?.map((prop) => <div key={prop.id} className="rounded-xl bg-black/20 p-3"><div className="text-sm font-medium text-white/80">关键道具 · {prop.name}</div><p className="mt-2 text-xs leading-5 text-white/50">{prop.description}</p>{prop.textContent && <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-5 text-amber-100/65">{prop.textContent}</pre>}</div>)}</div>}
      {actions("characters", "确认角色，继续生成分镜", status === "characters_review")}
    </AgentCard>}

    {(hasStoryboard || streamPreview?.stage === "storyboard" || status === "storyboard_pending") && <AgentCard title="场景师 · 分镜师" stage="storyboard" events={project.events} history={project.history} icon={<AgentIcon name="scene-designer" />} defaultOpen={status === "storyboard_review" || status === "storyboard_pending"} active={streamPreview?.stage === "storyboard"}>
      {streamPreview?.stage === "storyboard" && <div className="mb-3"><ProductionStreamingPreview preview={streamPreview} /></div>}
      {hasStoryboard && <div className="space-y-2">{plan.scenes?.map((scene) => scene.shots?.map((shot) => <div key={shot.id} className="rounded-xl bg-black/20 p-3"><div className="text-sm text-white/75">{scene.title} / {shot.title}<span className="ml-2 text-xs text-white/35">{shot.duration}s</span></div><p className="mt-2 text-xs leading-5 text-white/55">{shot.description}</p><p className="mt-1 text-xs leading-5 text-white/40">动作与运镜：{shot.movement}</p></div>))}</div>}
      {hasStoryboard && <button onClick={() => window.dispatchEvent(new CustomEvent("open-storyboard-previz"))} className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65 hover:bg-white/10 hover:text-white">打开草图故事板</button>}
      {actions("storyboard", "确认分镜，生成分镜图提示词", status === "storyboard_review")}
    </AgentCard>}

    {(streamPreview?.stage === "imagePrompts" || status === "image_prompts_pending" || plan.scenes?.some((scene) => scene.shots?.some((shot) => shot.visualPrompt))) && <AgentCard title="分镜图提示词 Agent" stage="imagePrompts" events={project.events} history={project.history} icon={<AgentIcon name="storyboard-image" />} defaultOpen={status === "image_prompts_review" || status === "image_prompts_pending"} active={streamPreview?.stage === "imagePrompts"}>
      {streamPreview?.stage === "imagePrompts" ? <ProductionStreamingPreview preview={streamPreview} /> : <div className="space-y-2">{promptRows("image")}</div>}
      {actions("imagePrompts", "确认分镜图提示词，生成视频提示词", status === "image_prompts_review")}
    </AgentCard>}

    {(streamPreview?.stage === "videoPrompts" || status === "video_prompts_pending" || plan.scenes?.some((scene) => scene.shots?.some((shot) => shot.motionPrompt))) && <AgentCard title="视频拍摄提示词 Agent" stage="videoPrompts" events={project.events} history={project.history} icon={<AgentIcon name="video-director" />} defaultOpen={status === "video_prompts_review" || status === "video_prompts_pending"} active={streamPreview?.stage === "videoPrompts"}>
      {streamPreview?.stage === "videoPrompts" ? <ProductionStreamingPreview preview={streamPreview} /> : <div className="space-y-2">{promptRows("video")}</div>}
      {status === "video_prompts_review" && !advancing && <div className="mt-3 space-y-2"><button type="button" onClick={() => onConfirmStage("auto")} className={primaryButton}>确认提示词，自动执行当前媒体批次</button><button type="button" onClick={() => onConfirmStage("manual")} className={primaryButton}>确认提示词，手动执行媒体</button><button type="button" onClick={() => onConfirmStage("manual", true)} className={secondaryButton}>连续衔接：自动连线并手动逐镜生成</button><button type="button" onClick={() => onModify("videoPrompts")} className={secondaryButton}>我想修改</button></div>}
    </AgentCard>}

    {mediaBatch("references", "角色与场景参考图")}
    {mediaBatch("storyboards", "分镜图生成")}
    {mediaBatch("videos", "视频生成")}
  </div>;
}
