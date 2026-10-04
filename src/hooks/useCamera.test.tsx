import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CameraNotReadyError } from '../utils/cameraDiagnostics';
import { useCamera, type CameraController, type UseCameraOptions } from './useCamera';

/** Almacén del dispositivo (IndexedDB en el navegador) simulado en memoria: la cámara elegida. */
const savedCameras = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../utils/deviceStore', () => ({
  deviceStore: {
    get: (key: string) => Promise.resolve(savedCameras.get(key)),
    set: (key: string, value: unknown) => {
      savedCameras.set(key, value);
      return Promise.resolve();
    },
  },
}));
beforeEach(() => savedCameras.clear());

/*
 * Cámara simulada: getUserMedia, enumerateDevices y el evento devicechange como los da el navegador.
 * Cada pista registra si se detuvo (la cámara se suelta) y el sistema la puede silenciar o terminar.
 */
class FakeTrack extends EventTarget {
  readonly kind = 'video';
  stop = vi.fn();
  constructor(
    readonly label: string,
    private readonly settings: MediaTrackSettings,
  ) {
    super();
  }
  getSettings() {
    return this.settings;
  }
}

const FACETIME = { label: 'FaceTime HD Camera', settings: { deviceId: 'cam-1', facingMode: 'user' } };
const FRONT = { label: 'Front Camera', settings: { deviceId: 'cam-front', facingMode: 'user' } };
const BACK = { label: 'Back Camera', settings: { deviceId: 'cam-back', facingMode: 'environment' } };

type Spec = { label: string; settings: MediaTrackSettings };
type Constraints = MediaStreamConstraints & { video: MediaTrackConstraints };

let tracks: FakeTrack[];
let cameras: MediaDeviceInfo[];
let getUserMedia: Mock<(constraints: Constraints) => Promise<MediaStream>>;
let enumerateDevices: Mock<() => Promise<MediaDeviceInfo[]>>;
let mediaDevices: EventTarget & { getUserMedia?: typeof getUserMedia; enumerateDevices?: typeof enumerateDevices };

function streamOf(track: FakeTrack | null): MediaStream {
  const list = track ? [track] : [];
  return { getVideoTracks: () => list, getTracks: () => list } as unknown as MediaStream;
}

/** Abre una pista nueva con esa cámara (la registra para poder silenciarla o terminarla). */
function opened(spec: Spec = FACETIME): Promise<MediaStream> {
  const track = new FakeTrack(spec.label, spec.settings);
  tracks.push(track);
  return Promise.resolve(streamOf(track));
}

const device = (deviceId: string, label: string) => ({ kind: 'videoinput', deviceId, label, groupId: 'g' }) as MediaDeviceInfo;
/** En los navegadores DOMException hereda de Error (en jsdom no): así llegan los errores de getUserMedia. */
const mediaError = (name: string) => Object.assign(new Error(name), { name });

/** Promesa que la prueba resuelve o rechaza cuando quiere (el aviso de permiso sigue abierto). */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** jsdom no tiene navigator.mediaDevices: se instala el simulado (o ninguno: navegador sin cámara). */
function installNavigator(media: object | undefined) {
  Object.defineProperty(navigator, 'mediaDevices', { value: media, configurable: true });
}

const constraintsOf = (call: number) => getUserMedia.mock.calls[call][0].video;

beforeEach(() => {
  tracks = [];
  cameras = [device('cam-1', 'FaceTime HD Camera')];
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  getUserMedia = vi.fn<(constraints: Constraints) => Promise<MediaStream>>(() => opened());
  enumerateDevices = vi.fn(() => Promise.resolve(cameras));
  // Sin addEventListener (navegadores sin devicechange); las pruebas de conexión usan un EventTarget.
  mediaDevices = { getUserMedia, enumerateDevices } as unknown as typeof mediaDevices;
  installNavigator(mediaDevices);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(window, 'isSecureContext');
});

async function openCamera(options: UseCameraOptions = { facing: 'user' }) {
  const view = renderHook(() => useCamera(options));
  await waitFor(() => expect(view.result.current.status).toBe('active'));
  return view;
}

/** Visor real: el video recibe la cámara como en CameraCapture. */
let viewer: CameraController;
function Viewer(options: UseCameraOptions) {
  viewer = useCamera(options);
  return <video ref={viewer.videoRef} aria-label="Visor" />;
}
async function openViewer(options: UseCameraOptions = { facing: 'user' }) {
  const view = render(<Viewer {...options} />);
  await waitFor(() => expect(viewer.status).toBe('active'));
  return { ...view, video: screen.getByLabelText<HTMLVideoElement>('Visor') };
}

const emit = (track: FakeTrack, type: string) => act(() => void track.dispatchEvent(new Event(type)));

describe('useCamera: abrir la cámara', () => {
  it('abre la del propósito, la muestra en el visor (sin pantalla completa en iOS) y la recuerda con su lado', async () => {
    const { video } = await openViewer();
    expect(constraintsOf(0)).toEqual({ width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'user' } });
    expect(getUserMedia.mock.calls[0][0].audio).toBe(false);
    expect((video as unknown as { srcObject: MediaStream }).srcObject.getVideoTracks()[0]).toBe(tracks[0]);
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('playsinline', 'true');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(viewer).toMatchObject({ activeDeviceId: 'cam-1', activeLabel: 'Cámara frontal', trackLabel: 'FaceTime HD Camera', isMirrored: true, error: null, problem: null });
    expect(viewer.devices).toEqual([{ deviceId: 'cam-1', label: 'Cámara frontal', rawLabel: 'FaceTime HD Camera', kind: 'front' }]);
    expect(savedCameras.get('tc.camera.user')).toEqual({ deviceId: 'cam-1', kind: 'front' });
  });

  it('si el navegador bloquea la reproducción automática, la cámara igual queda activa', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(mediaError('NotAllowedError'));
    const { video } = await openViewer();
    expect(viewer.status).toBe('active');
    expect((video as unknown as { srcObject: MediaStream | null }).srcObject).not.toBeNull();
  });

  it('reabre la cámara recordada si sirve para el propósito (aunque el navegador no informe su id)', async () => {
    savedCameras.set('tc.camera.user', { deviceId: 'cam-9', kind: 'front' });
    getUserMedia.mockImplementation(() => opened({ label: 'Integrated Webcam', settings: {} }));
    const { result } = await openCamera();
    expect(constraintsOf(0).deviceId).toEqual({ exact: 'cam-9' });
    expect(result.current.activeDeviceId).toBe('cam-9');
  });

  it('la cámara recordada ya no existe: abre la del propósito', async () => {
    savedCameras.set('tc.camera.environment', { deviceId: 'old-cam', kind: 'back' });
    getUserMedia.mockRejectedValueOnce(mediaError('OverconstrainedError')).mockImplementation(() => opened(BACK));
    const { result } = await openCamera({ facing: 'environment' });
    expect(constraintsOf(0).deviceId).toEqual({ exact: 'old-cam' });
    expect(constraintsOf(1).facingMode).toEqual({ ideal: 'environment' });
    expect(result.current).toMatchObject({ activeDeviceId: 'cam-back', activeLabel: 'Cámara trasera', isMirrored: false });
  });

  it('sin inicio automático la cámara espera a que se pida (el navegador muestra su aviso entonces)', async () => {
    const { result } = renderHook(() => useCamera({ facing: 'user', autoStart: false }));
    expect(result.current.status).toBe('idle');
    expect(getUserMedia).not.toHaveBeenCalled();
    act(() => result.current.requestAccess());
    expect(result.current.status).toBe('requesting');
    await waitFor(() => expect(result.current.status).toBe('active'));
  });

  it('un stream sin pista de video (controlador defectuoso) no rompe el visor ni se recuerda', async () => {
    getUserMedia.mockResolvedValue(streamOf(null));
    const { result } = await openCamera();
    expect(result.current).toMatchObject({ activeDeviceId: null, activeLabel: 'Cámara', trackLabel: '' });
    expect(savedCameras.has('tc.camera.user')).toBe(false);
  });
});

describe('useCamera: fallas al abrir', () => {
  it('permiso denegado (NotAllowedError): error con los pasos para permitirla', async () => {
    getUserMedia.mockRejectedValue(mediaError('NotAllowedError'));
    const { result } = renderHook(() => useCamera({ facing: 'user' }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.problem?.kind).toBe('denied');
    expect(result.current.problem?.steps.length).toBeGreaterThan(1);
    expect(result.current.error).toBe(result.current.problem?.message);
  });

  it.each([
    ['NotFoundError', 'not-found'],
    ['NotReadableError', 'busy'],
  ])('%s: la causa queda identificada (%s)', async (name, kind) => {
    getUserMedia.mockRejectedValue(mediaError(name));
    const { result } = renderHook(() => useCamera({ facing: 'user' }));
    await waitFor(() => expect(result.current.problem?.kind).toBe(kind));
    expect(getUserMedia).toHaveBeenCalledOnce(); // sin cámara pedida no hay a cuál volver
  });

  it('página sin HTTPS: no se pide la cámara y se explica cómo entrar seguro', () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    const { result } = renderHook(() => useCamera({ facing: 'user' }));
    expect(result.current).toMatchObject({ status: 'error', problem: expect.objectContaining({ kind: 'insecure' }) });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('navegador sin getUserMedia: se explica que no es compatible', () => {
    installNavigator(undefined);
    const { result } = renderHook(() => useCamera({ facing: 'user' }));
    expect(result.current.problem?.kind).toBe('unsupported');
  });

  it('un rechazo que no es Error (navegadores antiguos) no se toma como cámara faltante', async () => {
    savedCameras.set('tc.camera.user', { deviceId: 'cam-9', kind: 'front' });
    getUserMedia.mockRejectedValue({ name: 'NotFoundError' });
    const { result } = renderHook(() => useCamera({ facing: 'user' }));
    await waitFor(() => expect(result.current.problem?.kind).toBe('unknown'));
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('detenida mientras el navegador decide: su respuesta ya no cambia nada y la cámara se suelta', async () => {
    const pending = deferred<MediaStream>();
    getUserMedia.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useCamera({ facing: 'user' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled()); // el navegador ya está decidiendo
    act(() => result.current.stop());
    const track = new FakeTrack('FaceTime HD Camera', FACETIME.settings);
    await act(() => Promise.resolve().then(() => pending.resolve(streamOf(track))));
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('detenida mientras se lee la cámara elegida del dispositivo: ni siquiera se pide la cámara', async () => {
    const { result } = renderHook(() => useCamera({ facing: 'user' }));
    act(() => result.current.stop());
    await act(() => Promise.resolve());
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('detenida mientras el navegador decide: un rechazo tardío no muestra error ni reintenta', async () => {
    savedCameras.set('tc.camera.user', { deviceId: 'cam-9', kind: 'front' });
    const missing = deferred<MediaStream>();
    getUserMedia.mockReturnValueOnce(missing.promise);
    const first = renderHook(() => useCamera({ facing: 'user' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    act(() => first.result.current.stop());
    await act(() => Promise.resolve().then(() => missing.reject(mediaError('OverconstrainedError'))));
    expect(first.result.current.status).toBe('idle');
    expect(getUserMedia).toHaveBeenCalledOnce();

    const denied = deferred<MediaStream>();
    getUserMedia.mockReturnValueOnce(denied.promise);
    const second = renderHook(() => useCamera({ facing: 'user' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    act(() => second.result.current.stop());
    await act(() => Promise.resolve().then(() => denied.reject(mediaError('NotAllowedError'))));
    expect(second.result.current).toMatchObject({ status: 'idle', problem: null });
  });

  it('al salir de la pantalla mientras se abre, la cámara que llega después se apaga', async () => {
    const pending = deferred<MediaStream>();
    getUserMedia.mockReturnValueOnce(pending.promise);
    const { unmount } = renderHook(() => useCamera({ facing: 'user' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    unmount();
    const track = new FakeTrack('FaceTime HD Camera', FACETIME.settings);
    await act(() => Promise.resolve().then(() => pending.resolve(streamOf(track))));
    expect(track.stop).toHaveBeenCalled();
  });
});

describe('useCamera: cambiar y elegir cámara', () => {
  /** Teléfono: frontal y trasera; el sistema abre la del lado pedido. */
  function phone() {
    cameras = [device('cam-front', 'Front Camera'), device('cam-back', 'Back Camera')];
    getUserMedia.mockImplementation(({ video }) => opened((video.facingMode as { exact?: string }).exact === 'environment' ? BACK : FRONT));
  }

  it('teléfono: alterna entre frontal y trasera (lente principal de cada lado) y suelta la anterior', async () => {
    phone();
    const { result } = await openCamera();
    expect(result.current.devices.map((d) => d.label)).toEqual(['Cámara frontal', 'Cámara trasera']);
    act(() => result.current.switchCamera());
    await waitFor(() => expect(result.current.activeLabel).toBe('Cámara trasera'));
    expect(constraintsOf(1).facingMode).toEqual({ exact: 'environment' });
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(result.current.isMirrored).toBe(false);
    act(() => result.current.switchCamera());
    await waitFor(() => expect(result.current.activeLabel).toBe('Cámara frontal'));
    expect(constraintsOf(2).facingMode).toEqual({ exact: 'user' });
  });

  it('el lado pedido no existe: vuelve a abrir la del propósito', async () => {
    phone();
    const { result } = await openCamera();
    getUserMedia.mockRejectedValueOnce(mediaError('NotFoundError'));
    act(() => result.current.switchCamera());
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(3));
    expect(constraintsOf(2).facingMode).toEqual({ ideal: 'user' });
    await waitFor(() => expect(result.current.status).toBe('active'));
  });

  it('computadora con varias webcams: pasa a la siguiente o a la elegida en la lista', async () => {
    cameras = [device('cam-a', 'USB Camera'), device('cam-b', 'Logitech BRIO')];
    getUserMedia.mockImplementation(({ video }) => {
      const id = (video.deviceId as { exact?: string } | undefined)?.exact ?? 'cam-a';
      return opened({ label: id === 'cam-a' ? 'USB Camera' : 'Logitech BRIO', settings: { deviceId: id } });
    });
    const { result } = await openCamera();
    expect(result.current).toMatchObject({ activeLabel: 'Cámara', isMirrored: false }); // con dos webcams no se sabe cuál mira al usuario
    act(() => result.current.switchCamera());
    await waitFor(() => expect(result.current.activeDeviceId).toBe('cam-b'));
    expect(constraintsOf(1).deviceId).toEqual({ exact: 'cam-b' });
    act(() => result.current.selectCamera('cam-a'));
    await waitFor(() => expect(result.current.activeDeviceId).toBe('cam-a'));
    expect(constraintsOf(2).deviceId).toEqual({ exact: 'cam-a' });
  });

  it('con una sola cámara, cambiar no hace nada', async () => {
    const { result } = await openCamera();
    act(() => result.current.switchCamera());
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('active');
  });

  it('cámaras conectadas o desconectadas actualizan la lista; si la consulta falla se conserva', async () => {
    const md = Object.assign(new EventTarget(), { getUserMedia, enumerateDevices });
    installNavigator(md);
    const { result, unmount } = await openCamera();
    cameras = [...cameras, device('cam-usb', 'USB Camera')];
    await act(() => Promise.resolve().then(() => void md.dispatchEvent(new Event('devicechange'))));
    expect(result.current.devices).toHaveLength(2);

    enumerateDevices.mockRejectedValueOnce(new Error('sin permiso'));
    await act(() => Promise.resolve().then(() => void md.dispatchEvent(new Event('devicechange'))));
    expect(result.current.devices).toHaveLength(2);
    expect(result.current.status).toBe('active');

    unmount();
    const calls = enumerateDevices.mock.calls.length;
    md.dispatchEvent(new Event('devicechange'));
    expect(enumerateDevices).toHaveBeenCalledTimes(calls); // ya no escucha
  });

  it('sin enumerateDevices (navegadores antiguos) abre igual, sin lista de cámaras', async () => {
    installNavigator({ getUserMedia });
    const { result } = await openCamera();
    expect(result.current.devices).toEqual([]);
  });

  it('si la lista de cámaras falla al abrir, la cámara queda activa', async () => {
    enumerateDevices.mockRejectedValueOnce(new Error('falló'));
    const { result } = await openCamera();
    expect(result.current.devices).toEqual([]);
  });

  it('detenida mientras se consulta la lista: no vuelve a activarse sola', async () => {
    const list = deferred<MediaDeviceInfo[]>();
    enumerateDevices.mockReturnValueOnce(list.promise);
    const { result } = renderHook(() => useCamera({ facing: 'user' }));
    await waitFor(() => expect(enumerateDevices).toHaveBeenCalled());
    act(() => result.current.stop());
    await act(() => Promise.resolve().then(() => list.resolve(cameras)));
    expect(result.current.status).toBe('idle');
  });
});

describe('useCamera: la cámara se corta sin aviso', () => {
  it('termina (llamada, permiso retirado): se libera y queda en pausa con "Activar cámara"; se puede reabrir', async () => {
    const { result } = await openCamera();
    emit(tracks[0], 'ended');
    expect(result.current.status).toBe('idle');
    expect(tracks[0].stop).toHaveBeenCalled(); // la cámara se suelta
    await act(() => result.current.start());
    expect(result.current.status).toBe('active');
    expect(tracks).toHaveLength(2);
    // Los avisos tardíos de la pista anterior ya no afectan a la nueva.
    emit(tracks[0], 'mute');
    emit(tracks[0], 'ended');
    expect(result.current.status).toBe('active');
    expect(tracks[1].stop).not.toHaveBeenCalled();
  });

  it('se silencia (Siri, el sistema la toma un momento): en pausa hasta que vuelve la imagen', async () => {
    const { result } = await openCamera();
    emit(tracks[0], 'mute');
    expect(result.current.status).toBe('idle');
    // Sin imagen, capturar es un error pasajero (el flujo facial espera y reintenta).
    await expect(result.current.captureFrame()).rejects.toBeInstanceOf(CameraNotReadyError);
    emit(tracks[0], 'unmute');
    expect(result.current.status).toBe('active');
    emit(tracks[0], 'unmute'); // sin pausa previa no cambia nada
    expect(result.current.status).toBe('active');
  });

  it('detener suelta la cámara y deja el visor vacío', async () => {
    const { video } = await openViewer();
    act(() => viewer.stop());
    expect(viewer.status).toBe('idle');
    expect(tracks[0].stop).toHaveBeenCalled();
    expect((video as unknown as { srcObject: MediaStream | null }).srcObject).toBeNull();
  });
});

describe('useCamera: pestaña en segundo plano', () => {
  let hidden: boolean;
  beforeEach(() => {
    hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  });
  const setHidden = (value: boolean) =>
    act(() => {
      hidden = value;
      document.dispatchEvent(new Event('visibilitychange'));
    });

  it('al ocultarla suelta la cámara y al volver reabre la misma', async () => {
    const { result } = await openCamera();
    setHidden(true);
    expect(result.current.status).toBe('idle');
    expect(tracks[0].stop).toHaveBeenCalled();
    setHidden(false);
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(constraintsOf(1).deviceId).toEqual({ exact: 'cam-1' });
  });

  it('al volver abre la del propósito si la anterior no tenía id', async () => {
    getUserMedia.mockImplementation(() => opened({ label: 'Cámara', settings: {} }));
    const { result } = await openCamera();
    setHidden(true);
    setHidden(false);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(constraintsOf(1).facingMode).toEqual({ ideal: 'user' });
    await waitFor(() => expect(result.current.status).toBe('active'));
  });

  it('sin cámara abierta, ocultar y volver no abre nada', () => {
    const { result } = renderHook(() => useCamera({ facing: 'user', autoStart: false }));
    setHidden(true);
    setHidden(false);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });
});

describe('useCamera: captura', () => {
  let canvases: HTMLCanvasElement[];
  let draw: Mock;
  let blob: Blob | null;

  beforeEach(() => {
    canvases = [];
    draw = vi.fn();
    blob = new Blob(['jpeg'], { type: 'image/jpeg' });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      canvases.push(this);
      return { drawImage: draw } as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(blob));
  });

  /** El video ya da imagen (readyState y tamaño que informa el navegador). */
  function showImage(video: HTMLVideoElement, { readyState = 4, width = 1920, height = 1080 } = {}) {
    Object.defineProperty(video, 'readyState', { value: readyState, configurable: true });
    Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: height, configurable: true });
  }

  it('captura la imagen real (sin espejo) reducida al tamaño máximo, en JPEG', async () => {
    const { video } = await openViewer();
    showImage(video);
    await expect(viewer.captureFrame()).resolves.toBe(blob);
    expect([canvases[0].width, canvases[0].height]).toEqual([1280, 720]);
    expect(draw).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0.92);

    await viewer.captureFrame({ maxSide: 4000, quality: 0.5 }); // no se agranda
    expect([canvases[1].width, canvases[1].height]).toEqual([1920, 1080]);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0.5);
  });

  it('sin contexto 2D o sin imagen resultante, la captura falla con su motivo', async () => {
    const { video } = await openViewer();
    showImage(video);
    blob = null;
    await expect(viewer.captureFrame()).rejects.toThrow('No se pudo capturar la imagen');
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(viewer.captureFrame()).rejects.toThrow('No se pudo procesar la imagen');
  });

  it('sin imagen todavía (abriéndose, sin tamaño) o silenciada: CameraNotReadyError', async () => {
    const { video } = await openViewer();
    showImage(video, { readyState: 1 });
    await expect(viewer.captureFrame()).rejects.toBeInstanceOf(CameraNotReadyError);
    showImage(video, { width: 0 });
    await expect(viewer.captureFrame()).rejects.toBeInstanceOf(CameraNotReadyError);
    showImage(video);
    emit(tracks[0], 'mute');
    await expect(viewer.captureFrame()).rejects.toBeInstanceOf(CameraNotReadyError);
    expect(draw).not.toHaveBeenCalled();
  });
});
