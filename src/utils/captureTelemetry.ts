/**
 * Telemetría de una toma facial (antifraude 1b, `docs/rd/antifraude-identidad.md` §2.5): lo que el navegador dice de
 * sí mismo y de su cámara mientras se escanea, para que el SERVIDOR detecte una inyección (cámara virtual, video,
 * navegador automatizado o un programa que llama a la API). Viaja con las capturas (`telemetry`, JSON) y el backend
 * lo valida estricto: solo números e indicadores, nunca la lista de dispositivos ni datos de la persona. Es una
 * señal que como mucho pide un paso más; nunca niega (quien controla el navegador puede falsearla, y su AUSENCIA
 * también se mide).
 */
import { isVirtualCamera, type CameraDevice } from './cameraDevices';

export interface TrackTelemetry {
  width: number | null;
  height: number | null;
  frame_rate: number | null;
  width_max: number | null;
  height_max: number | null;
  frame_rate_max: number | null;
  /** La pista trae `deviceId` (una cámara real lo tiene con el permiso dado). */
  device_id: boolean;
}

/**
 * Con qué reloj se midió el ritmo: `presentation`, cuándo LLEGÓ cada cuadro (`metadata.presentationTime` de
 * `requestVideoFrameCallback`: Chrome, Safari y Firefox); `render`, el `now` de la llamada, que es el instante de dibujar
 * y va alineado al refresco de la pantalla (una cámara real de 30 cuadros en fase con una pantalla de 60 Hz da
 * intervalos idénticos en él). El servidor solo juzga el ritmo con `presentation` (lo otro no se puede medir).
 */
export type FrameClock = 'presentation' | 'render';

export interface FrameTelemetry {
  count: number;
  mean_ms: number;
  /** Coeficiente de variación del intervalo entre cuadros (desviación / media). */
  cv: number;
  clock: FrameClock;
}

export interface ScreenTelemetry {
  width: number;
  height: number;
  pixel_ratio: number;
  touch_points: number;
}

/** Versión 1 del contrato (`app/schemas/capture.py` del backend). */
export interface CaptureTelemetry {
  v: 1;
  webdriver: boolean;
  automation: number;
  virtual_camera: boolean;
  track: TrackTelemetry | null;
  frames: FrameTelemetry | null;
  screen: ScreenTelemetry | null;
}

/** Rastros que dejan en `window` las herramientas de automatización más comunes (Playwright, Selenium, PhantomJS...). */
const WINDOW_TRACES = [
  '__playwright__binding__',
  '__pwInitScripts',
  '_selenium',
  'callSelenium',
  '_Selenium_IDE_Recorder',
  '__webdriver_evaluate',
  '__selenium_evaluate',
  '__webdriver_script_fn',
  '__driver_evaluate',
  'domAutomation',
  'domAutomationController',
  'callPhantom',
  '_phantom',
  '__nightmare',
];
/** Variables que ChromeDriver inyecta en `document` (`$cdc_…`, `$wdc_…`). */
const DOCUMENT_TRACE = /^\$?(cdc|wdc)_/;
const HEADLESS = /HeadlessChrome/;

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** Cuántos rastros de automatización hay (cada herramienta encontrada suma uno). */
export function automationTraces(win: Window, doc: Document, userAgent: string): number {
  const inWindow = WINDOW_TRACES.filter((name) => name in win).length;
  const inDocument = Object.keys(doc).some((key) => DOCUMENT_TRACE.test(key)) ? 1 : 0;
  return inWindow + inDocument + (HEADLESS.test(userAgent) ? 1 : 0);
}

/** Lo que la pista de la cámara reporta (`getSettings`) y dice poder (`getCapabilities`, si el navegador lo tiene). */
export function trackTelemetry(track: MediaStreamTrack | null): TrackTelemetry | null {
  if (!track) return null;
  const settings = track.getSettings();
  const capabilities: MediaTrackCapabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
  return {
    width: settings.width ?? null,
    height: settings.height ?? null,
    frame_rate: settings.frameRate == null ? null : round(settings.frameRate, 3),
    width_max: capabilities.width?.max ?? null,
    height_max: capabilities.height?.max ?? null,
    frame_rate_max: capabilities.frameRate?.max == null ? null : round(capabilities.frameRate.max, 3),
    device_id: Boolean(settings.deviceId),
  };
}

/** El ritmo de los cuadros: cuántos intervalos, su media, cuánto varían y con qué reloj (con menos de dos, nada que decir). */
export function frameRhythm(intervals: readonly number[], clock: FrameClock): FrameTelemetry | null {
  if (intervals.length < 2) return null;
  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const variance = intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;
  return { count: intervals.length, mean_ms: round(mean, 3), cv: mean > 0 ? round(Math.sqrt(variance) / mean, 5) : 0, clock };
}

/** Pantalla y entrada del dispositivo (px CSS). */
export function screenTelemetry(): ScreenTelemetry {
  return {
    width: Math.round(window.screen.width),
    height: Math.round(window.screen.height),
    pixel_ratio: round(window.devicePixelRatio, 3),
    // Sin pantalla táctil algunos navegadores no la informan.
    touch_points: navigator.maxTouchPoints ?? 0,
  };
}

interface TelemetryInput {
  track: MediaStreamTrack | null;
  /** Las cámaras que ve el navegador (solo se manda si alguna es virtual, nunca la lista). */
  devices: readonly CameraDevice[];
  blocked: readonly string[];
  intervals: readonly number[];
  /** El reloj con que se midieron los intervalos. */
  clock: FrameClock;
}

/** La telemetría de la toma, lista para enviarse. */
export function captureTelemetry({ track, devices, blocked, intervals, clock }: TelemetryInput): CaptureTelemetry {
  return {
    v: 1,
    webdriver: navigator.webdriver === true,
    automation: automationTraces(window, document, navigator.userAgent),
    virtual_camera: devices.some((device) => isVirtualCamera(device.rawLabel, blocked)),
    track: trackTelemetry(track),
    frames: frameRhythm(intervals, clock),
    screen: screenTelemetry(),
  };
}

/** Quien mide el ritmo de los cuadros de un video. */
export interface FrameWatcher {
  intervals: () => number[];
  /** El reloj de los intervalos que lleva. */
  clock: () => FrameClock;
  stop: () => void;
}

/**
 * Mide el intervalo entre cuadros de un `<video>` con `requestVideoFrameCallback` (los últimos `limit`), con el reloj de
 * LLEGADA de cada cuadro (`metadata.presentationTime`) y, si el navegador no lo da, con el del dibujo (`now`), declarado
 * como tal. Si un cuadro cambia de reloj se empieza de nuevo: nunca se mezclan. Sin la API (navegadores antiguos) no
 * mide nada: la telemetría va sin ritmo.
 */
export function watchFrames(video: HTMLVideoElement, limit: number): FrameWatcher {
  const intervals: number[] = [];
  let clock: FrameClock = 'render';
  if (typeof video.requestVideoFrameCallback !== 'function') return { intervals: () => [], clock: () => clock, stop: () => undefined };
  let previous: number | null = null;
  let handle = 0;
  const onFrame = (now: number, metadata?: Partial<VideoFrameCallbackMetadata>) => {
    const presented = typeof metadata?.presentationTime === 'number';
    const frameClock: FrameClock = presented ? 'presentation' : 'render';
    const at = presented ? (metadata.presentationTime as number) : now;
    if (frameClock !== clock) {
      clock = frameClock;
      intervals.length = 0;
      previous = null;
    }
    if (previous !== null) {
      intervals.push(at - previous);
      if (intervals.length > limit) intervals.shift();
    }
    previous = at;
    handle = video.requestVideoFrameCallback(onFrame);
  };
  handle = video.requestVideoFrameCallback(onFrame);
  return {
    intervals: () => [...intervals],
    clock: () => clock,
    stop: () => video.cancelVideoFrameCallback(handle),
  };
}
