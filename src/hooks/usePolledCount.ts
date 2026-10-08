import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '../i18n';
import { usePolling } from './usePolling';

interface Options {
  enabled: boolean;
  intervalMs: number;
  /** Evento de ventana con que otra pantalla avisa que el número cambió (se vuelve a consultar ya). */
  changedEvent: string;
}

/**
 * Un valor que se consulta periódicamente y al avisar que cambió: la base de los contadores del menú
 * (validaciones pendientes, errores pendientes) y del resumen de alertas lentas (contador y aviso en vivo con
 * UNA sola consulta). `load` debe ser estable (función de módulo). null: aún no se sabe o no está activo.
 * Al cambiar el idioma se consulta de nuevo en ese momento (lo que traiga texto del servidor llega en el idioma
 * nuevo; regla 16, en caliente).
 */
export function usePolledValue<T>(load: (signal?: AbortSignal) => Promise<T>, { enabled, intervalMs, changedEvent }: Options): T | null {
  const [value, setValue] = useState<T | null>(null);
  // La consulta periódica y la de un aviso pueden ir a la vez: solo cuenta la más reciente (una
  // respuesta vieja que llega tarde no regresa el valor a uno anterior).
  const latest = useRef(0);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const turn = ++latest.current;
    const next = await load(signal);
    if (turn === latest.current) setValue(next);
  }, [load]);

  usePolling(refresh, { intervalMs, enabled });

  const locale = useLocale();
  const shownLocale = useRef(locale);
  useEffect(() => {
    if (shownLocale.current === locale) return;
    shownLocale.current = locale;
    if (enabled) void refresh().catch(() => undefined);
  }, [enabled, locale, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onChange = () => void refresh().catch(() => undefined);
    window.addEventListener(changedEvent, onChange);
    return () => window.removeEventListener(changedEvent, onChange);
  }, [enabled, refresh, changedEvent]);

  return value;
}

/** Un número que se consulta periódicamente y al avisar que cambió (contadores del menú). */
export function usePolledCount(load: (signal?: AbortSignal) => Promise<number>, options: Options): number | null {
  return usePolledValue(load, options);
}
