// Tipos e valores padrão do painel. Tudo aqui é agregado: nenhum dado
// pessoal de aluno é armazenado no servidor.

export type SegmentKey = "EI" | "AI" | "AF" | "EM";

export const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "EI", label: "Educação Infantil" },
  { key: "AI", label: "Anos Iniciais" },
  { key: "AF", label: "Anos Finais" },
  { key: "EM", label: "Ensino Médio" },
];

export type SlideKey =
  | "abertura"
  | "captacaoGeral"
  | "captacaoMensal"
  | "comparativo"
  | "rematriculaGeral"
  | "rematriculaSegmentos"
  | "total"
  | "nac"
  | "integral";

export const SLIDE_LABELS: Record<SlideKey, string> = {
  abertura: "Abertura",
  captacaoGeral: "Meta geral de Captação",
  captacaoMensal: "Meta mensal de Captação",
  comparativo: "Comparativo com ano anterior",
  rematriculaGeral: "Meta geral de Rematrícula",
  rematriculaSegmentos: "Rematrícula por segmento",
  total: "Meta total MAT + REM",
  nac: "NAC",
  integral: "Integral",
};

export const SLIDE_ORDER: SlideKey[] = [
  "abertura",
  "captacaoGeral",
  "captacaoMensal",
  "comparativo",
  "rematriculaGeral",
  "rematriculaSegmentos",
  "total",
  "nac",
  "integral",
];

/** Resultado agregado do "Relatório de Acompanhamento de Rematrícula". */
export interface RelatorioSource {
  fileName: string;
  importedAt: string;
  emitidoEm: string | null; // ISO date (yyyy-mm-dd) extraído do cabeçalho
  totalLinhas: number;
  captacao: number; // Tipo Aluno = Novo
  rematricula: number; // Tipo Aluno = Antigo
  captacaoPorMes: Record<string, number>; // "2026-08" -> n
  captacaoPorSegmento: Record<SegmentKey, number>;
  rematriculaPorSegmento: Record<SegmentKey, number>;
  porUnidade: Record<string, { captacao: number; rematricula: number }>;
}

/** Resultado agregado das relações de alunos (NAC / Integral). */
export interface ListaSource {
  fileName: string;
  importedAt: string;
  inscricoes: number; // linhas
  alunos: number; // matrículas únicas
  porTipo: Record<string, number>; // Matrícula / Rematrícula
}

export type Contagem = "inscricoes" | "alunos";

export interface MesMeta {
  key: string; // yyyy-mm
  label: string;
  meta: number;
  /** Valor informado manualmente; quando preenchido, substitui o da planilha. */
  realizado?: number | null;
}

export interface DashboardState {
  version: 1;
  updatedAt: string;
  ano: number;
  anoAnterior: number;
  dataAte: string; // yyyy-mm-dd ("Dados coletados até")
  metas: {
    captacao: number;
    rematricula: number;
    nac: number;
    integral: number;
    segmentos: Record<SegmentKey, number>;
    mensal: MesMeta[];
  };
  captacaoAnoAnterior: number;
  contagemNac: Contagem;
  contagemIntegral: Contagem;
  mensalModo: "acumulado" | "mensal";
  overrides: {
    captacao?: number | null;
    rematricula?: number | null;
    nac?: number | null;
    integral?: number | null;
  };
  settings: {
    slideSeconds: number;
    slides: Record<SlideKey, boolean>;
  };
  sources: {
    relatorio: RelatorioSource | null;
    nac: ListaSource | null;
    integral: ListaSource | null;
  };
}

export function defaultState(): DashboardState {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    ano: 2027,
    anoAnterior: 2026,
    dataAte: new Date().toISOString().slice(0, 10),
    metas: {
      captacao: 545,
      rematricula: 2785,
      nac: 1594,
      integral: 478,
      segmentos: { EI: 262, AI: 857, AF: 1026, EM: 640 },
      mensal: [
        { key: "2026-08", label: "Agosto", meta: 38 },
        { key: "2026-09", label: "Setembro", meta: 93 },
        { key: "2026-10", label: "Outubro", meta: 147 },
        { key: "2026-11", label: "Novembro", meta: 118 },
        { key: "2026-12", label: "Dezembro", meta: 52 },
        { key: "2027-01", label: "Janeiro", meta: 23 },
      ],
    },
    captacaoAnoAnterior: 369,
    contagemNac: "inscricoes",
    contagemIntegral: "alunos",
    mensalModo: "acumulado",
    overrides: {},
    settings: {
      slideSeconds: 14,
      slides: {
        abertura: true,
        captacaoGeral: true,
        captacaoMensal: false,
        comparativo: true,
        rematriculaGeral: true,
        rematriculaSegmentos: true,
        total: true,
        nac: true,
        integral: true,
      },
    },
    sources: { relatorio: null, nac: null, integral: null },
  };
}

/** Mescla um estado salvo (possivelmente de versão antiga) com os padrões. */
export function normalizeState(input: unknown): DashboardState {
  const d = defaultState();
  if (!input || typeof input !== "object") return d;
  const s = input as Partial<DashboardState>;
  return {
    ...d,
    ...s,
    version: 1,
    metas: {
      ...d.metas,
      ...(s.metas ?? {}),
      segmentos: { ...d.metas.segmentos, ...(s.metas?.segmentos ?? {}) },
      mensal: Array.isArray(s.metas?.mensal) ? s.metas!.mensal : d.metas.mensal,
    },
    overrides: { ...(s.overrides ?? {}) },
    settings: {
      ...d.settings,
      ...(s.settings ?? {}),
      slides: { ...d.settings.slides, ...(s.settings?.slides ?? {}) },
    },
    sources: { ...d.sources, ...(s.sources ?? {}) },
  };
}

export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
