import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import motionCatalog from "@/components/stage/motion-catalog.json";

export const dynamic = "force-dynamic";

type MotionAsset = {
  id: string;
  fileUrl: string;
  expiresAt: number;
};

export async function GET(_: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const motion = (motionCatalog as MotionAsset[]).find((item) => item.id === assetId);
  if (!motion) return Response.json({ error: "动作资源不存在" }, { status: 404 });
  const cachePath = path.join(process.cwd(), "public", "stage", "motions", "cache", `${motion.id}.fbx`);
  try {
    const cached = await readFile(cachePath);
    return new Response(cached, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {}
  if (Date.now() >= motion.expiresAt) return Response.json({ error: "动作下载地址已过期，请重新同步资源" }, { status: 503 });
  const response = await fetch(motion.fileUrl);
  if (!response.ok) return Response.json({ error: "动作资源下载失败" }, { status: 502 });
  const file = new Uint8Array(await response.arrayBuffer());
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, file);
  return new Response(file, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
}
