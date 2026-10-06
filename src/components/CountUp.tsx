import { useEffect, useState } from 'react';

interface CountUpProps {
  value: number;
  duration?: number;
  /** Cómo se lee el número mientras sube y al final (dinero, bytes, tiempo...); por omisión, tal cual. */
  format?: (value: number) => string;
}

/** Número animado (de 0 al valor) para indicadores; termina exactamente en el valor (con sus decimales). */
export function CountUp({ value, duration = 700, format = String }: CountUpProps) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    // El progreso se mide con el mismo reloj que `start` (el timestamp que pasa rAF puede usar
    // otro origen y ser anterior a `start`, lo que producía valores negativos).
    const tick = () => {
      const p = Math.min(1, Math.max(0, (performance.now() - start) / duration));
      setShown(p < 1 ? Math.round(value * (1 - Math.pow(1 - p, 3))) : value);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}
