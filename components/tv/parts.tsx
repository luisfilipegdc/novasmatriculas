"use client";
import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import AnimatedNumber from "./AnimatedNumber";
import type { Theme } from "@/lib/theme";
import type { BarItem, Meta } from "@/lib/view";

const EASE = [0.16, 1, 0.3, 1] as const;
/** Atraso base: espera a transição de entrada do slide terminar. */
export const D = 0.55;

/* ---------- Título com palavras surgindo por trás de uma máscara ---------- */
export function Title({
  parts,
  theme,
  size = 92,
  delay = D,
}: {
  parts: { text: string; hl?: boolean; br?: boolean }[];
  theme: Theme;
  size?: number;
  delay?: number;
}) {
  let i = 0;
  return (
    <h1 className="tv-title" style={{ fontSize: size, color: theme.text }}>
      {parts.map((p, pi) => (
        <span key={pi}>
          {p.br && <br />}
          {p.text.split(" ").filter(Boolean).map((w, wi) => {
            const idx = i++;
            return (
              <span className="word-mask" key={wi}>
                <motion.span
                  className="word"
                  style={{ color: p.hl ? theme.highlight : undefined }}
                  initial={{ y: "110%", rotate: 4 }}
                  animate={{ y: "0%", rotate: 0 }}
                  transition={{ delay: delay + idx * 0.07, duration: 0.9, ease: EASE }}
                >
                  {w}
                </motion.span>
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

export function Subtitle({ children, theme, delay = D + 0.4 }: { children: ReactNode; theme: Theme; delay?: number }) {
  return (
    <motion.div
      className="tv-subtitle"
      style={{ color: theme.highlight }}
      initial={{ opacity: 0, letterSpacing: "0.6em" }}
      animate={{ opacity: 1, letterSpacing: "0.08em" }}
      transition={{ delay, duration: 1.2, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Três cartões: Já temos / Compromisso / Faltam ---------- */
export function KpiCards({
  labels = ["JÁ TEMOS", "NOSSO COMPROMISSO", "FALTAM..."],
  values,
  diffMode = "falta",
  delay = D + 0.35,
}: {
  labels?: [string, string, string];
  values: [number, number, number];
  diffMode?: "falta" | "resultado";
  delay?: number;
}) {
  const diff = values[2];
  const ahead = diff >= 0;
  const thirdLabel = diffMode === "falta" ? (ahead ? "ACIMA DA META" : labels[2]) : labels[2];
  const items = [
    { label: labels[0], value: values[0], cls: "" },
    { label: labels[1], value: values[1], cls: "" },
    {
      label: thirdLabel,
      value: diff,
      cls: ahead ? "pos" : "neg",
      signed: true,
    },
  ];
  return (
    <div className="kpis">
      {items.map((it, i) => (
        <motion.div
          key={i}
          className={`kpi ${it.cls}`}
          initial={{ opacity: 0, y: 80, rotateX: -35, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
          transition={{ delay: delay + i * 0.14, duration: 1, ease: EASE }}
        >
          <div className="kpi-label">{it.label}</div>
          <div className="kpi-value">
            <AnimatedNumber value={it.value} signed={!!it.signed} delay={delay + 0.2 + i * 0.14} />
          </div>
          <motion.div
            className="kpi-shine"
            initial={{ x: "-120%" }}
            animate={{ x: "220%" }}
            transition={{ delay: delay + 1.6 + i * 0.15, duration: 1.4, ease: "easeInOut" }}
          />
        </motion.div>
      ))}
    </div>
  );
}

/* ---------- Barra "XX% DA META" ---------- */
export function GoalBar({ m, theme, delay = D + 1 }: { m: Meta; theme: Theme; delay?: number }) {
  const pct = Math.max(0, m.pct);
  const width = Math.min(pct, 1) * 100;
  const done = pct >= 1;
  return (
    <div className="goalbar-wrap">
      <motion.div
        className="goalbar-track"
        initial={{ opacity: 0, scaleX: 0.6 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: delay - 0.3, duration: 0.8, ease: EASE }}
      >
        <motion.div
          className="goalbar-fill"
          style={{ backgroundColor: theme.bar, color: theme.barText, boxShadow: `0 0 60px ${theme.glow}` }}
          initial={{ width: "0%" }}
          animate={{ width: `${width}%` }}
          transition={{ delay, duration: 2.2, ease: EASE }}
        >
          <motion.div
            className="goalbar-sheen"
            initial={{ x: "-100%" }}
            animate={{ x: "250%" }}
            transition={{ delay: delay + 2.2, duration: 1.4, ease: "easeInOut" }}
          />
          {width >= 45 && (
            <span className="goalbar-label">
              <AnimatedNumber value={pct * 100} suffix="%" delay={delay} duration={2.2} /> DA META
            </span>
          )}
        </motion.div>
        {width < 45 && (
          <motion.span
            className="goalbar-label outside"
            style={{ left: `calc(${width}% + 28px)`, color: theme.text }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.4 }}
          >
            <AnimatedNumber value={pct * 100} suffix="%" delay={delay} duration={2.2} /> DA META
          </motion.span>
        )}
      </motion.div>
      {done && <Celebrate theme={theme} delay={delay + 2.1} />}
    </div>
  );
}

/* ---------- Comemoração quando a meta é batida ---------- */
const CONFETTI = ["#FFC000", "#ffffff", "#9BBB59", "#4F81BD", "#E36C0A", "#7660AE"];
export function Celebrate({ theme, delay }: { theme: Theme; delay: number }) {
  const pieces = Array.from({ length: 46 }, (_, i) => i);
  return (
    <>
      <motion.div
        className="badge-done"
        style={{ background: theme.text, color: theme.bg }}
        initial={{ scale: 0, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: -4, opacity: 1 }}
        transition={{ delay, type: "spring", stiffness: 260, damping: 14 }}
      >
        ★ META ATINGIDA ★
      </motion.div>
      <div className="confetti">
        {pieces.map((i) => {
          const angle = (i / pieces.length) * Math.PI * 2;
          const dist = 380 + ((i * 97) % 420);
          return (
            <motion.span
              key={i}
              style={{ background: CONFETTI[i % CONFETTI.length], borderRadius: i % 3 ? 3 : 20 }}
              initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.4 }}
              animate={{
                x: Math.cos(angle) * dist,
                y: [0, Math.sin(angle) * dist * 0.6, Math.sin(angle) * dist * 0.6 + 420],
                opacity: [0, 1, 1, 0],
                rotate: 360 + i * 40,
                scale: 1,
              }}
              transition={{ delay: delay + (i % 6) * 0.03, duration: 2.6, ease: "easeOut" }}
            />
          );
        })}
      </div>
    </>
  );
}

/* ---------- Gráfico de barras horizontais ---------- */
export function BarChart({
  items,
  theme,
  delay = D + 0.5,
  rowHeight = 96,
}: {
  items: BarItem[];
  theme: Theme;
  delay?: number;
  rowHeight?: number;
}) {
  const maxPct = Math.max(1, ...items.map((i) => i.pct));
  const scale = Math.min(maxPct, 1.25);
  return (
    <div className="barchart" style={{ "--row-h": `${rowHeight}px` } as CSSProperties}>
      <motion.div
        className="barchart-goal"
        style={{ left: `calc(var(--label-w) + (100% - var(--label-w) - var(--meta-w)) * ${1 / scale})` }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ delay: delay + 0.2, duration: 0.9, ease: EASE }}
      >
        <span>META</span>
      </motion.div>
      {items.map((it, i) => {
        const w = (Math.min(it.pct, scale) / scale) * 100;
        const done = it.pct >= 1;
        const d = delay + i * 0.13;
        return (
          <div className="bar-row" key={it.label}>
            <motion.div
              className="bar-label"
              style={{ color: theme.text }}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: d, duration: 0.7, ease: EASE }}
            >
              {it.label}
            </motion.div>
            <div className="bar-track">
              <motion.div
                className={`bar-fill ${done ? "done" : ""}`}
                initial={{ width: 0 }}
                animate={{ width: `${w}%` }}
                transition={{ delay: d + 0.15, duration: 1.6, ease: EASE }}
              >
                {w >= 14 && (
                  <span className="bar-pct">
                    <AnimatedNumber value={it.pct * 100} suffix="%" delay={d + 0.15} duration={1.6} />
                  </span>
                )}
              </motion.div>
              {w < 14 && (
                <motion.span
                  className="bar-pct outside"
                  style={{ left: `calc(${w}% + 18px)`, color: theme.text }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.9 }}
                  transition={{ delay: d + 0.4, duration: 0.6 }}
                >
                  <AnimatedNumber value={it.pct * 100} suffix="%" delay={d + 0.15} duration={1.6} />
                </motion.span>
              )}
              {done && (
                <motion.span
                  className="bar-check"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: d + 1.6, type: "spring", stiffness: 300, damping: 12 }}
                  style={{ left: `calc(${w}% + 14px)` }}
                >
                  ✓
                </motion.span>
              )}
            </div>
            <motion.div
              className="bar-meta"
              style={{ color: theme.text }}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: d + 0.3, duration: 0.7, ease: EASE }}
            >
              <strong>
                <AnimatedNumber value={it.atual} delay={d + 0.3} />
              </strong>
              <span> / Meta {it.meta.toLocaleString("pt-BR")}</span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export function Footnote({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <motion.div
      className="footnote"
      style={{ color: theme.text }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: D + 1.2, duration: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
