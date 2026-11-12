// Transforma o estado salvo nos números exibidos na TV.
import { DashboardState, SEGMENTS, SegmentKey } from "./types";

export interface Meta {
  atual: number;
  meta: number;
  falta: number; // atual - meta (negativo = faltam)
  pct: number; // 0..n (1 = 100%)
}

export interface BarItem {
  label: string;
  atual: number;
  meta: number;
  pct: number;
}

export interface DashboardView {
  ano: number;
  anoAnterior: number;
  dataAteLabel: string;
  hasData: boolean;
  captacao: Meta;
  rematricula: Meta;
  total: Meta;
  nac: Meta;
  integral: Meta;
  comparativo: { atual: number; anterior: number; diff: number };
  mensal: BarItem[];
  segmentos: BarItem[];
}

function meta(atual: number, m: number): Meta {
  return { atual, meta: m, falta: atual - m, pct: m > 0 ? atual / m : 0 };
}

function pick(override: number | null | undefined, computed: number | undefined): number {
  if (typeof override === "number" && Number.isFinite(override)) return override;
  return computed ?? 0;
}

export function formatDateBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

export function buildView(s: DashboardState): DashboardView {
  const rel = s.sources.relatorio;
  const captAtual = pick(s.overrides.captacao, rel?.captacao);
  const remAtual = pick(s.overrides.rematricula, rel?.rematricula);
  const nacAtual = pick(
    s.overrides.nac,
    s.sources.nac ? s.sources.nac[s.contagemNac] : undefined,
  );
  const intAtual = pick(
    s.overrides.integral,
    s.sources.integral ? s.sources.integral[s.contagemIntegral] : undefined,
  );

  // ----- Captação mensal -----
  const meses = s.metas.mensal;
  const porMes = rel?.captacaoPorMes ?? {};
  const mensal: BarItem[] = [];
  const manual = (m: { realizado?: number | null }) =>
    typeof m.realizado === "number" && Number.isFinite(m.realizado) ? m.realizado : null;
  if (meses.length && meses.every((m) => manual(m) !== null)) {
    // Todos os meses informados manualmente: usa exatamente esses números.
    meses.forEach((m) => {
      const a = manual(m)!;
      mensal.push({ label: m.label, atual: a, meta: m.meta, pct: m.meta ? a / m.meta : 0 });
    });
  } else if (meses.length) {
    const firstKey = meses[0].key;
    const lastKey = meses[meses.length - 1].key;
    const curKey = (s.dataAte || "").slice(0, 7);
    // matrículas antes do primeiro mês contam para o primeiro mês;
    // matrículas depois do último mês contam para o último.
    const countFor = (i: number) => {
      const k = meses[i].key;
      let n = porMes[k] ?? 0;
      if (i === 0)
        for (const [mk, v] of Object.entries(porMes)) if (mk < firstKey) n += v;
      if (i === meses.length - 1)
        for (const [mk, v] of Object.entries(porMes)) if (mk > lastKey) n += v;
      return n;
    };
    if (s.mensalModo === "mensal") {
      meses.forEach((m, i) => {
        const a = manual(m) ?? countFor(i);
        mensal.push({ label: m.label, atual: a, meta: m.meta, pct: m.meta ? a / m.meta : 0 });
      });
    } else {
      // Acumulado: o excedente de um mês já encerrado é transportado para o seguinte.
      let saldo = 0;
      meses.forEach((m, i) => {
        const fixo = manual(m);
        if (fixo !== null) {
          mensal.push({ label: m.label, atual: fixo, meta: m.meta, pct: m.meta ? fixo / m.meta : 0 });
          return;
        }
        saldo += countFor(i);
        const encerrado = curKey ? m.key < curKey : false;
        let a: number;
        if (encerrado && i < meses.length - 1) {
          a = Math.min(saldo, m.meta);
          saldo -= a;
        } else {
          a = saldo;
          saldo = 0;
        }
        mensal.push({ label: m.label, atual: a, meta: m.meta, pct: m.meta ? a / m.meta : 0 });
      });
    }
  }

  // ----- Segmentos (rematrícula) -----
  const segmentos: BarItem[] = SEGMENTS.map(({ key, label }) => {
    const a = rel?.rematriculaPorSegmento[key as SegmentKey] ?? 0;
    const m = s.metas.segmentos[key] ?? 0;
    return { label, atual: a, meta: m, pct: m ? a / m : 0 };
  });

  return {
    ano: s.ano,
    anoAnterior: s.anoAnterior,
    dataAteLabel: formatDateBR(s.dataAte),
    hasData: !!(rel || s.sources.nac || s.sources.integral) ||
      Object.values(s.overrides).some((v) => typeof v === "number"),
    captacao: meta(captAtual, s.metas.captacao),
    rematricula: meta(remAtual, s.metas.rematricula),
    total: meta(captAtual + remAtual, s.metas.captacao + s.metas.rematricula),
    nac: meta(nacAtual, s.metas.nac),
    integral: meta(intAtual, s.metas.integral),
    comparativo: {
      atual: captAtual,
      anterior: s.captacaoAnoAnterior,
      diff: captAtual - s.captacaoAnoAnterior,
    },
    mensal,
    segmentos,
  };
}

export const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
export const fmtSigned = (n: number) =>
  (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(Math.round(n)).toLocaleString("pt-BR");
