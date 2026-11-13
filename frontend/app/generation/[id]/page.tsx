"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import GenerationComposer from "@/components/generation/generation-composer";
import { generationMediaUrl, getGeneration, runGeneration } from "@/components/generation/api";
import type { GenerationJob } from "@/components/generation/types";

export default function GenerationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [error, setError] = useState("");
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getGeneration(id);
      setJob(next);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成记录加载失败");
    }
  }, [id]);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const abortController = new AbortController();
    abortRef.current = abortController;
    setJob((current) => current ? { ...current, status: "running", error: undefined } : current);
    try {
      await runGeneration(id, abortController, (event) => {
        if (event.type === "msg_chunk" && typeof event.content === "object" && "status" in event.content) {
          const media = event.content;
          if (media.status === 2) {
            const urls = media.urls?.length ? media.urls : media.url ? [media.url] : [];
            setJob((current) => current ? { ...current, urls } : current);
          }
        }
        if (event.type === "msg_error") {
          setJob((current) => current ? { ...current, error: event.error } : current);
        }
      });
    } catch (cause) {
      if (!abortController.signal.aborted) {
        setJob((current) => current ? { ...current, status: "failed", error: cause instanceof Error ? cause.message : "生成失败" } : current);
      }
    } finally {
      runningRef.current = false;
      abortRef.current = null;
      await refresh();
    }
  }, [id, refresh]);

  useEffect(() => {
    void refresh();
    return () => abortRef.current?.abort();
  }, [refresh]);

  useEffect(() => {
    if (job?.status === "pending") void start();
  }, [job?.status, start]);

  useEffect(() => {
    if (job?.status !== "running" || runningRef.current) return;
    const interval = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(interval);
  }, [job?.status, job?.updatedAt, refresh]);

  const configText = job ? [
    job.config.ratio,
    job.config.resolution,
    job.kind === "image" && job.config.count ? `${job.config.count}张` : undefined,
    job.kind === "video" && job.config.duration ? `${job.config.duration}s` : undefined,
  ].filter(Boolean).join(" · ") : "";

  return (
    <main className="flex h-[100dvh] min-h-0 flex-col bg-[#111111] text-white">
      <header className="flex h-16 shrink-0 items-center border-b border-white/5 px-5 lg:px-8">
        <Link href="/home" className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white"><ArrowLeft size={17} />返回首页</Link>
        <div className="ml-5 flex items-center gap-2 text-sm text-white/80"><Sparkles size={16} />生成详情</div>
        {job && <span className="ml-auto text-xs text-white/30">{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(job.createdAt))}</span>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-5 py-7 lg:px-8">
          <h1 className="text-xl font-medium text-white/90">今天</h1>
          {error && <div className="mt-6 rounded-xl border border-red-400/15 bg-red-400/5 px-4 py-3 text-sm text-red-200/75">{error}</div>}
          {!job && !error && <div className="flex h-56 items-center justify-center text-white/35"><LoaderCircle size={24} className="animate-spin" /></div>}
          {job && <section className="mt-6">
            <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-white/80">{job.prompt}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/35">
                <span>{job.modelName}</span>{configText && <><span>·</span><span>{configText}</span></>}
              </div>
            </div>

            {(job.status === "pending" || job.status === "running") && <div className="mt-5 flex aspect-video max-h-[420px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-white/[0.035] text-sm text-white/40">
              <LoaderCircle size={28} className="animate-spin text-white/55" />
              <span>正在生成，结果会自动显示在这里</span>
              {job.error && <span className="px-5 text-center text-xs text-red-300/70">{job.error}</span>}
            </div>}

            {job.status === "failed" && <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-400/5 p-5">
              <p className="text-sm text-red-200/75">{job.error || "生成失败，请重试"}</p>
              <button type="button" onClick={() => void start()} className="mt-4 flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs text-black hover:bg-white/85"><RotateCcw size={14} />重新生成</button>
            </div>}

            {job.urls.length > 0 && <div className={job.kind === "image" ? "mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" : "mt-5 space-y-4"}>
              {job.urls.map((url, index) => <div key={`${url}-${index}`} className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]">
                {job.kind === "image" ? <img src={generationMediaUrl(url)} alt={`${job.prompt} ${index + 1}`} className="w-full object-cover" style={{ aspectRatio: job.config.ratio?.replace(":", "/") || "1/1" }} /> : job.kind === "video" ? <video src={generationMediaUrl(url)} controls playsInline className="aspect-video w-full bg-black" /> : <div className="p-5"><audio src={generationMediaUrl(url)} controls className="w-full" /></div>}
              </div>)}
            </div>}
          </section>}
        </div>
      </div>

      {job && <footer className="shrink-0 border-t border-white/5 bg-[#151515] px-5 py-4 lg:px-8">
        <GenerationComposer
          key={job.id}
          initialValue={{ kind: job.kind, prompt: job.prompt, modelId: job.modelId, modelName: job.modelName, config: job.config, referenceUrl: job.referenceUrl }}
          onCreated={(next) => router.push(`/generate/${next.id}`)}
          className="mx-auto w-full max-w-6xl"
        />
      </footer>}
    </main>
  );
}
