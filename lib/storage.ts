import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { unstable_cache, revalidateTag } from "next/cache";
import { DashboardState, normalizeState } from "./types";

// Em produção (Vercel) o estado fica no Vercel Blob. Localmente, sem
// BLOB_READ_WRITE_TOKEN, fica em .data/state.json.
const PREFIX = "painel/state-";
const LOCAL_FILE = path.join(process.cwd(), ".data", "state.json");
const TAG = "dashboard-state";

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

async function readFromSource(): Promise<DashboardState | null> {
  if (useBlob()) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    if (!blobs.length) return null;
    const latest = blobs.sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    )[0];
    const res = await fetch(latest.url, { cache: "no-store" });
    if (!res.ok) return null;
    return normalizeState(await res.json());
  }
  try {
    return normalizeState(JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")));
  } catch {
    return null;
  }
}

// O resultado fica em cache e só é recarregado quando o admin salva
// (revalidateTag) — assim a TV pode consultar a cada minuto sem custo.
const cachedRead = unstable_cache(readFromSource, [TAG], { tags: [TAG], revalidate: 3600 });

export async function getState(): Promise<DashboardState | null> {
  return useBlob() ? cachedRead() : readFromSource();
}

export async function saveState(state: DashboardState): Promise<void> {
  const body = JSON.stringify(state);
  if (useBlob()) {
    const { put, list, del } = await import("@vercel/blob");
    const saved = await put(`${PREFIX}${Date.now()}.json`, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: true,
    });
    // mantém só as versões mais recentes
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    const old = blobs
      .filter((b) => b.url !== saved.url)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(4)
      .map((b) => b.url);
    if (old.length) await del(old);
    revalidateTag(TAG);
    return;
  }
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, body, "utf8");
}
