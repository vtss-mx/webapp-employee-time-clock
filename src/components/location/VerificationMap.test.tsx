import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as GoogleMaps from '../../services/maps/googleMaps';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MapsApiError, POINT_ZOOM } from '../../services/maps/googleMaps';
import type { GeoPoint } from '../../utils/address';
import { VerificationMap } from './VerificationMap';

// La carga del SDK la controla cada prueba; el resto del módulo es el real (el SDK real se valida en navegador).
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
const FAILED = 'El mapa no está disponible.';

class FakeLatLng {
  constructor(private readonly point: GeoPoint) {}
  lat() {
    return this.point.lat;
  }
  lng() {
    return this.point.lng;
  }
}
const maps: FakeMap[] = [];
class FakeMap {
  center: FakeLatLng;
  zoom: number;
  readonly panTo = vi.fn((to: GeoPoint) => {
    this.center = new FakeLatLng(to);
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
  getZoom() {
    return this.zoom;
  }
  getCenter() {
    return this.center;
  }
}
const importLibrary = vi.fn<(name: string) => Promise<unknown>>();
/** Deja correr las promesas encadenadas de la carga. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

function renderMap(point: GeoPoint | null = null) {
  const onFailure = vi.fn<(error: MapsApiError) => void>();
  const view = render(<VerificationMap point={point} onFailure={onFailure} />);
  return { ...view, onFailure, rerender: (next: GeoPoint | null) => view.rerender(<VerificationMap point={next} onFailure={onFailure} />) };
}
async function readyMap() {
  await waitFor(() => expect(screen.queryByText(LOADING)).toBeNull());
  return maps[0];
}
const pin = (container: HTMLElement) => container.querySelector('.map-canvas__pin');

beforeEach(() => {
  maps.length = 0;
  sdk.authListeners.clear();
  sdk.load.mockReset().mockResolvedValue(undefined);
  importLibrary.mockReset().mockResolvedValue({ Map: FakeMap });
  vi.stubGlobal('google', { maps: { importLibrary } });
});
afterEach(() => vi.unstubAllGlobals());

describe('VerificationMap (mapa de solo lectura de dónde se hizo una verificación)', () => {
  it('mientras Google responde muestra "Cargando el mapa…" y aún no hay pin', () => {
    sdk.load.mockReturnValue(new Promise<void>(() => undefined));
    const { container } = renderMap(PALIZA);
    expect(screen.getByText(LOADING)).toBeInTheDocument();
    expect(screen.getByRole('application', { name: 'Mapa de verificaciones' })).toBeInTheDocument();
    expect(pin(container)).toBeNull();
    expect(importLibrary).not.toHaveBeenCalled();
  });

  it('sin punto elegido: México de lejos y sin pin', async () => {
    const { container } = renderMap(null);
    const map = await readyMap();
    expect(importLibrary).toHaveBeenCalledWith('maps');
    expect(map.options).toMatchObject({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    expect(pin(container)).toBeNull();
    expect(container.firstElementChild).not.toHaveClass('has-point');
  });

  it('con punto: arranca centrado y cerca, con el pin de la marca (sin moverse de más)', async () => {
    const { container } = renderMap(PALIZA);
    const map = await readyMap();
    expect(map.options).toMatchObject({ center: PALIZA, zoom: POINT_ZOOM });
    expect(pin(container)).toBe(screen.getByRole('img', { name: 'Lugar de la verificación' }));
    expect(container.firstElementChild).toHaveClass('map-canvas', 'has-point');
    expect(map.panTo).not.toHaveBeenCalled();
  });

  it('al elegir otra fila el mapa va a su punto y se acerca', async () => {
    const { rerender } = renderMap(PALIZA);
    const map = await readyMap();
    map.zoom = 8; // como si estuviera alejado
    rerender(ZOCALO);
    await settle();
    expect(map.panTo).toHaveBeenLastCalledWith(ZOCALO);
    expect(map.setZoom).toHaveBeenLastCalledWith(POINT_ZOOM);
  });

  it('si ya está igual de cerca, va al nuevo punto pero no cambia el acercamiento', async () => {
    const { rerender } = renderMap(PALIZA); // arranca centrado en POINT_ZOOM
    const map = await readyMap();
    expect(map.zoom).toBe(POINT_ZOOM);
    rerender(ZOCALO);
    await settle();
    expect(map.panTo).toHaveBeenLastCalledWith(ZOCALO);
    expect(map.setZoom).not.toHaveBeenCalled(); // POINT_ZOOM < POINT_ZOOM es falso: no se acerca de más
  });

  it('si el mapa aún no reporta su acercamiento, toma el de partida y se acerca al punto', async () => {
    const { rerender } = renderMap(PALIZA);
    const map = await readyMap();
    vi.spyOn(map, 'getZoom').mockReturnValue(undefined as unknown as number);
    rerender(ZOCALO);
    await settle();
    expect(map.panTo).toHaveBeenLastCalledWith(ZOCALO);
    expect(map.setZoom).toHaveBeenLastCalledWith(POINT_ZOOM); // (undefined ?? 0) = 0 < POINT_ZOOM → se acerca
  });

  it('si se desmonta antes de que Google responda, no construye un mapa que ya no está', async () => {
    let resolveLoad: () => void = () => undefined;
    sdk.load.mockReturnValue(new Promise<void>((resolve) => (resolveLoad = resolve)));
    const { unmount } = renderMap(PALIZA);
    unmount(); // la limpieza marca `cancelled`
    resolveLoad();
    await settle();
    expect(importLibrary).toHaveBeenCalledWith('maps'); // entró al `then`…
    expect(maps).toHaveLength(0); // …pero regresó por `cancelled`: no creó el mapa
  });

  it('si la carga falla después de desmontar, no reporta ni toca estado (ya se fue)', async () => {
    let rejectLoad: (error: unknown) => void = () => undefined;
    sdk.load.mockReturnValue(new Promise<void>((_resolve, reject) => (rejectLoad = reject)));
    const { unmount, onFailure } = renderMap(PALIZA);
    unmount(); // la limpieza marca `cancelled`
    rejectLoad(new MapsApiError('maps', 'denied'));
    await settle();
    expect(onFailure).not.toHaveBeenCalled(); // `cancelled` true → `failed` regresa sin avisar (línea 37)
  });

  it('una clave rechazada muestra el estado de error y lo reporta', async () => {
    sdk.load.mockRejectedValue(new MapsApiError('maps', 'denied'));
    const { onFailure } = renderMap(PALIZA);
    expect(await screen.findByText(FAILED)).toBeInTheDocument();
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ api: 'maps', problem: 'denied' }));
  });

  it('un error cualquiera de la carga se trata como mapa no disponible', async () => {
    sdk.load.mockRejectedValue(new Error('sin red'));
    renderMap(PALIZA);
    expect(await screen.findByText(FAILED)).toBeInTheDocument();
  });

  it('gm_authFailure (clave no habilitada) marca el mapa como no disponible', async () => {
    sdk.load.mockReturnValue(new Promise<void>(() => undefined));
    const { onFailure } = renderMap(PALIZA);
    act(() => sdk.authListeners.forEach((listener) => listener()));
    expect(await screen.findByText(FAILED)).toBeInTheDocument();
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ problem: 'denied' }));
  });
});
