"use client";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeState, type DashboardState } from "@/lib/types";
import { buildView } from "@/lib/view";
import { SLIDES, themeOf } from "./Slides";

const W = 1920;
const H = 1080;
const POLL_MS = 60_000;

/* Transições entre slides: alternam a cada troca. */
const TRANSITIONS: Variants[] = [
  // Cortina da direita para a esquerda
  {
    initial: { clipPath: "inset(0% 0% 0% 100%)" },
    animate: { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 1.1, ease: [0.77, 0, 0.18, 1] } },
  },
  // Círculo expandindo do centro
  {
    initial: { clipPath: "circle(0% at 50% 55%)" },
    animate: { clipPath: "circle(120% at 50% 55%)", transition: { duration: 1.25, ease: [0.65, 0, 0.35, 1] } },
  },
  // Diagonal
  {
    initial: { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%)" },
    animate: {
      clipPath: "polygon(0% 0%, 200% 0%, 0% 200%, 0% 0%)",
      transition: { duration: 1.2, ease: [0.77, 0, 0.18, 1] },
    },
  },
  // Empurra de baixo para cima com leve zoom
  {
    initial: { y: "100%", scale: 1.08 },
    animate: { y: "0%", scale: 1, transition: { duration: 1.1, ease: [0.77, 0, 0.18, 1] } },
  },
  // Cortina vertical a partir do centro
  {
    initial: { clipPath: "inset(0% 50% 0% 50%)" },
    animate: { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 1.1, ease: [0.77, 0, 0.18, 1] } },
  },
];

const EXIT = {
  scale: 0.94,
  opacity: 0.4,
  filter: "blur(6px)",
  transition: { duration: 1.1, ease: [0.77, 0, 0.18, 1] as const },
};

export default function Presenter({ initial }: { initial: DashboardState }) {
  const [state, setState] = useState<DashboardState>(() => normalizeState(initial));
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0); // conta trocas (para escolher a transição)
  const [paused, setPaused] = useState(false);
  // Palco ocupa a tela inteira: escala pela menor dimensão e o lado que sobra
  // vira área útil (sem faixas vazias nas laterais em TVs de outro formato).
  const [box, setBox] = useState({ scale: 1, w: W, h: H });
  const [controls, setControls] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedAt = useRef(Date.now());

  const view = useMemo(() => buildView(state), [state]);
  const slides = useMemo(
    () => SLIDES.filter((s) => state.settings.slides[s.key] !== false),
    [state.settings.slides],
  );
  const safeIndex = slides.length ? index % slides.length : 0;
  const slide = slides[safeIndex];
  const theme = slide ? themeOf(slide) : themeOf(SLIDES[0]);
  const seconds = Math.max(5, state.settings.slideSeconds || 14);

  /* ---- Escala do palco 1920x1080 para qualquer tela ---- */
  useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.min(vw / W, vh / H);
      setBox({ scale, w: Math.ceil(vw / scale), h: Math.ceil(vh / scale) });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  /* ---- Relógio ---- */
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  /* ---- Busca novos dados periodicamente ---- */
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/data", { cache: "no-store" });
        if (!res.ok) return;
        const next = normalizeState(await res.json());
        if (alive) setState((cur) => (cur.updatedAt === next.updatedAt ? cur : next));
      } catch {
        /* sem rede: mantém os dados atuais */
      }
    };
    const t = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  /* ---- Avança os slides ---- */
  const go = useCallback(
    (delta: number) => {
      if (!slides.length) return;
      // recarrega a página a cada ~6h para manter a TV leve
      if (Date.now() - loadedAt.current > 6 * 3600_000 && delta > 0 && safeIndex === slides.length - 1) {
        window.location.reload();
        return;
      }
      setIndex((i) => (i + delta + slides.length) % slides.length);
      setStep((s) => s + 1);
    },
    [slides.length, safeIndex],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setTimeout(() => go(1), seconds * 1000);
    return () => clearTimeout(t);
  }, [go, paused, seconds, slides.length, step]);

  /* ---- Teclado / controle remoto ---- */
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", "MediaTrackNext"].includes(e.key)) go(1);
      else if (["ArrowLeft", "PageUp", "MediaTrackPrevious"].includes(e.key)) go(-1);
      else if (e.key === " " || e.key === "Enter" || e.key === "MediaPlayPause") setPaused((p) => !p);
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleFullscreen]);

  /* ---- Mantém a tela ligada ---- */
  useEffect(() => {
    type WL = { release: () => Promise<void> };
    let lock: WL | null = null;
    const req = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WL> } };
        lock = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        /* não suportado */
      }
    };
    req();
    const onVis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  const showControls = () => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 3000);
  };

  useEffect(() => {
    document.body.style.background = theme.bg;
  }, [theme.bg]);

  const variants = TRANSITIONS[step % TRANSITIONS.length];

  return (
    <div className={`tv-root ${controls ? "" : "hide-cursor"}`} onMouseMove={showControls} onClick={showControls}>
      <div
        className="stage"
        style={{
          width: box.w,
          height: box.h,
          transform: `translate(-50%, -50%) scale(${box.scale})`,
        }}
      >
        <AnimatePresence initial={false}>
          {slide && (
            <motion.section
              key={`${slide.key}-${step}`}
              className="slide"
              style={{ background: theme.bg, color: theme.text }}
              variants={variants}
              initial="initial"
              animate="animate"
              exit={EXIT}
            >
              <Ambient bg={theme.bg} bg2={theme.bg2} text={theme.text} year={view.ano} />
              {view.hasData || slide.key === "abertura" ? (
                slide.render(view, theme)
              ) : (
                <div className="slide-inner center">
                  <h1 className="tv-title" style={{ fontSize: 80 }}>
                    Aguardando dados…
                  </h1>
                  <p className="empty-hint">Envie as planilhas pelo painel administrativo.</p>
                </div>
              )}
              {slide.key !== "abertura" && <img src="/logo.png" alt="" className="corner-logo" />}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Faixa de luz que cruza a tela durante a troca */}
        <AnimatePresence>
          <motion.div
            key={`sweep-${step}`}
            className="sweep"
            style={{ background: `linear-gradient(90deg, transparent, ${theme.highlight}, transparent)` }}
            initial={{ x: "-40%", opacity: 0 }}
            animate={{ x: "140%", opacity: [0, 0.55, 0] }}
            transition={{ duration: 1.3, ease: [0.77, 0, 0.18, 1] }}
          />
        </AnimatePresence>

        {/* Rodapé fixo: indicador de slides + relógio */}
        <div className="hud" style={{ color: theme.text }}>
          <div className="dots">
            {slides.map((s, i) => (
              <span key={s.key} className={i === safeIndex ? "on" : ""} style={{ background: theme.text }} />
            ))}
          </div>
          {now && (
            <div className="clock">
              {capitalize(now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }))} ·{" "}
              {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
        {!paused && slides.length > 1 && (
          <motion.div
            key={`timer-${step}`}
            className="timer"
            style={{ background: theme.highlight }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: seconds, ease: "linear" }}
          />
        )}
      </div>

      <div className={`tv-controls ${controls ? "show" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button onClick={() => go(-1)} aria-label="Anterior">‹</button>
        <button onClick={() => setPaused((p) => !p)}>{paused ? "▶ Continuar" : "❚❚ Pausar"}</button>
        <button onClick={() => go(1)} aria-label="Próximo">›</button>
        <button onClick={toggleFullscreen}>⛶ Tela cheia</button>
      </div>
    </div>
  );
}

/* Fundo animado: bolhas de luz em movimento lento + marca d'água do ano. */
function Ambient({ bg, bg2, text, year }: { bg: string; bg2: string; text: string; year: number }) {
  return (
    <div className="ambient" aria-hidden>
      <div className="blob b1" style={{ background: `radial-gradient(circle, ${bg2} 0%, transparent 65%)` }} />
      <div className="blob b2" style={{ background: `radial-gradient(circle, ${bg2} 0%, transparent 65%)` }} />
      <div
        className="blob b3"
        style={{ background: `radial-gradient(circle, rgba(255,255,255,.18) 0%, transparent 60%)` }}
      />
      <div className="grid" style={{ backgroundImage: `radial-gradient(${text}22 1.5px, transparent 1.5px)` }} />
      <div className="watermark" style={{ WebkitTextStroke: `2px ${text}1f`, color: "transparent" }}>
        {year}
      </div>
      <div className="vignette" style={{ boxShadow: `inset 0 0 320px ${bg}` }} />
    </div>
  );
}

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
