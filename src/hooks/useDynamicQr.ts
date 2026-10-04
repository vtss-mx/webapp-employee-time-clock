import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { meService } from '../services/meService';
import type { DynamicQr } from '../types';
import { config } from '../utils/config';
import { useMountedRef } from './useMountedRef';
import { usePolling } from './usePolling';

/**
 * - loading: pidiendo el primer código.
 * - ready: vigente (con su cuenta regresiva).
 * - used: un validador lo acaba de usar (se celebra un instante y se muestra otro).
 * - replaced: lo reemplazó otro dispositivo o la empresa lo invalidó (no se pide otro solo: si el
 *   empleado lo tiene abierto en dos teléfonos, se reemplazarían sin fin).
 * - paused: venció con la pantalla oculta (no se gastan códigos que nadie ve).
 * - error: no se pudo generar.
 */
export type DynamicQrPhase = 'loading' | 'ready' | 'used' | 'replaced' | 'paused' | 'error';

/** Tiempo que se muestra "¡Listo!" tras usarse, antes del código nuevo. */
const USED_PAUSE_MS = 1800;

/**
 * QR dinámico del empleado: lo pide al abrir, lo renueva solo al vencer (vigencia de la política de
 * su empresa) y bajo demanda (`renew`), y en cuanto un validador lo usa muestra otro: un QR sirve
 * una sola vez. Mientras se muestra, la pantalla no se apaga (si el navegador lo permite).
 */
export function useDynamicQr() {
  const mounted = useMountedRef();
  const [qr, setQr] = useState<DynamicQr | null>(null);
  const [phase, setPhase] = useState<DynamicQrPhase>('loading');
  const [error, setError] = useState<unknown>(null);
  const [deadline, setDeadline] = useState(0);
  const issuing = useRef(false);
  const current = useRef({ phase, qr });
  useLayoutEffect(() => {
    current.current = { phase, qr };
  });

  const renew = useCallback(async () => {
    if (issuing.current) return;
    issuing.current = true;
    setError(null);
    try {
      const next = await meService.issueQr();
      if (!mounted.current) return;
      setQr(next);
      // Reloj del dispositivo + vigencia: no depende de que su hora coincida con la del servidor.
      setDeadline(Date.now() + next.lifetime_seconds * 1000);
      setPhase('ready');
    } catch (e) {
      if (!mounted.current) return;
      setError(e);
      setPhase('error');
    } finally {
      issuing.current = false;
    }
  }, [mounted]);

  useEffect(() => {
    void renew();
  }, [renew]);

  // Al vencer, otro (con la pantalla oculta se pausa y se renueva al volver). Un solo temporizador:
  // la cuenta regresiva y el anillo se dibujan aparte (QrCountdown y CSS), sin redibujar la pantalla.
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'hidden') setPhase('paused');
      else void renew();
    }, Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [phase, deadline, renew]);

  // Recién usado: "¡Listo!" un instante y el siguiente.
  useEffect(() => {
    if (phase !== 'used') return undefined;
    const timer = window.setTimeout(() => void renew(), USED_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, renew]);

  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible' && current.current.phase === 'paused') void renew();
    };
    document.addEventListener('visibilitychange', wake);
    return () => document.removeEventListener('visibilitychange', wake);
  }, [renew]);

  useScreenAwake();

  // ¿Ya lo usó un validador? (se consulta seguido: la persona está frente al lector).
  usePolling(
    async (signal) => {
      // Solo se consulta en la fase 'ready', que `renew` fija junto con el código: siempre hay uno en pantalla.
      const shown = current.current.qr as DynamicQr;
      const status = await meService.qrStatus(shown.id, signal);
      if (!mounted.current || current.current.qr?.id !== status.id || current.current.phase !== 'ready') return;
      if (status.status === 'USED') setPhase('used');
      else if (status.status === 'REVOKED') setPhase('replaced');
    },
    { intervalMs: config.qrStatusPollSeconds * 1000, enabled: phase === 'ready', immediate: false },
  );

  return {
    qr,
    phase,
    error,
    /** Momento (reloj del dispositivo, ms) en que vence el código vigente. */
    deadline,
    renew,
  };
}

/** Mantiene la pantalla encendida mientras se muestra el código (Wake Lock; sin soporte, nada). */
function useScreenAwake() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return undefined;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          if (disposed) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => undefined); // batería baja o el navegador no lo permite: no es indispensable
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, []);
}
