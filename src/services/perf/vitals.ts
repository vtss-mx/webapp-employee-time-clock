/**
 * Reglas puras de las métricas del navegador (Web Vitals) y el acceso al `PerformanceObserver` NATIVO (sin
 * dependencias: la librería `web-vitals` haría lo mismo con más código y su propio envío).
 *
 * Las ventanas y umbrales siguen la definición pública de cada métrica (no son configuración: cambiarlos haría
 * que los números dejaran de compararse con los umbrales de Google que usa el backend).
 */

/** Hueco máximo entre dos cambios de diseño de la misma ventana de CLS y duración máxima de la ventana. */
const CLS_GAP_MS = 1000;
const CLS_WINDOW_MS = 5000;

/**
 * Duración mínima de un evento que se observa para INP: lo que tarda menos de 40 ms nunca es la peor
 * interacción que importa (el umbral "bueno" es 200 ms) y observarlo todo costaría al hilo principal. La
 * primera interacción (`first-input`) se observa aparte aunque sea rápida.
 */
export const INP_DURATION_THRESHOLD_MS = 40;

/** Un cambio de diseño (`layout-shift`) con lo que se usa de él. */
export interface LayoutShiftEntry {
  value: number;
  startTime: number;
  /** El cambio siguió a una acción de la persona (abrir un menú): no cuenta para CLS. */
  hadRecentInput: boolean;
}

/** Un evento de una interacción (`event`, `first-input`); `interactionId` 0 o ausente = no es una interacción. */
export interface InteractionEntry {
  interactionId?: number;
  duration: number;
}

/**
 * CLS de una visita a una pantalla: los cambios de diseño se juntan en ventanas de sesión (cada cambio a menos
 * de 1 s del anterior y la ventana de a lo más 5 s) y vale la ventana con más cambios. Los que siguen a una
 * acción de la persona se ignoran (se esperan).
 */
export class ShiftWindows {
  private current = 0;
  private first = 0;
  private last = 0;
  private worst = 0;

  add(shift: LayoutShiftEntry): void {
    if (shift.hadRecentInput) return;
    const sameWindow = this.current > 0 && shift.startTime - this.last < CLS_GAP_MS && shift.startTime - this.first < CLS_WINDOW_MS;
    if (sameWindow) {
      this.current += shift.value;
    } else {
      this.current = shift.value;
      this.first = shift.startTime;
    }
    this.last = shift.startTime;
    this.worst = Math.max(this.worst, this.current);
  }

  get value(): number {
    return this.worst;
  }
}

/**
 * INP de una visita: la peor interacción. Los eventos de una misma interacción (pointerdown, pointerup, click)
 * comparten `interactionId` y la interacción dura lo que el más lento de ellos; la peor interacción es entonces el
 * evento más lento con `interactionId`. null: no hubo interacciones medidas.
 */
export class WorstInteraction {
  private worst: number | null = null;

  add(entry: InteractionEntry): void {
    if (!entry.interactionId) return;
    this.worst = Math.max(this.worst ?? 0, entry.duration);
  }

  get value(): number | null {
    return this.worst;
  }
}

/** ¿El navegador entrega este tipo de entrada? (Safari y Firefox no tienen todas: sin ella, nada se mide). */
export function supports(type: string): boolean {
  return typeof PerformanceObserver === 'function' && (PerformanceObserver.supportedEntryTypes ?? []).includes(type);
}

/**
 * Observa un tipo de entrada con las que ya ocurrieron (`buffered`). Sin soporte, o si el navegador rechaza las
 * opciones, devuelve null: medir nunca rompe la app.
 */
export function observe(type: string, handle: (entry: PerformanceEntry) => void, options: { durationThreshold?: number } = {}): PerformanceObserver | null {
  if (!supports(type)) return null;
  try {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach(handle));
    observer.observe({ type, buffered: true, ...options });
    return observer;
  } catch {
    // Opciones que este navegador no acepta (p. ej. `durationThreshold` en uno antiguo): esa métrica no se mide.
    return null;
  }
}
