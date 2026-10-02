import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Cuenta regresiva en segundos que llama a `onDone` al llegar a cero (una sola vez).
 * Sin `seconds` no hace nada y devuelve null.
 */
export function useCountdown(seconds: number | undefined, onDone: () => void): number | null {
  const [left, setLeft] = useState(seconds ?? 0);
  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (!seconds) return undefined;
    setLeft(seconds);
    const started = Date.now();
    const timer = window.setInterval(() => {
      const remaining = seconds - Math.floor((Date.now() - started) / 1000);
      if (remaining > 0) {
        setLeft(remaining);
        return;
      }
      window.clearInterval(timer);
      done.current();
    }, 250);
    return () => window.clearInterval(timer);
  }, [seconds]);
  return seconds ? left : null;
}
