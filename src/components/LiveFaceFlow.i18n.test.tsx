import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/core';
import * as versionService from '../services/versionService';
import { advance, detection, flow, heading, message, renderFlow, resetFaceFlow, see, serve, stable, TWO_TURNS } from '../test/faceFlow';
import { apiOk } from '../test/http';
import { config } from '../utils/config';

/*
 * El flujo facial en inglés y el cambio de idioma EN CALIENTE a medio escaneo (regla 16): con la
 * cámara real (`useCamera` con getUserMedia simulado) y MediaPipe simulado, cambiar el idioma traduce
 * la guía al instante, conserva el paso del reto y no vuelve a abrir la cámara ni recarga la página.
 * Los textos del servidor (la instrucción del reto) llegan ya en su idioma: no se traducen aquí.
 */
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));
vi.mock('../utils/deviceStore', () => ({ deviceStore: { get: () => Promise.resolve(undefined), set: () => Promise.resolve() } }));

/** La pista de la cámara frontal: registra si se detuvo (la cámara se soltó). */
const track = Object.assign(new EventTarget(), {
  kind: 'video',
  label: 'FaceTime HD Camera',
  stop: vi.fn(),
  getSettings: () => ({ deviceId: 'cam-1', facingMode: 'user' }),
});
const stream = { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
const getUserMedia = vi.fn(() => Promise.resolve(stream));
const reload = vi.fn();

beforeEach(() => {
  resetFaceFlow();
  track.stop.mockReset();
  getUserMedia.mockClear();
  reload.mockReset();
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  const enumerateDevices = () => Promise.resolve([{ kind: 'videoinput', deviceId: 'cam-1', label: 'FaceTime HD Camera', groupId: 'g' }]);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia, enumerateDevices }, configurable: true });
  // El video ya da imagen y el lienzo la convierte en JPEG (jsdom no dibuja).
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4);
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
  vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(new Blob(['cuadro'], { type: 'image/jpeg' })));
  vi.spyOn(versionService, 'reloadApp').mockImplementation(() => undefined);
  vi.stubGlobal('location', { ...window.location, reload });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(window, 'isSecureContext');
});

const video = () => document.querySelector('video') as HTMLVideoElement;
/** La barra de etapas: también es el contador para lectores de pantalla («Etapa 2 de 5»). */
const counter = () => document.querySelector('.faceid__progress');

/** Abre la cámara (permiso, video y lista de cámaras) hasta que el visor queda activo. */
async function cameraOn() {
  for (let i = 0; i < 6 && !detection.options?.enabled; i++) await advance(0);
  expect(detection.options?.enabled).toBe(true);
}

/** Del rostro de frente al segundo movimiento del reto (paso 2 de 2), con la cámara real. */
async function toSecondTurn() {
  await cameraOn();
  await stable({ pitch: 0.5, width: 200 }); // frontal → validación previa → reto
  see({ guidance: 'move' });
  await stable(); // primer giro
  await stable(); // de vuelta al frente
}

describe('LiveFaceFlow en inglés (en-US)', () => {
  it('la guía, las etapas, la cámara y los avisos que arma la app se ven en inglés; la instrucción del servidor, tal cual', async () => {
    await setLocale('en-US');
    serve({ challenge: () => apiOk(TWO_TURNS) });
    renderFlow({ title: 'Face verification', submittingMessage: 'Verifying identity...' });
    expect(screen.getByRole('status')).toHaveTextContent('Turning on the camera…');
    await cameraOn();

    expect(heading()).toHaveTextContent('Center your face');
    expect(message()).toHaveTextContent('Hold still');
    expect(counter()).toHaveAttribute('aria-label', 'Stage 2 of 5');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByText('Front camera')).toBeInTheDocument();
    expect(screen.getByLabelText('Camera preview')).toBeInTheDocument();
    see({ guidance: 'too_dark' });
    expect(message()).toHaveTextContent('More light');
    expect(heading()).toHaveTextContent('Look at the camera');
    see({ guidance: 'hold_still' });

    await stable({ pitch: 0.5, width: 200 });
    expect(heading()).toHaveTextContent('Liveness check · step 1 of 2');
    see({ guidance: 'move' });
    expect(message()).toHaveTextContent('Gira la cabeza hacia tu izquierda'); // texto del servidor
    see({ guidance: 'move', moveProgress: 0.6 });
    expect(message()).toHaveTextContent('A little more');

    // Sin completar el movimiento a tiempo: el aviso lo arma la app, en inglés.
    await advance(config.faceChallengeTimeoutMs);
    expect(heading()).toHaveTextContent("Try again");
    expect(message()).toHaveTextContent("The movement wasn't completed in time. Do it slowly until the ring fills.");
  });
});

describe('LiveFaceFlow: cambio de idioma en caliente a medio escaneo', () => {
  it('traduce la guía al instante, conserva el paso del reto y la cámara sigue abierta (sin recargar)', async () => {
    serve({ challenge: () => apiOk(TWO_TURNS) });
    renderFlow();
    await toSecondTurn();
    const viewer = video();
    expect(viewer.srcObject).toBe(stream);
    expect(heading()).toHaveTextContent('Prueba de vida · paso 2 de 2');
    expect(counter()).toHaveAttribute('aria-label', 'Etapa 4 de 5');
    see({ guidance: 'hold_still' });
    expect(message()).toHaveTextContent('Sostén así');
    expect(screen.getByText('Cámara frontal')).toBeInTheDocument();

    await act(() => setLocale('en-US'));

    // Mismo paso, ahora en inglés.
    expect(heading()).toHaveTextContent('Liveness check · step 2 of 2');
    expect(counter()).toHaveAttribute('aria-label', 'Stage 4 of 5');
    expect(message()).toHaveTextContent('Hold it there');
    expect(screen.getByText('Front camera')).toBeInTheDocument();
    expect(detection.options?.mode).toMatchObject({ kind: 'action', action: 'TURN_RIGHT' });
    // La cámara no se reinició ni se soltó; la página no se recargó.
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(track.stop).not.toHaveBeenCalled();
    expect(video()).toBe(viewer);
    expect(viewer.srcObject).toBe(stream);
    expect(versionService.reloadApp).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    // El reto sigue donde iba: el segundo giro termina y se envía con las dos capturas del reto.
    await stable();
    expect(flow.onSubmit).toHaveBeenCalledOnce();
    expect(flow.onSubmit.mock.calls[0][0].challenge?.images).toHaveLength(2);
    expect(document.querySelector('.faceid__intro h2 + p')).toHaveTextContent('Wait for confirmation before continuing.');
  });

  it('un aviso que armó la app en pantalla (movimiento a destiempo) cambia de idioma sin reiniciarse', async () => {
    serve({ challenge: () => apiOk(TWO_TURNS) });
    renderFlow();
    await cameraOn();
    await stable({ pitch: 0.5, width: 200 });
    await advance(config.faceChallengeTimeoutMs);
    expect(message()).toHaveTextContent('No se completó el movimiento a tiempo.');

    await act(() => setLocale('en-US'));
    expect(message()).toHaveTextContent("The movement wasn't completed in time.");
    expect(heading()).toHaveTextContent("Try again");
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
  });
});
