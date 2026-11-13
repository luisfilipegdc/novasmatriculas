// Leitura das planilhas NO NAVEGADOR. Somente contagens agregadas saem daqui;
// nomes, telefones, e-mails etc. nunca são enviados ao servidor.
import * as XLSX from "xlsx";
import type { ListaSource, RelatorioSource, SegmentKey } from "./types";

type Row = unknown[];

export type ParsedFile =
  | { kind: "relatorio"; data: RelatorioSource }
  | { kind: "nac"; data: ListaSource }
  | { kind: "integral"; data: ListaSource };

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

async function readRows(file: File): Promise<Row[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sh = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(sh, { header: 1, raw: true, defval: "" });
}

function findHeader(rows: Row[], required: string[]): { idx: number; cols: Map<string, number> } | null {
  const req = required.map(norm);
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = rows[i].map(norm);
    if (req.every((r) => cells.includes(r))) {
      const cols = new Map<string, number>();
      cells.forEach((c, j) => {
        if (c && !cols.has(c)) cols.set(c, j);
      });
      return { idx: i, cols };
    }
  }
  return null;
}

/** "dd/mm/yyyy" ou serial do Excel -> "yyyy-mm" */
function monthKey(v: unknown): string | null {
  if (typeof v === "number" && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v ?? ""));
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}`;
}

function segmentOf(curso: string, serie: string): SegmentKey | null {
  const c = norm(curso);
  if (c.includes("infantil")) return "EI";
  if (c.includes("medio")) return "EM";
  if (c.includes("fundamental")) {
    const n = parseInt(String(serie).replace(/\D+/g, ""), 10);
    if (!Number.isFinite(n)) return null;
    return n <= 5 ? "AI" : "AF";
  }
  return null;
}

function parseRelatorio(rows: Row[], fileName: string): RelatorioSource {
  const h = findHeader(rows, ["Tipo Aluno", "Matrícula Aluno"])!;
  const col = (name: string) => h.cols.get(norm(name)) ?? -1;
  const cTipo = col("Tipo Aluno");
  const cMat = col("Matrícula Aluno");
  const cData = col("Data Matrícula");
  const cCurso = col("Curso");
  const cSerie = col("Série");
  const cUnid = col("Unidade (Colégio)");

  // Data de emissão: "Data/Hora da Emissão: 12/11/2026 12:51:34"
  let emitidoEm: string | null = null;
  for (let i = 0; i < h.idx && !emitidoEm; i++) {
    for (const cell of rows[i]) {
      const m = /emiss[aã]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(String(cell));
      if (m) {
        emitidoEm = `${m[3]}-${m[2]}-${m[1]}`;
        break;
      }
    }
  }

  const zeroSeg = (): Record<SegmentKey, number> => ({ EI: 0, AI: 0, AF: 0, EM: 0 });
  const out: RelatorioSource = {
    fileName,
    importedAt: new Date().toISOString(),
    emitidoEm,
    totalLinhas: 0,
    captacao: 0,
    rematricula: 0,
    captacaoPorMes: {},
    captacaoPorSegmento: zeroSeg(),
    rematriculaPorSegmento: zeroSeg(),
    porUnidade: {},
  };
  const seen = new Set<string>();
  for (let i = h.idx + 1; i < rows.length; i++) {
    const r = rows[i];
    const mat = String(r[cMat] ?? "").trim();
    const tipo = norm(r[cTipo]);
    if (!mat || !tipo) continue;
    if (seen.has(mat)) continue; // evita contar o mesmo aluno duas vezes
    seen.add(mat);
    out.totalLinhas++;
    const seg = cCurso >= 0 ? segmentOf(String(r[cCurso]), String(r[cSerie] ?? "")) : null;
    const unid = cUnid >= 0 ? String(r[cUnid]).trim() || "—" : "—";
    out.porUnidade[unid] ??= { captacao: 0, rematricula: 0 };
    if (tipo === "novo") {
      out.captacao++;
      out.porUnidade[unid].captacao++;
      if (seg) out.captacaoPorSegmento[seg]++;
      const mk = cData >= 0 ? monthKey(r[cData]) : null;
      if (mk) out.captacaoPorMes[mk] = (out.captacaoPorMes[mk] ?? 0) + 1;
    } else if (tipo === "antigo") {
      out.rematricula++;
      out.porUnidade[unid].rematricula++;
      if (seg) out.rematriculaPorSegmento[seg]++;
    }
  }
  return out;
}

/** Relação de Alunos: aceita o formato com "Turma Especial" (uma linha por
 *  atividade) e o formato simples (Matrícula, Série, Situação, Nome Completo). */
function findListaHeader(rows: Row[]) {
  return findHeader(rows, ["Matrícula", "Turma Especial"]) ?? findHeader(rows, ["Matrícula", "Nome Completo"]);
}

function parseLista(rows: Row[], fileName: string): ListaSource {
  const h = findListaHeader(rows)!;
  const cMat = h.cols.get(norm("Matrícula"))!;
  const cTipo = h.cols.get(norm("Tipo de Matrícula")) ?? -1;
  const alunos = new Set<string>();
  const porTipo: Record<string, number> = {};
  let inscricoes = 0;
  for (let i = h.idx + 1; i < rows.length; i++) {
    const r = rows[i];
    const mat = String(r[cMat] ?? "").trim();
    if (!mat) continue;
    inscricoes++;
    alunos.add(mat);
    const t = cTipo >= 0 ? String(r[cTipo]).trim() || "—" : "—";
    porTipo[t] = (porTipo[t] ?? 0) + 1;
  }
  return { fileName, importedAt: new Date().toISOString(), inscricoes, alunos: alunos.size, porTipo };
}

/**
 * Lê um arquivo e identifica o tipo. `hint` força NAC/Integral quando o nome
 * do arquivo não deixa claro.
 */
export async function parseFile(file: File, hint?: "nac" | "integral"): Promise<ParsedFile> {
  const rows = await readRows(file);
  if (findHeader(rows, ["Tipo Aluno", "Matrícula Aluno"])) {
    return { kind: "relatorio", data: parseRelatorio(rows, file.name) };
  }
  const lista = findListaHeader(rows);
  if (lista) {
    const data = parseLista(rows, file.name);
    let kind: "nac" | "integral" | undefined = hint;
    if (!kind) {
      const n = norm(file.name);
      if (n.includes("nac")) kind = "nac";
      else if (n.includes("integral")) kind = "integral";
    }
    const cTurma = lista.cols.get(norm("Turma Especial"));
    if (!kind && cTurma !== undefined) {
      // Heurística pelo conteúdo da coluna "Turma Especial"
      const sample = rows.slice(lista.idx + 1, lista.idx + 200).map((r) => norm(r[cTurma])).join(" ");
      kind = /integral|bilingual/.test(sample) ? "integral" : "nac";
    }
    if (!kind) {
      throw new Error(
        `Não deu para saber se "${file.name}" é NAC ou Integral. Arraste-a no quadro "Relação de Alunos · NAC" ou "· Integral".`,
      );
    }
    return { kind, data };
  }
  throw new Error(
    "Planilha não reconhecida. Envie o Relatório de Acompanhamento de Rematrícula ou a Relação de Alunos (NAC / Integral).",
  );
}
