import { afterEach, describe, expect, it, vi } from 'vitest';
import { observe, ShiftWindows, supports, WorstInteraction } from './vitals';

describe('CLS por ventanas de sesión', () => {
  it('junta los cambios cercanos (menos de 1 s entre ellos, ventana de hasta 5 s) y vale la ventana mayor', () => {
    const cls = new ShiftWindows();
    expect(cls.value).toBe(0);
    cls.add({ value: 0.05, startTime: 100, hadRecentInput: false });
    cls.add({ value: 0.04, startTime: 900, hadRecentInput: false }); // misma ventana: 0.09
    cls.add({ value: 0.5, startTime: 1000, hadRecentInput: true }); // tras una acción de la persona: no cuenta
    cls.add({ value: 0.02, startTime: 2500, hadRecentInput: false }); // hueco de más de 1 s: otra ventana
    expect(cls.value).toBeCloseTo(0.09);
    cls.add({ value: 0.2, startTime: 20_000, hadRecentInput: false });
    expect(cls.value).toBeCloseTo(0.2);
  });

  it('una ventana dura a lo más 5 s aunque los cambios sigan cercanos', () => {
    const cls = new ShiftWindows();
    // Cada 0.9 s durante 6.3 s: sin tope sería 0.08; con él, la primera ventana (0 a 4.5 s) vale 0.06.
    for (let at = 0; at <= 6300; at += 900) cls.add({ value: 0.01, startTime: at, hadRecentInput: false });
    expect(cls.value).toBeCloseTo(0.06);
  });
});

describe('INP: la peor interacción', () => {
  it('solo cuentan los eventos de una interacción (con interactionId); vale el más lento', () => {
    const inp = new WorstInteraction();
    expect(inp.value).toBeNull();
    inp.add({ duration: 900 }); // sin interactionId (p. ej. un evento que no es interacción)
    inp.add({ interactionId: 0, duration: 800 });
    expect(inp.value).toBeNull();
    inp.add({ interactionId: 7, duration: 120 });
    inp.add({ interactionId: 7, duration: 180 });
    inp.add({ interactionId: 8, duration: 90 });
    expect(inp.value).toBe(180);
  });
});

describe('observadores nativos', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin PerformanceObserver, sin la lista de tipos o sin el tipo: no se observa nada', () => {
    vi.stubGlobal('PerformanceObserver', undefined);
    expect(supports('longtask')).toBe(false);
    expect(observe('longtask', () => undefined)).toBeNull();
    vi.stubGlobal('PerformanceObserver', class {});
    expect(supports('longtask')).toBe(false);
    vi.stubGlobal('PerformanceObserver', Object.assign(class {}, { supportedEntryTypes: ['paint'] }));
    expect(supports('longtask')).toBe(false);
    expect(supports('paint')).toBe(true);
  });

  it('observa con las entradas que ya ocurrieron y entrega cada una; si el navegador rechaza las opciones, null', () => {
    const seen: string[] = [];
    let options: unknown;
    class Observer {
      static supportedEntryTypes = ['event', 'paint'];
      constructor(private readonly callback: (list: { getEntries: () => PerformanceEntry[] }) => void) {}
      observe(init: { type: string }) {
        if (init.type === 'event') throw new TypeError('durationThreshold no soportado');
        options = init;
        this.callback({ getEntries: () => [{ name: 'first-paint' }, { name: 'first-contentful-paint' }] as PerformanceEntry[] });
      }
    }
    vi.stubGlobal('PerformanceObserver', Observer);
    expect(observe('paint', (entry) => seen.push(entry.name))).toBeInstanceOf(Observer);
    expect(options).toEqual({ type: 'paint', buffered: true });
    expect(seen).toEqual(['first-paint', 'first-contentful-paint']);
    expect(observe('event', () => undefined, { durationThreshold: 40 })).toBeNull();
  });
});
