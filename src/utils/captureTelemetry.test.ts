import { afterEach, describe, expect, it, vi } from 'vitest';
import { automationTraces, captureTelemetry, frameRhythm, screenTelemetry, trackTelemetry, watchFrames } from './captureTelemetry';
import type { CameraDevice } from './cameraDevices';

/** Una pista de cámara con lo que la prueba quiera que reporte. */
function track(settings: MediaTrackSettings, capabilities?: MediaTrackCapabilities): MediaStreamTrack {
  return {
    getSettings: () => settings,
    ...(capabilities ? { getCapabilities: () => capabilities } : {}),
  } as unknown as MediaStreamTrack;
}

const camera = (rawLabel: string): CameraDevice => ({ deviceId: rawLabel, label: rawLabel, rawLabel, kind: 'unknown' });

/** jsdom no tiene `navigator.webdriver` ni `maxTouchPoints`: la prueba los define (y los quita al terminar). */
function onNavigator(name: 'webdriver' | 'maxTouchPoints', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const name of ['webdriver', 'maxTouchPoints']) Reflect.deleteProperty(navigator, name);
});

describe('telemetría de la toma (antifraude 1b)', () => {
  it('cuenta los rastros de automatización en window, en document y en el navegador', () => {
    const clean = automationTraces({} as Window, {} as Document, 'Mozilla/5.0 Safari');
    expect(clean).toBe(0);
    const robot = automationTraces({ __pwInitScripts: 1, callPhantom: 1 } as unknown as Window, { $cdc_asdjflasutopfhvcZLmcfl_: 1 } as unknown as Document, 'HeadlessChrome/130');
    expect(robot).toBe(4);
  });

  it('lee la pista: lo que reporta y lo que dice poder (sin getCapabilities, solo lo primero)', () => {
    expect(trackTelemetry(null)).toBeNull();
    expect(
      trackTelemetry(track({ width: 1280, height: 720, frameRate: 29.97003, deviceId: 'cam' }, { width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 60 } })),
    ).toEqual({ width: 1280, height: 720, frame_rate: 29.97, width_max: 1920, height_max: 1080, frame_rate_max: 60, device_id: true });
    expect(trackTelemetry(track({}))).toEqual({ width: null, height: null, frame_rate: null, width_max: null, height_max: null, frame_rate_max: null, device_id: false });
  });

  it('resume el ritmo de los cuadros', () => {
    expect(frameRhythm([])).toBeNull();
    expect(frameRhythm([33])).toBeNull();
    expect(frameRhythm([0, 0, 0])).toEqual({ count: 3, mean_ms: 0, cv: 0 });
    const rhythm = frameRhythm([30, 36, 33, 33]);
    expect(rhythm).toEqual({ count: 4, mean_ms: 33, cv: expect.closeTo(0.06428, 4) as number });
  });

  it('describe la pantalla (sin puntos táctiles informados: 0)', () => {
    vi.stubGlobal('devicePixelRatio', 2.5);
    vi.spyOn(window.screen, 'width', 'get').mockReturnValue(390.4);
    vi.spyOn(window.screen, 'height', 'get').mockReturnValue(844);
    onNavigator('maxTouchPoints', 5);
    expect(screenTelemetry()).toEqual({ width: 390, height: 844, pixel_ratio: 2.5, touch_points: 5 });
    onNavigator('maxTouchPoints', undefined);
    expect(screenTelemetry().touch_points).toBe(0);
  });

  it('arma la telemetría: navegador automatizado y una cámara virtual instalada (solo el indicador)', () => {
    onNavigator('webdriver', true);
    const telemetry = captureTelemetry({ track: null, devices: [camera('FaceTime HD Camera'), camera('OBS Virtual Camera')], blocked: ['virtual', 'obs'], intervals: [33, 34] });
    expect(telemetry).toMatchObject({ v: 1, webdriver: true, virtual_camera: true, track: null, frames: { count: 2 } });
    expect(JSON.stringify(telemetry)).not.toContain('FaceTime'); // nunca la lista de cámaras
    expect(captureTelemetry({ track: null, devices: [camera('FaceTime HD Camera')], blocked: ['obs'], intervals: [] })).toMatchObject({ virtual_camera: false, frames: null });
  });

  it('mide el intervalo entre cuadros con requestVideoFrameCallback (los últimos `limit`) y se detiene', () => {
    let pending: ((now: number) => void) | null = null;
    const video = {
      requestVideoFrameCallback: vi.fn((callback: (now: number) => void) => {
        pending = callback;
        return 7;
      }),
      cancelVideoFrameCallback: vi.fn(),
    } as unknown as HTMLVideoElement;
    const watcher = watchFrames(video, 2);
    for (const now of [100, 133, 167, 200]) pending!(now);
    expect(watcher.intervals()).toEqual([34, 33]);
    watcher.stop();
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(7);
    // Un navegador sin la API: nada que medir.
    const plain = watchFrames({} as HTMLVideoElement, 5);
    expect(plain.intervals()).toEqual([]);
    plain.stop();
  });
});
