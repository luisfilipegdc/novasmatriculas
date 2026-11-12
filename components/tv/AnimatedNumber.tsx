"use client";
import { animate } from "framer-motion";
import { useEffect, useRef } from "react";

interface Props {
  value: number;
  delay?: number;
  duration?: number;
  signed?: boolean;
  suffix?: string;
  className?: string;
}

const format = (n: number, signed: boolean) => {
  const r = Math.round(n);
  const s = Math.abs(r).toLocaleString("pt-BR");
  if (!signed) return (r < 0 ? "-" : "") + s;
  return (r > 0 ? "+" : r < 0 ? "-" : "") + s;
};

/** Número que "conta" de 0 até o valor, com desaceleração suave. */
export default function AnimatedNumber({
  value,
  delay = 0,
  duration = 1.8,
  signed = false,
  suffix = "",
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = format(0, signed) + suffix;
    const controls = animate(0, value, {
      delay,
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = format(v, signed) + suffix;
      },
    });
    return () => controls.stop();
  }, [value, delay, duration, signed, suffix]);
  return <span ref={ref} className={className} />;
}
