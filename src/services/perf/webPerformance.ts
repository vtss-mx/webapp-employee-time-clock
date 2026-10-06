import { config } from '../../utils/config';
import { routeTemplate } from '../../utils/routeTemplate';
import { onApiTiming, type ApiTiming } from '../apiClient';
import { clearSamples, flush, record, type SampleKind } from './telemetry';
import { INP_DURATION_THRESHOLD_MS, observe, ShiftWindows, supports, WorstInteraction, type LayoutShiftEntry } from './vitals';

/**
 * Observadores de rendimiento del navegador (pantalla "Rendimiento" del ADMIN, pestaña Navegador): cómo vive la
 * app cada persona, medido en su dispositivo y enviado al backend propio en lotes (`telemetry.ts`).
 *
 * - Carga de la página (una vez por carga): TTFB (`navigation`) y FCP (`paint`) de la pantalla donde se abrió, y
 *   LCP (`largest-contentful-paint`: el último candidato antes de la primera tecla o toque o de ocultar la
 *   pestaña) de la pantalla que se ve al terminar la carga (una redirección sin interacción no la termina). Si
 *   la página se cargó oculta, FCP y LCP no se miden (no los vio nadie).
 * - Cada visita a una pantalla (desde que se ve hasta que se cambia de pantalla o se oculta): CLS (ventanas de
 *   sesión) e INP (la peor interacción), más cada tarea larga (`longtask`) de la pantalla.
 * - Cada intento de una petición a la API (`apiClient.onApiTiming`): "MÉTODO /api/plantilla", duración y estado.
 *
 * Privacidad: una pantalla es `routeTemplate(location.pathname)` (ids → `{id}`, sin query ni hash) y una API
 * es su plantilla; nunca ids, correos, textos escritos ni la URL real. Muestreo por carga de la página
 * (`config.perf.sampleRate`): una carga que no se muestrea no registra nada. Lo que el navegador no soporta
 * (Safari y Firefox no tienen LCP, INP ni tareas largas) simplemente no se mide. Nunca lanza ni abre un popup.
 */

interface Visit {
  /** La ruta real solo sirve para saber si se cambió de pantalla; nunca se envía. */
  pathname: string;
  screen: string;
  shifts: ShiftWindows;
  interactions: WorstInteraction;
  /** Una visita se cierra (y envía su CLS e INP) una sola vez: al cambiar de pantalla, al ocultarse o al salir. */
  open: boolean;
}

interface Session {
  /** Pantalla donde se cargó la página: dueña de TTFB, FCP y LCP. */
  initialScreen: string;
  /** Desde cuándo la página estuvo oculta (ms desde que empezó la navegación): lo pintado después no cuenta. */
  hiddenAt: number;
  /** Último candidato a LCP; se envía al terminar la carga (primera interacción, ocultarse o cambiar de pantalla). */
  lcp: number | null;
  visit: Visit;
  observers: PerformanceObserver[];
  /** Deja de escuchar la página (teclas, visibilidad, cierre), el temporizador del envío y las peticiones. */
  unlisten: () => void;
  /** El navegador mide cambios de diseño: solo entonces una visita envía su CLS (aunque sea 0). */
  measuresShifts: boolean;
}

/** ¿Esta carga de la página mide? Se decide una vez por carga (no por montaje de la app). */
let sampled: boolean | null = null;
/** Lo que se mide una vez por carga de la página (sobrevive a un reinicio de los observadores). */
const measuredOnce = new Set<SampleKind>();
let session: Session | null = null;

const visible = () => document.visibilityState !== 'hidden';

function newVisit(pathname: string): Visit {
  return { pathname, screen: routeTemplate(pathname), shifts: new ShiftWindows(), interactions: new WorstInteraction(), open: visible() };
}

/** Una métrica de la carga de la página, una sola vez por carga. */
function once(kind: SampleKind, name: string, value: number): void {
  if (measuredOnce.has(kind)) return;
  measuredOnce.add(kind);
  record({ kind, name, value });
}

/**
 * La carga terminó: su LCP es el último candidato (después ya no cambia) y es de la pantalla que se ve en ese
 * momento (una redirección durante la carga, p. ej. `/` → `/login`, la lleva a la pantalla de destino).
 */
function finishLoad(current: Session): void {
  if (current.lcp !== null) once('LCP', current.visit.screen, current.lcp);
  // Sin candidato todavía, LCP ya no se mide: lo que se pinte después de una interacción no es la carga.
  measuredOnce.add('LCP');
}

/** Cierra la visita a la pantalla: envía su CLS (si el navegador lo mide) y su INP (si hubo interacciones). */
function closeVisit(current: Session): void {
  const { visit } = current;
  if (!visit.open) return;
  visit.open = false;
  if (current.measuresShifts) record({ kind: 'CLS', name: visit.screen, value: visit.shifts.value });
  if (visit.interactions.value !== null) record({ kind: 'INP', name: visit.screen, value: visit.interactions.value });
}

/** Una petición a la API: su plantilla con el método (el backend la relaciona con su ruta real). */
function recordApi({ method, path, durationMs, status }: ApiTiming): void {
  record({ kind: 'API', name: `${method} /api${routeTemplate(path)}`, value: durationMs, status });
}

function startObservers(current: Session): PerformanceObserver[] {
  const loaded = (entry: PerformanceEntry) => entry.startTime < current.hiddenAt;
  const observers = [
    observe('navigation', (entry) => {
      const ttfb = (entry as PerformanceNavigationTiming).responseStart;
      if (ttfb > 0) once('TTFB', current.initialScreen, ttfb);
    }),
    observe('paint', (entry) => {
      if (entry.name === 'first-contentful-paint' && loaded(entry)) once('FCP', current.initialScreen, entry.startTime);
    }),
    observe('largest-contentful-paint', (entry) => {
      if (!measuredOnce.has('LCP') && loaded(entry)) current.lcp = entry.startTime;
    }),
    observe('layout-shift', (entry) => current.visit.shifts.add(entry as unknown as LayoutShiftEntry)),
    observe('event', (entry) => current.visit.interactions.add(entry), { durationThreshold: INP_DURATION_THRESHOLD_MS }),
    observe('first-input', (entry) => current.visit.interactions.add(entry)),
    observe('longtask', (entry) => record({ kind: 'LONG_TASK', name: current.visit.screen, value: entry.duration })),
  ];
  return observers.filter((observer): observer is PerformanceObserver => observer !== null);
}

const INPUTS = ['keydown', 'pointerdown'] as const;

/**
 * Escucha lo que termina la carga y las visitas, y lo que envía lo medido. Devuelve con qué dejar de escuchar.
 * - Primera tecla o toque: la carga terminó (LCP ya no cambia).
 * - Oculta: termina la carga y la visita, y se envía lo medido; visible otra vez: empieza otra visita.
 * - Se cierra la página (`pagehide`): lo último se envía con `keepalive`.
 */
function listen(current: Session): () => void {
  const onInput = () => finishLoad(current);
  const leave = () => {
    finishLoad(current);
    closeVisit(current);
    flush();
  };
  const onVisibility = () => {
    if (!visible()) {
      current.hiddenAt = Math.min(current.hiddenAt, performance.now());
      leave();
    } else if (!current.visit.open) {
      current.visit = newVisit(current.visit.pathname);
    }
  };
  const timer = window.setInterval(flush, config.perf.flushMs);
  INPUTS.forEach((type) => window.addEventListener(type, onInput, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', leave);
  onApiTiming(recordApi);
  return () => {
    window.clearInterval(timer);
    INPUTS.forEach((type) => window.removeEventListener(type, onInput, true));
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', leave);
    onApiTiming(null);
  };
}

function stop(current: Session): void {
  if (session !== current) return;
  session = null;
  current.observers.forEach((observer) => observer.disconnect());
  current.unlisten();
  flush();
}

/**
 * Empieza a medir (una vez; si ya mide, no hace nada). Devuelve con qué detenerlo: desconecta los observadores
 * y envía lo pendiente, sin cerrar la visita (un desmontaje de React no es salir de la pantalla).
 */
export function startWebPerformance(): () => void {
  sampled ??= Math.random() < config.perf.sampleRate;
  if (session || !config.perf.enabled || !sampled) return () => undefined;
  const visit = newVisit(window.location.pathname);
  // Los observadores y lo que se escucha se agregan enseguida: los dos necesitan la sesión ya armada.
  const current = { initialScreen: visit.screen, hiddenAt: visible() ? Infinity : 0, lcp: null, visit, measuresShifts: supports('layout-shift') } as Session;
  session = current;
  current.observers = startObservers(current);
  current.unlisten = listen(current);
  return () => stop(current);
}

/**
 * Cambió la pantalla (navegación dentro de la app). Antes de la primera interacción es una redirección de la carga
 * (`/` → `/login`, la sesión que se restaura): la visita sigue, ahora con la pantalla de destino. Después, la
 * visita anterior se cierra con su CLS e INP y empieza otra. Cambiar solo la query (`?tab=`) no es otra pantalla.
 */
export function trackPerfScreen(pathname: string): void {
  if (!session || pathname === session.visit.pathname) return;
  if (!measuredOnce.has('LCP')) {
    session.visit.pathname = pathname;
    session.visit.screen = routeTemplate(pathname);
    return;
  }
  closeVisit(session);
  session.visit = newVisit(pathname);
}

/** Olvida todo (para las pruebas): detiene los observadores, el muestreo y lo medido una vez. */
export function resetWebPerformance(): void {
  clearSamples();
  if (session) stop(session);
  sampled = null;
  measuredOnce.clear();
}
