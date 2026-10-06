import { act, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import type * as GoogleMaps from '../../services/maps/googleMaps';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MapsApiError, POINT_ZOOM } from '../../services/maps/googleMaps';
import type { GeoPoint } from '../../utils/address';
import { MapCanvas, type MapView } from './MapCanvas';

// Carga del SDK controlada por cada prueba; el resto del módulo es el real (el SDK real se valida en navegador).
const sdk = vi.hoisted(() => ({ load: vi.fn<() => Promise<void>>(), authListeners: new Set<() => void>() }));
vi.mock('../../services/maps/googleMaps', async (importOriginal) => ({
  ...(await importOriginal<typeof GoogleMaps>()),
  loadGoogleMaps: () => sdk.load(),
  onMapsAuthFailure: (listener: () => void) => {
    sdk.authListeners.add(listener);
    return () => sdk.authListeners.delete(listener);
  },
}));

const PALIZA: GeoPoint = { lat: 29.0729, lng: -110.9559 };
const ZOCALO: GeoPoint = { lat: 19.4326, lng: -99.1332 };
const LOADING = 'Cargando el mapa…';
const FAILED = 'El mapa no está disponible. Escribe el domicilio a mano.';

// --- Mapa y círculo simulados de google.maps ---

class FakeLatLng {
  constructor(private readonly point: GeoPoint) {}
  lat() {
    return this.point.lat;
  }
  lng() {
    return this.point.lng;
  }
  toJSON() {
    return this.point;
  }
}

type MapEvent = { latLng: FakeLatLng | null };
const maps: FakeMap[] = [];
const circles: FakeCircle[] = [];

class FakeMap {
  readonly listeners = new Map<string, (event: MapEvent) => void>();
  center: FakeLatLng | undefined;
  zoom: number | undefined;
  readonly panTo = vi.fn((to: GeoPoint | FakeLatLng) => {
    this.center = to instanceof FakeLatLng ? to : new FakeLatLng(to);
  });
  readonly setZoom = vi.fn((zoom: number) => {
    this.zoom = zoom;
  });
  constructor(
    readonly element: HTMLElement,
    readonly options: { center: GeoPoint; zoom: number },
  ) {
    this.center = new FakeLatLng(options.center);
    this.zoom = options.zoom;
    maps.push(this);
  }
  addListener(name: string, handler: (event: MapEvent) => void) {
    this.listeners.set(name, handler);
  }
  getZoom() {
    return this.zoom;
  }
  getCenter() {
    return this.center;
  }
  /** La persona toca o mueve el mapa. */
  emit(name: 'click' | 'center_changed' | 'dragstart' | 'dragend' | 'idle', event: MapEvent = { latLng: null }) {
    act(() => this.listeners.get(name)?.(event));
  }
}

class FakeCircle {
  readonly setMap = vi.fn();
  readonly setCenter = vi.fn();
  readonly setRadius = vi.fn();
  constructor(readonly options: Record<string, unknown>) {
    circles.push(this);
  }
}

const importLibrary = vi.fn<(name: string) => Promise<unknown>>();

/** Promesa que la prueba cumple o rechaza cuando quiere. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Deja correr todo lo pendiente (promesas encadenadas) sin que haya nada más que esperar. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

function renderMap(point: GeoPoint | null = null, radius: number | null = null) {
  const onPick = vi.fn<(point: GeoPoint) => void>();
  const onFailure = vi.fn<(error: MapsApiError) => void>();
  const onView = vi.fn<(view: MapView) => void>();
  const view = render(<MapCanvas point={point} radius={radius} onPick={onPick} onFailure={onFailure} onView={onView} />);
  const rerender = (next: GeoPoint | null, nextRadius: number | null = radius, handlers = { onPick, onFailure, onView }) =>
    view.rerender(<MapCanvas point={next} radius={nextRadius} {...handlers} />);
  return { ...view, onPick, onFailure, onView, rerender };
}

/** Espera a que el mapa quede dibujado y lo devuelve. */
async function readyMap() {
  // Listo = sin "Cargando" Y con el efecto del círculo ya aplicado (corre después del render; con la
  // máquina ocupada puede llegar un instante tarde).
  await waitFor(() => {
    expect(screen.queryByText(LOADING)).toBeNull();
    expect(circles[0]?.setMap).toHaveBeenCalled();
  });
  expect(maps).toHaveLength(1);
  return { map: maps[0], circle: circles[0] };
}

const pin = (container: HTMLElement) => container.querySelector('.map-canvas__pin');
const marker = (container: HTMLElement) => container.querySelector('.map-canvas__marker');

beforeEach(() => {
  maps.length = 0;
  circles.length = 0;
  sdk.authListeners.clear();
  sdk.load.mockReset().mockResolvedValue(undefined);
  importLibrary.mockReset().mockResolvedValue({ Map: FakeMap, Circle: FakeCircle });
  vi.stubGlobal('google', { maps: { importLibrary } });
});
afterEach(() => vi.unstubAllGlobals());

describe('MapCanvas: carga', () => {
  it('mientras Google responde muestra "Cargando el mapa…" sobre el área del mapa', () => {
    sdk.load.mockReturnValue(new Promise<void>(() => undefined));
    const { container } = renderMap(PALIZA, 100);
    expect(screen.getByText(LOADING)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    expect(screen.getByRole('application', { name: 'Mapa: toca para marcar el punto' })).toBeInTheDocument();
    expect(pin(container)).toBeNull(); // el pin aparece hasta que hay mapa
    expect(screen.queryByText(FAILED)).toBeNull();
    expect(importLibrary).not.toHaveBeenCalled();
  });

  it('sin punto: México de lejos, sin pin ni círculo (el círculo se crea apagado)', async () => {
    const { container } = renderMap();
    const { map, circle } = await readyMap();
    expect(importLibrary).toHaveBeenCalledWith('maps');
    expect(map.element).toBe(screen.getByRole('application'));
    expect(map.options).toEqual({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      gestureHandling: 'cooperative',
    });
    // Radio con el azul de la marca (sin el token en la hoja de estilos): relleno tenue y borde fino.
    expect(circle.options).toEqual({ map: null, clickable: false, strokeColor: '#2563eb', strokeOpacity: 0.6, strokeWeight: 1.5, fillColor: '#2563eb', fillOpacity: 0.08 });
    expect(circle.setMap).toHaveBeenLastCalledWith(null);
    expect(circle.setRadius).not.toHaveBeenCalled();
    expect(pin(container)).toBeNull();
    expect(container.firstElementChild).not.toHaveClass('has-point');
  });

  it('con punto: arranca centrado y cerca, con el pin y el círculo del radio permitido', async () => {
    const { container } = renderMap(PALIZA, 200);
    const { map, circle } = await readyMap();
    expect(map.options).toMatchObject({ center: PALIZA, zoom: POINT_ZOOM });
    expect(pin(container)).toBe(screen.getByRole('img', { name: 'Punto marcado' })); // pin de la marca, accesible
    expect(marker(container)?.querySelector('.map-canvas__halo')).toBeInTheDocument();
    expect(marker(container)).not.toHaveClass('is-lifted');
    expect(container.firstElementChild).toHaveClass('map-canvas', 'has-point');
    await waitFor(() => expect(circle.setMap).toHaveBeenLastCalledWith(map));
    expect(circle.setCenter).toHaveBeenLastCalledWith(PALIZA);
    expect(circle.setRadius).toHaveBeenLastCalledWith(200);
    expect(map.panTo).not.toHaveBeenCalled(); // ya está centrado en el punto
  });

  it('el círculo toma el color de la marca del token --map-accent (Google no lee variables CSS)', async () => {
    const wrapper = document.createElement('div');
    wrapper.style.setProperty('--map-accent', ' #0f8a5f ');
    document.body.appendChild(wrapper);
    render(<MapCanvas point={PALIZA} radius={100} onPick={vi.fn()} onFailure={vi.fn()} onView={vi.fn()} />, { container: wrapper });
    const { circle } = await readyMap();
    expect(circle.options).toMatchObject({ strokeColor: '#0f8a5f', fillColor: '#0f8a5f' });
    wrapper.remove();
  });

  it('con punto pero sin radio no dibuja el círculo', async () => {
    renderMap(PALIZA, null);
    const { circle } = await readyMap();
    // El círculo se sincroniza en un efecto después de que el mapa queda listo: se espera, no se supone.
    await waitFor(() => expect(circle.setMap).toHaveBeenLastCalledWith(null));
    expect(circle.setCenter).not.toHaveBeenCalled();
    expect(circle.setRadius).not.toHaveBeenCalled();
  });
});

describe('MapCanvas: tocar y arrastrar', () => {
  it('tocar el mapa lleva el punto ahí y, desde lejos, acerca para afinarlo', async () => {
    const { onPick } = renderMap();
    const { map } = await readyMap();
    map.emit('click', { latLng: new FakeLatLng(PALIZA) });
    expect(map.panTo).toHaveBeenLastCalledWith(new FakeLatLng(PALIZA));
    expect(map.setZoom).toHaveBeenCalledExactlyOnceWith(POINT_ZOOM);
    expect(onPick).toHaveBeenLastCalledWith(PALIZA);

    map.emit('click', { latLng: new FakeLatLng(ZOCALO) }); // ya de cerca: no cambia el acercamiento
    expect(map.setZoom).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenLastCalledWith(ZOCALO);

    map.zoom = undefined; // Google aún no conoce el acercamiento: se trata como lejos
    map.emit('click', { latLng: new FakeLatLng(PALIZA) });
    expect(map.setZoom).toHaveBeenCalledTimes(2);

    map.emit('click', { latLng: null }); // toque sin coordenadas (p. ej. sobre un control)
    expect(onPick).toHaveBeenCalledTimes(3);
  });

  it('sin punto marcado, mover o arrastrar el mapa no marca nada', async () => {
    const { onPick } = renderMap();
    const { map, circle } = await readyMap();
    map.emit('center_changed');
    map.emit('dragend');
    expect(circle.setCenter).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('con punto, el círculo sigue al centro y al soltar se fija el nuevo punto', async () => {
    const { onPick } = renderMap(PALIZA, 150);
    const { map, circle } = await readyMap();
    map.center = new FakeLatLng(ZOCALO);
    map.emit('center_changed');
    expect(circle.setCenter).toHaveBeenLastCalledWith(map.center);
    map.emit('dragend');
    expect(onPick).toHaveBeenCalledExactlyOnceWith(ZOCALO);

    map.center = undefined; // sin centro todavía: el círculo se quita del centro y no se fija nada
    map.emit('center_changed');
    expect(circle.setCenter).toHaveBeenLastCalledWith(null);
    map.emit('dragend');
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('los manejadores del mapa usan siempre las funciones más recientes', async () => {
    const { onPick, onFailure, onView, rerender } = renderMap();
    const { map } = await readyMap();
    const latestPick = vi.fn<(point: GeoPoint) => void>();
    const latestView = vi.fn<(view: MapView) => void>();
    rerender(null, null, { onPick: latestPick, onFailure, onView: latestView });
    map.emit('click', { latLng: new FakeLatLng(PALIZA) });
    expect(latestPick).toHaveBeenCalledExactlyOnceWith(PALIZA);
    expect(onPick).not.toHaveBeenCalled();
    map.emit('idle');
    expect(latestView).toHaveBeenCalledTimes(1);
    expect(onView).not.toHaveBeenCalled();
  });

  it('mientras se arrastra el mapa el pin se levanta y al soltar se asienta', async () => {
    const { container, onPick } = renderMap(PALIZA, 100);
    const { map } = await readyMap();
    map.emit('dragstart');
    expect(marker(container)).toHaveClass('is-lifted');
    map.center = new FakeLatLng(ZOCALO);
    map.emit('dragend');
    expect(marker(container)).not.toHaveClass('is-lifted');
    expect(onPick).toHaveBeenCalledExactlyOnceWith(ZOCALO);
  });

  it('al quedar quieto avisa lo que se ve (centro y acercamiento) para buscar lugares cercanos', async () => {
    const { onView } = renderMap();
    const { map } = await readyMap();
    map.emit('idle');
    expect(onView).toHaveBeenLastCalledWith({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    map.center = new FakeLatLng(PALIZA);
    map.zoom = 13;
    map.emit('idle');
    expect(onView).toHaveBeenLastCalledWith({ center: PALIZA, zoom: 13 });
    map.zoom = undefined; // Google aún no conoce el acercamiento: el de todo el país
    map.emit('idle');
    expect(onView).toHaveBeenLastCalledWith({ center: PALIZA, zoom: DEFAULT_ZOOM });
    map.center = undefined; // sin centro todavía: nada que avisar
    map.emit('idle');
    expect(onView).toHaveBeenCalledTimes(3);
  });
});

describe('MapCanvas: punto desde fuera (búsqueda, "Mi ubicación", dirección escrita)', () => {
  it('el mapa va hacia el punto nuevo y acerca solo si está lejos', async () => {
    const { container, rerender } = renderMap();
    const { map, circle } = await readyMap();

    rerender(PALIZA, 300);
    expect(map.panTo).toHaveBeenLastCalledWith(PALIZA);
    expect(map.setZoom).toHaveBeenCalledExactlyOnceWith(POINT_ZOOM);
    expect(pin(container)).toBeInTheDocument();
    expect(circle.setMap).toHaveBeenLastCalledWith(map);
    expect(circle.setRadius).toHaveBeenLastCalledWith(300);

    const sameLat = { lat: PALIZA.lat, lng: -110.9 }; // solo cambia la longitud: también se mueve
    rerender(sameLat);
    expect(map.panTo).toHaveBeenLastCalledWith(sameLat);
    expect(map.setZoom).toHaveBeenCalledTimes(1); // ya estaba cerca

    rerender({ ...sameLat }); // el mismo lugar (otro objeto): no se mueve
    expect(map.panTo).toHaveBeenCalledTimes(2);

    map.center = undefined;
    map.zoom = undefined;
    rerender(ZOCALO);
    expect(map.panTo).toHaveBeenLastCalledWith(ZOCALO);
    expect(map.setZoom).toHaveBeenCalledTimes(2);

    rerender(null); // quitar el punto: el mapa se queda donde está
    expect(map.panTo).toHaveBeenCalledTimes(3);
    expect(pin(container)).toBeNull();
    expect(circle.setMap).toHaveBeenLastCalledWith(null);
  });
});

describe('MapCanvas: fallas', () => {
  it('si Google rechaza la carga lo explica y avisa con el mismo problema', async () => {
    const problem = new MapsApiError('maps', 'denied', 'RefererNotAllowedMapError');
    sdk.load.mockRejectedValue(problem);
    const { container, onFailure } = renderMap(PALIZA, 100);
    expect(await screen.findByText(FAILED)).toBeInTheDocument();
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(problem);
    expect(screen.queryByText(LOADING)).toBeNull();
    expect(pin(container)).toBeNull();
    expect(maps).toHaveLength(0);
  });

  it('cualquier otra falla al cargar el mapa se informa como falla de Google Maps', async () => {
    importLibrary.mockRejectedValue(new Error('ChunkLoadError'));
    const { onFailure } = renderMap();
    expect(await screen.findByText(FAILED)).toBeInTheDocument();
    const [[error]] = onFailure.mock.calls;
    expect(error).toBeInstanceOf(MapsApiError);
    expect(error).toMatchObject({ api: 'maps', problem: 'failed' });
  });

  it('si Google rechaza la clave con el mapa ya dibujado (gm_authFailure) lo explica', async () => {
    const { container, onFailure } = renderMap(PALIZA, 100);
    await readyMap();
    expect(pin(container)).toBeInTheDocument();
    act(() => sdk.authListeners.forEach((listener) => listener()));
    expect(screen.getByText(FAILED)).toBeInTheDocument();
    expect(pin(container)).toBeNull();
    const [[error]] = onFailure.mock.calls;
    expect(error).toMatchObject({ api: 'maps', problem: 'denied', message: 'maps: denied (gm_authFailure)' });
  });
});

describe('MapCanvas: salir antes de que cargue', () => {
  it('si el SDK termina después de salir no dibuja el mapa ni avisa', async () => {
    const load = deferred<void>();
    sdk.load.mockReturnValue(load.promise);
    const { unmount, onFailure } = renderMap(PALIZA, 100);
    expect(sdk.authListeners.size).toBe(1);
    unmount();
    expect(sdk.authListeners.size).toBe(0); // deja de escuchar los rechazos de la clave
    load.resolve();
    await settle();
    expect(importLibrary).toHaveBeenCalled();
    expect(maps).toHaveLength(0);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('si la librería del mapa llega después de salir no dibuja nada', async () => {
    const library = deferred<unknown>();
    importLibrary.mockReturnValue(library.promise);
    const { unmount } = renderMap();
    await waitFor(() => expect(importLibrary).toHaveBeenCalled());
    unmount();
    library.resolve({ Map: FakeMap, Circle: FakeCircle });
    await settle();
    expect(maps).toHaveLength(0);
    expect(circles).toHaveLength(0);
  });

  it('una falla que llega después de salir no se informa', async () => {
    const load = deferred<void>();
    sdk.load.mockReturnValue(load.promise);
    const { unmount, onFailure } = renderMap();
    unmount();
    load.reject(new MapsApiError('maps', 'failed', 'timeout'));
    await settle();
    expect(onFailure).not.toHaveBeenCalled();
  });
});

describe('MapCanvas: contenedor redondeado sin el marco de foco de Google', () => {
  // jsdom no aplica la hoja de estilos: se verifica que sus reglas sigan ahí (un cambio que las quite falla aquí).
  const css = readFileSync(resolve(__dirname, '../../styles/global.css'), 'utf8');
  const rule = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`); // al inicio de una línea: no una regla que lo contiene
    expect(start, `falta la regla ${selector}`).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('}', start));
  };

  it('quita el borde azul cuadrado que Google pone al enfocar el mapa (también con un clic)', () => {
    expect(css).toContain('.map-canvas .gm-style iframe + div,\n.map-canvas .gm-style div[tabindex]:focus {');
    expect(rule('.map-canvas .gm-style div[tabindex]:focus')).toMatch(/border: 0 !important;[\s\S]*outline: 0 !important;/);
  });

  it('el mapa queda recortado por el redondeo y el foco con teclado es un anillo propio con el mismo radio', () => {
    expect(rule('.map-canvas')).toContain('clip-path: inset(0 round var(--map-radius));');
    const ring = rule('.map-canvas::after');
    expect(ring).toContain('border-radius: calc(var(--map-radius) - 1px);');
    expect(ring).toContain('inset 0 0 0 2px var(--map-accent)');
    expect(ring).toContain('pointer-events: none;');
    expect(rule('.map-canvas:has(.gm-style div[tabindex]:focus-visible)::after')).toContain('opacity: 1;');
  });
});

describe('MapCanvas en inglés (en-US)', () => {
  it('mientras carga lo dice en inglés', async () => {
    await setLocale('en-US');
    sdk.load.mockReturnValue(new Promise<void>(() => undefined));
    renderMap();
    expect(screen.getByText('Loading the map…')).toBeInTheDocument();
    expect(screen.getByRole('application', { name: 'Map: tap to mark the point' })).toBeInTheDocument();
  });

  it('cambio en caliente: sus textos pasan a inglés sin volver a cargar ni crear el mapa (Google conserva su idioma)', async () => {
    const { container } = renderMap(PALIZA, 100);
    await readyMap();
    await act(() => setLocale('en-US'));
    expect(pin(container)).toBe(screen.getByRole('img', { name: 'Marked point' }));
    expect(screen.getByRole('application', { name: 'Map: tap to mark the point' })).toBeInTheDocument();
    expect(sdk.load).toHaveBeenCalledOnce();
    expect(maps).toHaveLength(1);
  });
});
