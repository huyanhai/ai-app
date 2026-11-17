"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentAttachmentReq } from "@/api/agent/type";
import { uploadAgentAsset } from "@/api/agent";
import type { TrayAsset, TrayItem } from "@/lib/agent/attachments";
import { toast } from "./toast";

export type AttachmentAsset = TrayAsset;
export type { TrayItem } from "@/lib/agent/attachments";

export type AttachmentUploader = (
  file: File,
  options: { signal: AbortSignal; onProgress: (progress: number) => void },
) => Promise<AttachmentAsset>;

const defaultUpload: AttachmentUploader = (file, options) => uploadAgentAsset(file, options);

export function useAgentAttachments(uploader: AttachmentUploader = defaultUpload) {
  const [items, setItems] = useState<TrayItem[]>([]);
  const latest = useRef<TrayItem[]>([]);
  const files = useRef(new Map<string, File>());
  const aborts = useRef(new Map<string, AbortController>());
  const counter = useRef(0);

  const commit = useCallback((next: TrayItem[]) => {
    latest.current = next;
    setItems(next);
  }, []);
  const patch = useCallback((id: string, part: Partial<TrayItem>) => {
    commit(latest.current.map((item) => item.id === id ? { ...item, ...part } : item));
  }, [commit]);

  const upload = useCallback(async (id: string, file: File) => {
    const controller = new AbortController();
    aborts.current.set(id, controller);
    patch(id, { status: "uploading", progress: 0, error: undefined });
    try {
      const asset = await uploader(file, {
        signal: controller.signal,
        onProgress: (progress) => patch(id, { progress }),
      });
      files.current.delete(id);
      patch(id, { status: "done", progress: 100, asset });
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") {
        patch(id, { status: "error", error: cause instanceof Error ? cause.message : "上传失败" });
      }
    } finally {
      aborts.current.delete(id);
    }
  }, [patch, uploader]);

  const add = useCallback((picked: ArrayLike<File> | null | undefined, kind: "image" | "document" = "image") => {
    const selected = Array.from(picked ?? []);
    const existing = latest.current.filter((item) => item.kind === kind).length;
    const limit = kind === "image" ? 9 : 3;
    const accepted: File[] = [];
    let rejected = 0;
    for (const file of selected) {
      const valid = kind === "image"
        ? file.type.startsWith("image/")
        : /\.(txt|md)$/i.test(file.name) && file.size > 0 && file.size <= 200_000;
      if (!valid || accepted.length + existing >= limit) rejected += 1;
      else accepted.push(file);
    }
    if (rejected) toast.warning(kind === "image" ? "仅支持图片，每条消息最多 9 张，部分文件未添加" : "仅支持 200KB 内的 .txt/.md，每条消息最多 3 个");
    const added = accepted.map((file): TrayItem => {
      counter.current += 1;
      const id = crypto.randomUUID();
      files.current.set(id, file);
      return {
        id,
        name: file.name || `图片 ${counter.current}`,
        kind,
        size: file.size,
        previewUrl: kind === "image" ? URL.createObjectURL(file) : "",
        status: "uploading",
        progress: 0,
      };
    });
    if (!added.length) return;
    commit([...latest.current, ...added]);
    added.forEach((item) => void upload(item.id, files.current.get(item.id)!));
  }, [commit, upload]);

  const remove = useCallback((id: string) => {
    const item = latest.current.find((entry) => entry.id === id);
    aborts.current.get(id)?.abort();
    aborts.current.delete(id);
    files.current.delete(id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    commit(latest.current.filter((entry) => entry.id !== id));
  }, [commit]);

  const retry = useCallback((id: string) => {
    const file = files.current.get(id);
    if (file) void upload(id, file);
  }, [upload]);

  const clear = useCallback(() => {
    aborts.current.forEach((controller) => controller.abort());
    latest.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    aborts.current.clear();
    files.current.clear();
    commit([]);
  }, [commit]);

  useEffect(() => () => {
    aborts.current.forEach((controller) => controller.abort());
    latest.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
  }, []);

  return {
    items,
    add,
    addDocuments: (picked: ArrayLike<File> | null | undefined) => add(picked, "document"),
    remove,
    retry,
    clear,
    uploading: items.some((item) => item.status === "uploading"),
    hasError: items.some((item) => item.status === "error"),
  };
}

export type AgentAttachments = ReturnType<typeof useAgentAttachments>;

export function toAttachmentsPayload(items: readonly TrayItem[]): AgentAttachmentReq[] {
  return items.flatMap((item) => item.status === "done" && item.asset ? [{ asset_id: item.asset.id }] : []);
}

