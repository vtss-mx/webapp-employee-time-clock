import { useCallback, useEffect, useState } from 'react';

/**
 * Copiar al portapapeles con confirmación visual: `copied` queda en true unos segundos (el botón
 * dice "Copiado") y vuelve solo. Sin permiso del navegador no hace nada (no es indispensable).
 */
export function useCopy(resetMs = 2500) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), resetMs);
    return () => window.clearTimeout(timer);
  }, [copied, resetMs]);
  const copy = useCallback((text: string) => {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => setCopied(true))
      .catch(() => undefined);
  }, []);
  return { copied, copy };
}
