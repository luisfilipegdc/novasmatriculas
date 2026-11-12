export interface Theme {
  bg: string;
  bg2: string; // tom para o gradiente / bolhas
  text: string;
  highlight: string; // cor do destaque no título
  bar: string; // barra de progresso
  barText: string;
  glow: string;
}

export const THEMES = {
  navy: {
    bg: "#003660",
    bg2: "#0a4f86",
    text: "#ffffff",
    highlight: "#FFC000",
    bar: "#FFC000",
    barText: "#0b2545",
    glow: "rgba(255,192,0,.35)",
  },
  purple: {
    bg: "#7660AE",
    bg2: "#9a86d0",
    text: "#ffffff",
    highlight: "#FFC000",
    bar: "#FFC000",
    barText: "#2b1d55",
    glow: "rgba(255,192,0,.35)",
  },
  yellow: {
    bg: "#FFC000",
    bg2: "#ffd659",
    text: "#0b1f4d",
    highlight: "#0b1f4d",
    bar: "#002060",
    barText: "#ffffff",
    glow: "rgba(0,32,96,.25)",
  },
  orange: {
    bg: "#E36C0A",
    bg2: "#f59a45",
    text: "#ffffff",
    highlight: "#FFE08A",
    bar: "#003660",
    barText: "#ffffff",
    glow: "rgba(0,54,96,.3)",
  },
  teal: {
    bg: "#31849B",
    bg2: "#4fb0c9",
    text: "#ffffff",
    highlight: "#FFC000",
    bar: "#002060",
    barText: "#ffffff",
    glow: "rgba(0,32,96,.3)",
  },
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;
