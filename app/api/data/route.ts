import { NextResponse } from "next/server";
import { getState, saveState } from "@/lib/storage";
import { isAdmin } from "@/lib/auth";
import { defaultState, normalizeState } from "@/lib/types";

export const dynamic = "force-dynamic";

// Público: só contém números agregados (nenhum dado pessoal).
export async function GET() {
  const state = (await getState()) ?? defaultState();
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const text = await req.text();
  if (text.length > 200_000) {
    return NextResponse.json({ error: "Conteúdo muito grande" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const state = normalizeState(body);
  state.updatedAt = new Date().toISOString();
  try {
    await saveState(state);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Falha ao salvar. Verifique se o Blob Store está conectado ao projeto na Vercel." },
      { status: 500 },
    );
  }
  return NextResponse.json(state);
}
