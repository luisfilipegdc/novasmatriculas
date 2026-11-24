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
  let notFound = false;
  for (const access of accessOrder()) {
    try {
      const res = await get(PATHNAME, { access, useCache: false });
      if (!res) {
        notFound = true; // tenta o outro tipo de acesso antes de concluir
        continue;
      }
      if (res.statusCode !== 200) continue;
      preferred = access;
      return normalizeState(await new Response(res.stream).json());
    } catch (e) {
      lastError = e;
    }
  }
  if (notFound && !lastError) return null; // ainda não publicado
  // Falha de leitura (ex.: credencial OIDC indisponível): lança o erro para
  // que ele NÃO seja guardado no cache como se fosse "sem dados".
  throw lastError ?? new Error("Blob indisponível");
}

async function readFromSource(): Promise<DashboardState | null> {
  if (blobConfigured()) return readBlob();
  try {
    return normalizeState(JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")));
  } catch {
    return null;
  }
}

// Cache persistente do Next, renovado SOMENTE quando o admin publica
// (revalidateTag). Sem renovação por tempo: a renovação em segundo plano roda
// fora de uma requisição, onde a credencial OIDC do Blob não existe, e a
// leitura falhava — as TVs recebiam "sem dados".
const cachedRead = unstable_cache(readFromSource, [TAG, "v2"], { tags: [TAG], revalidate: false });

// Último estado lido com sucesso nesta instância do servidor (rede de segurança).
let lastGood: DashboardState | null = null;

export async function getState(): Promise<DashboardState | null> {
  if (!blobConfigured()) return readFromSource();
  try {
    const st = await cachedRead();
    if (st) lastGood = st;
    return st ?? lastGood;
  } catch (e) {
    console.error("[storage] falha ao ler o Blob (cache):", e);
    try {
      const st = await readFromSource(); // tentativa direta, dentro da requisição
      if (st) lastGood = st;
      return st ?? lastGood;
    } catch (e2) {
      console.error("[storage] falha ao ler o Blob (direto):", e2);
      return lastGood;
    }
  }
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
