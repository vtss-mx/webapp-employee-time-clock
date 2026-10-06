import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { config } from '../utils/config';
import { locationBlocker, locationProblemOf, type DeviceLocation, type LocationProblem } from '../utils/geolocation';
import { locationReading, type LocationTake } from '../utils/locationPayload';

/** Una lectura y cuándo llegó (reloj del dispositivo: solo para saber su edad). */
interface Fix extends DeviceLocation {
  at: number;
}

/** Problemas que no se arreglan esperando: no se espera una lectura que no llegará. */
const PERMANENT: ReadonlySet<LocationProblem> = new Set(['denied', 'insecure', 'unsupported']);

export interface WarmLocation {
  /**
   * La toma para una identificación: al instante si hay lecturas recientes (la más precisa decide y todas viajan); si
   * no, espera la siguiente lectura con tope (`checkpointLocationWaitMs`). null: sin ubicación (decide el servidor).
   */
  take: () => Promise<LocationTake | null>;
}

/**
 * Ubicación "caliente" mientras la pantalla está abierta (antifraude 2b, validadores que requieren ubicación): observa
 * la ubicación del dispositivo (`watchPosition`, aviso NATIVO la primera vez) y guarda las últimas lecturas; así cada
 * identificación lleva su ubicación sin agregar una espera. Con la pestaña oculta deja de observar (no gasta batería)
 * y vuelve al mostrarse. Un problema que la persona debe resolver (permiso bloqueado, conexión no segura, navegador
 * sin ubicación) se informa UNA vez con `onProblem`; nunca impide identificar: el servidor decide.
 */
export function useWarmLocation(enabled: boolean, onProblem: (problem: LocationProblem) => void): WarmLocation {
  const fixes = useRef<Fix[]>([]);
  const problem = useRef<LocationProblem | null>(null);
  const waiters = useRef<Array<() => void>>([]);
  const report = useRef(onProblem);
  useLayoutEffect(() => {
    report.current = onProblem;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const reported = new Set<LocationProblem>();
    const wake = () => waiters.current.splice(0).forEach((resolve) => resolve());
    const fail = (next: LocationProblem) => {
      problem.current = next;
      if (PERMANENT.has(next) && !reported.has(next)) {
        reported.add(next);
        report.current(next);
      }
      wake();
    };
    const blocker = locationBlocker();
    if (blocker) {
      fail(blocker);
      return undefined;
    }
    const geolocation = navigator.geolocation;
    let watchId: number | null = null;
    const start = () => {
      if (watchId !== null || document.visibilityState === 'hidden') return;
      watchId = geolocation.watchPosition(
        ({ coords }) => {
          problem.current = null;
          fixes.current = [...fixes.current, { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, at: Date.now() }].slice(-config.locationSamples);
          wake();
        },
        (error) => fail(locationProblemOf(error)),
        { enableHighAccuracy: true, maximumAge: 0 },
      );
    };
    const stop = () => {
      if (watchId !== null) geolocation.clearWatch(watchId);
      watchId = null;
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
      wake();
    };
  }, [enabled]);

  const take = useCallback(async (): Promise<LocationTake | null> => {
    if (!enabled) return null;
    const recent = () => fixes.current.filter((fix) => Date.now() - fix.at <= config.checkpointLocationMaxAgeMs);
    if (!recent().length && !(problem.current && PERMANENT.has(problem.current))) {
      // Sin lectura reciente: se espera la siguiente (o un error), nunca más que el tope.
      await new Promise<void>((resolve) => {
        waiters.current.push(resolve);
        window.setTimeout(resolve, config.checkpointLocationWaitMs);
      });
    }
    const samples = recent();
    if (!samples.length) return null;
    const best = samples.reduce((winner, fix) => (fix.accuracy < winner.accuracy ? fix : winner));
    return { ...locationReading(best), samples: samples.map(locationReading) };
  }, [enabled]);

  return useMemo(() => ({ take }), [take]);
}
