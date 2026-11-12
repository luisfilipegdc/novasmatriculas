import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { unstable_cache, revalidateTag } from "next/cache";
import { DashboardState, normalizeState } from "./types";

// Em produção (Vercel) o estado fica no Vercel Blob, num único arquivo
// sobrescrito a cada publicação. Funciona com Blob store público ou privado
// e com autenticação por token (BLOB_READ_WRITE_TOKEN) ou OIDC (BLOB_STORE_ID).
// Localmente, sem Blob configurado, fica em .data/state.json.
const PATHNAME = "painel/state.json";
const LOCAL_FILE = path.join(process.cwd(), ".data", "state.json");
const TAG = "dashboard-state";

type Access = "public" | "private";

const blobConfigured = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const onVercel = () => !!process.env.VERCEL;

// Ordem de tentativa: BLOB_ACCESS (se definido) e depois o outro tipo.
let preferred: Access =
  process.env.BLOB_ACCESS === "public" || process.env.BLOB_ACCESS === "private"
    ? process.env.BLOB_ACCESS
    : "private";
const accessOrder = (): Access[] => [preferred, preferred === "private" ? "public" : "private"];

async function readBlob(): Promise<DashboardState | null> {
  const { get } = await import("@vercel/blob");
  let lastError: unknown = null;
  for (const access of accessOrder()) {
    try {
      const res = await get(PATHNAME, { access, useCache: false });
      if (!res) return null; // ainda não publicado
      if (res.statusCode !== 200) continue;
      preferred = access;
      return normalizeState(await new Response(res.stream).json());
    } catch (e) {
      lastError = e;
    }
  }
  console.error("[storage] falha ao ler o Blob:", lastError);
  return null;
}

async function readFromSource(): Promise<DashboardState | null> {
  if (blobConfigured()) return readBlob();
  try {
    return normalizeState(JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")));
  } catch {
    return null;
  }
}

// O resultado fica em cache e só é recarregado quando o admin publica
// (revalidateTag) — assim a TV pode consultar a cada minuto sem custo.
const cachedRead = unstable_cache(readFromSource, [TAG], { tags: [TAG], revalidate: 600 });

export async function getState(): Promise<DashboardState | null> {
  return blobConfigured() ? cachedRead() : readFromSource();
}

export class StorageError extends Error {}

export async function saveState(state: DashboardState): Promise<void> {
  const body = JSON.stringify(state);
  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    const errors: string[] = [];
    for (const access of accessOrder()) {
      try {
        await put(PATHNAME, body, {
          access,
          contentType: "application/json",
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 60,
        });
        preferred = access;
        revalidateTag(TAG);
        return;
      } catch (e) {
        errors.push(`${access}: ${(e as Error).message}`);
      }
    }
    console.error("[storage] falha ao gravar no Blob:", errors);
    throw new StorageError(`Vercel Blob recusou a gravação (${errors.join(" | ")})`);
  }
  if (onVercel()) {
    throw new StorageError(
      "Nenhum Blob store conectado a este projeto. Na Vercel: Storage → seu Blob → Connect Project " +
        "(marque Production) e depois faça Redeploy.",
    );
  }
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, body, "utf8");
}
