"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { THEMES, type Theme, type ThemeName } from "@/lib/theme";
import type { SlideKey } from "@/lib/types";
import type { DashboardView } from "@/lib/view";
import AnimatedNumber from "./AnimatedNumber";
import { BarChart, D, Footnote, GoalBar, KpiCards, Subtitle, Title } from "./parts";

export interface SlideDef {
  key: SlideKey;
  theme: ThemeName;
  render: (v: DashboardView, t: Theme) => ReactNode;
}

const note = (v: DashboardView) => `*Dados coletados até ${v.dataAteLabel}.`;

export const SLIDES: SlideDef[] = [
  {
    key: "abertura",
    theme: "navy",
    render: (v, t) => (
      <div className="slide-inner center">
        <motion.img
          src="/logo.png"
          alt="Colégio Marista de Brasília"
          className="cover-logo"
          initial={{ opacity: 0, scale: 0.6, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ delay: D, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        <Title
          theme={t}
          size={118}
          delay={D + 0.4}
          parts={[{ text: "Acompanhamento" }, { text: `Matrícula ${v.ano}`, hl: true, br: true }]}
        />
        <Subtitle theme={t} delay={D + 1.1}>
          CAPTAÇÃO · REMATRÍCULA
        </Subtitle>
        <motion.div
          className="cover-total"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: D + 1.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div>
            <span className="cover-num">
              <AnimatedNumber value={v.total.atual} delay={D + 1.6} duration={2.4} />
            </span>
            <span className="cover-cap">estudantes para {v.ano}</span>
          </div>
        </motion.div>
        <Footnote theme={t}>{note(v)}</Footnote>
      </div>
    ),
  },
  {
    key: "captacaoGeral",
    theme: "navy",
    render: (v, t) => (
      <div className="slide-inner">
        <Title theme={t} parts={[{ text: "Meta geral de" }, { text: `CAPTAÇÃO ${v.ano}`, hl: true }]} />
        <KpiCards values={[v.captacao.atual, v.captacao.meta, v.captacao.falta]} />
        <GoalBar m={v.captacao} theme={t} />
        <Footnote theme={t}>{note(v)}</Footnote>
      </div>
    ),
  },
  {
    key: "captacaoMensal",
    theme: "navy",
    render: (v, t) => (
      <div className="slide-inner">
        <Title theme={t} size={80} parts={[{ text: "Meta mensal de" }, { text: `CAPTAÇÃO ${v.ano}`, hl: true }]} />
        <BarChart items={v.mensal} theme={t} rowHeight={v.mensal.length > 6 ? 70 : 92} />
        <Footnote theme={t}>{note(v)}</Footnote>
      </div>
    ),
  },
  {
    key: "comparativo",
    theme: "navy",
    render: (v, t) => {
      const c = v.comparativo;
      const up = c.diff >= 0;
      const growth = c.anterior > 0 ? (c.diff / c.anterior) * 100 : 0;
      return (
        <div className="slide-inner">
          <Title theme={t} parts={[{ text: "Meta de" }, { text: `CAPTAÇÃO ${v.ano}`, hl: true }]} />
          <Subtitle theme={t}>
            DESEMPENHO COMPARATIVO {v.ano} × {v.anoAnterior}
          </Subtitle>
          <div className="versus">
            <motion.div
              className="vs-card now"
              initial={{ opacity: 0, x: -160, rotateY: 25 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ delay: D + 0.6, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="vs-label">CAMPANHA {v.ano}</div>
              <div className="vs-value">
                <AnimatedNumber value={c.atual} delay={D + 0.8} />
              </div>
            </motion.div>
            <motion.div
              className="vs-mid"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: D + 1, type: "spring", stiffness: 180, damping: 14 }}
            >
              VS
            </motion.div>
            <motion.div
              className="vs-card prev"
              initial={{ opacity: 0, x: 160, rotateY: -25 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ delay: D + 0.6, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="vs-label">CAMPANHA {v.anoAnterior}</div>
              <div className="vs-value">
                <AnimatedNumber value={c.anterior} delay={D + 0.8} />
              </div>
            </motion.div>
          </div>
          <motion.div
            className={`vs-result ${up ? "up" : "down"}`}
            initial={{ opacity: 0, y: 60, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: D + 1.7, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="vs-arrow">{up ? "▲" : "▼"}</span>
            <span className="vs-res-num">
              <AnimatedNumber value={c.diff} signed delay={D + 1.8} /> alunos
            </span>
            <span className="vs-res-pct">
              (<AnimatedNumber value={growth} signed suffix="%" delay={D + 1.8} />)
            </span>
          </motion.div>
          <Footnote theme={t}>
            *Dados de {v.anoAnterior} correspondentes ao mesmo período de {v.ano}. Coletados até {v.dataAteLabel}.
          </Footnote>
        </div>
      );
    },
  },
  {
    key: "rematriculaGeral",
    theme: "purple",
    render: (v, t) => (
      <div className="slide-inner">
        <Title theme={t} parts={[{ text: "Meta geral" }, { text: `REMATRÍCULA ${v.ano}`, hl: true }]} />
        <KpiCards values={[v.rematricula.atual, v.rematricula.meta, v.rematricula.falta]} />
        <GoalBar m={v.rematricula} theme={t} />
        <Footnote theme={t}>{note(v)}</Footnote>
      </div>
    ),
  },
  {
    key: "rematriculaSegmentos",
    theme: "purple",
    render: (v, t) => (
      <div className="slide-inner">
        <Title
          theme={t}
          size={84}
          parts={[{ text: "Meta por segmento" }, { text: `REMATRÍCULA ${v.ano}`, hl: true, br: true }]}
        />
        <BarChart items={v.segmentos} theme={t} rowHeight={110} />
        <Footnote theme={t}>{note(v)}</Footnote>
      </div>
    ),
  },
  {
    key: "total",
    theme: "yellow",
    render: (v, t) => (
      <div className="slide-inner">
        <Title theme={t} parts={[{ text: "Meta TOTAL" }, { text: "MAT + REM", hl: true }]} />
        <KpiCards values={[v.total.atual, v.total.meta, v.total.falta]} />
        <GoalBar m={v.total} theme={t} />
        <Footnote theme={t}>{note(v)}</Footnote>
      </div>
    ),
  },
  {
    key: "nac",
    theme: "orange",
    render: (v, t) => (
      <div className="slide-inner">
        <Title theme={t} size={120} parts={[{ text: "NAC" }]} />
        <KpiCards values={[v.nac.atual, v.nac.meta, v.nac.falta]} />
        <GoalBar m={v.nac} theme={t} />
        <Footnote theme={t}>{note(v)}</Footnote>
      </div>
    ),
  },
  {
    key: "integral",
    theme: "teal",
    render: (v, t) => (
      <div className="slide-inner">
        <Title theme={t} size={120} parts={[{ text: "INTEGRAL" }]} />
        <KpiCards values={[v.integral.atual, v.integral.meta, v.integral.falta]} />
        <GoalBar m={v.integral} theme={t} />
        <Footnote theme={t}>{note(v)}</Footnote>
      </div>
    ),
  },
];

export const themeOf = (s: SlideDef) => THEMES[s.theme];
