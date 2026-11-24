"use client";
import { createContext, useContext } from "react";

// "Modo leve": para aparelhos fracos (Chromecast, TV Box, navegadores de TV).
// Troca transições pesadas (clip-path, blur, fundo animado, confete) por
// animações só de opacidade e transform, que a GPU dessas TVs aguenta.
export const LiteContext = createContext(false);
export const useLite = () => useContext(LiteContext);

export const LITE_KEY = "painel-modo-leve";

/** Valor forçado pela URL (?leve=1 / ?leve=0) ou salvo no aparelho; null = decidir sozinho. */
export function liteOverride(): boolean | null {
  try {
    const q = new URLSearchParams(window.location.search).get("leve");
    if (q === "1" || q === "0") {
      localStorage.setItem(LITE_KEY, q);
      return q === "1";
    }
    const saved = localStorage.getItem(LITE_KEY);
    if (saved === "1" || saved === "0") return saved === "1";
  } catch {
    /* localStorage indisponível */
  }
  return null;
}

/** Aparelhos de TV conhecidos ou com pouco hardware. */
export function looksLikeWeakDevice(): boolean {
  const ua = navigator.userAgent;
  if (/PainelTV-Android|CrKey|Chromecast|GoogleTV|Google TV|Android TV|AFT[A-Z]|SmartTV|SMART-TV|Tizen|Web0S|webOS|BRAVIA|HbbTV|NetCast|Roku|AppleTV/i.test(ua))
    return true;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return true;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
  return false;
}

/** Mede o FPS real por alguns segundos (para TVs que se apresentam como PC). */
export function measureFps(ms = 4000): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = (t: number) => {
      frames++;
      if (t - start < ms) requestAnimationFrame(tick);
      else resolve((frames * 1000) / (t - start));
    };
    requestAnimationFrame(tick);
  });
}
