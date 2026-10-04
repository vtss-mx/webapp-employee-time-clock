import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { DetectionMode, FaceGuidance } from '../hooks/useFaceDetection';
import { ApiError } from '../services/apiClient';
import { samplePolicy } from '../test/fixtures';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../test/http';
import { renderWithProviders } from '../test/render';
import { CameraNotReadyError } from '../utils/cameraDiagnostics';
import type { FaceChallenge } from '../types';
import { challengeActions, flowStatus, introFor, LiveFaceFlow, scannerView, type CapturedFace } from './LiveFaceFlow';

/*
 * Flujo facial completo con la cámara y MediaPipe simulados (tienen sus propias pruebas): la prueba
 * decide qué ve el detector (guía, avance, giro) y cuándo el rostro queda estable; el backend
 * (validación previa y reto) responde por fetch como el real.
 */
const camera = vi.hoisted(() => ({ status: 'active', trackLabel: 'FaceTime HD Camera', isMirrored: true, capture: vi.fn<() => Promise<Blob>>() }));
vi.mock('../hooks/useCamera', () => ({
  useCamera: () => ({
    videoRef: { current: null },
    facing: 'user',
    status: camera.status,
    error: null,
    problem: null,
    devices: [],
    activeDeviceId: null,
    activeLabel: 'Cámara frontal',
    trackLabel: camera.trackLabel,
    isMirrored: camera.isMirrored,
    start: () => Promise.resolve(),
    requestAccess: () => undefined,
    stop: () => undefined,
    switchCamera: () => undefined,
    selectCamera: () => undefined,
    captureFrame: camera.capture,
  }),
}));

interface AutoCaptureOptions {
  enabled: boolean;
  mode?: DetectionMode;
  stableFrames?: number;
  onStable?: () => void | Promise<void>;
}
interface Reading {
  guidance: FaceGuidance;
  progress: number;
  turnProgress: number;
}
/** Lo que "ve" el detector, como un store externo: la prueba lo cambia y el flujo se redibuja. */
const detection = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let reading: Reading = { guidance: 'hold_still', progress: 0, turnProgress: 0 };
  return {
    detector: null as object | null,
    error: null as string | null,
    options: null as AutoCaptureOptions | null,
    read: () => reading,
    see(next: Partial<Reading>) {
      reading = { ...reading, ...next };
      listeners.forEach((listener) => listener());
    },
    reset() {
      reading = { guidance: 'hold_still', progress: 0, turnProgress: 0 };
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
});
vi.mock('../hooks/useFaceDetection', async (importOriginal) => {
  const { useSyncExternalStore } = await import('react');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    useFaceDetector: () => ({ detector: detection.detector, error: detection.error, loading: !detection.detector && !detection.error }),
    useFaceAutoCapture: (options: AutoCaptureOptions) => {
      detection.options = options;
      return useSyncExternalStore(detection.subscribe, detection.read);
    },
  };
});

const CHECK_OK = { ok: true, message: 'Captura válida', detection_score: 0.99, quality_score: 0.9, yaw_ratio: 0 };
const NO_LIVENESS: FaceChallenge = { liveness_required: false, challenge_id: null, action: null, instruction: null, actions: [], instructions: [], min_yaw_ratio: null, expires_in: null };
const TWO_TURNS: FaceChallenge = {
  liveness_required: true,
  challenge_id: 'ch-1',
  action: 'TURN_LEFT',
  instruction: 'Gira la cabeza hacia tu izquierda',
  actions: ['TURN_LEFT', 'TURN_RIGHT'],
  instructions: ['Gira la cabeza hacia tu izquierda', 'Gira la cabeza hacia tu derecha'],
  min_yaw_ratio: 0.25,
  expires_in: 60,
};

type Responder = (call: MockCall) => Response | Promise<Response>;

/** Backend del flujo: validación previa (/face/check) y reto (/face/challenge). */
function serve({ check = () => apiOk(CHECK_OK), challenge = () => apiOk(NO_LIVENESS) }: { check?: Responder; challenge?: Responder } = {}) {
  const { calls } = mockFetch((call) => (call.url.includes('/face/check') ? check(call) : call.url.includes('/face/challenge') ? challenge(call) : apiFail(404, 'NOT_FOUND')));
  return { checks: () => calls.filter((c) => c.url.includes('/face/check')).length, challenges: () => calls.filter((c) => c.url.includes('/face/challenge')).length, calls };
}

/** Rechazo de la validación previa por accesorios (con los códigos que el servidor detectó). */
const accessoriesFound = (accessories: string[]) =>
  jsonResponse(
    envelope(null, {
      status: 422,
      code: 'ACCESSORIES_DETECTED',
      message: 'Retira tus accesorios',
      errors: [{ code: 'ACCESSORIES_DETECTED', message: 'Retira tus accesorios', field: null, details: { accessories } }],
    }),
    422,
  );

let frames: Blob[];
let onSubmit: Mock<(captured: CapturedFace) => Promise<void>>;
let onFatal: Mock<(error: unknown) => void>;

function renderFlow(props: Partial<Parameters<typeof LiveFaceFlow>[0]> = {}) {
  return renderWithProviders(
    <LiveFaceFlow title="Verificación facial" frontalFrames={1} submittingMessage="Confirmando tu identidad..." policy={samplePolicy} onSubmit={onSubmit} onFatal={onFatal} onCancel={() => undefined} {...props} />,
  );
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
/** El detector ve el rostro estable: dispara la captura de la fase actual y deja que avance. */
async function stable() {
  act(() => void detection.options?.onStable?.());
  await advance(0);
}
const see = (reading: Partial<Reading>) => act(() => detection.see(reading));
const message = () => screen.getAllByRole('status')[0];
const heading = () => screen.getByRole('heading', { level: 2 });
const arrow = () => document.querySelector('.turn-arrow');

beforeEach(() => {
  vi.useFakeTimers();
  camera.status = 'active';
  camera.trackLabel = 'FaceTime HD Camera';
  camera.isMirrored = true;
  frames = [];
  camera.capture.mockReset().mockImplementation(() => {
    const blob = new Blob([`captura-${frames.length + 1}`], { type: 'image/jpeg' });
    frames.push(blob);
    return Promise.resolve(blob);
  });
  detection.detector = {};
  detection.error = null;
  detection.options = null;
  detection.reset();
  onSubmit = vi.fn<(captured: CapturedFace) => Promise<void>>(() => Promise.resolve());
  onFatal = vi.fn<(error: unknown) => void>();
});
afterEach(() => vi.useRealTimers());

describe('LiveFaceFlow: escaneo frontal y envío', () => {
  it('sin prueba de vida: capturas con pausa entre ellas, validación previa y envío con el nombre de la cámara', async () => {
    const server = serve();
    let finish: () => void = () => undefined;
    onSubmit.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    renderFlow({ frontalFrames: 3 });
    expect(message()).toHaveTextContent('Rostro detectado. Mantente quieto...');
    expect(heading()).toHaveTextContent('Centra tu rostro');
    expect(detection.options).toMatchObject({ enabled: true, mode: { kind: 'frontal' }, stableFrames: 6 });

    await stable();
    expect(message()).toHaveTextContent('Capturando 1 de 3...');
    expect(detection.options?.enabled).toBe(false); // ya no busca el rostro mientras captura
    await advance(380);
    expect(message()).toHaveTextContent('Capturando 2 de 3...');
    await advance(380);
    expect(camera.capture).toHaveBeenCalledTimes(3);
    expect(server.checks()).toBe(1);
    expect(message()).toHaveTextContent('Confirmando tu identidad...');
    expect(heading()).toHaveTextContent('Confirmando tu identidad');
    expect(onSubmit).toHaveBeenCalledWith({ frontal: frames, camera: 'FaceTime HD Camera', accessoryReview: false });
    const form = server.calls.find((c) => c.url.includes('/face/check'))?.init.body as FormData;
    expect(form.getAll('images')).toHaveLength(3);
    expect(form.get('allow_headwear')).toBe('false');
    await act(() => Promise.resolve().then(() => finish()));
  });

  it('una cámara sin nombre no se informa; la prenda de cabeza exenta viaja en la validación previa', async () => {
    camera.trackLabel = '';
    const server = serve();
    renderFlow({ allowHeadwear: true });
    await stable();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ camera: undefined }));
    expect((server.calls[0].init.body as FormData).get('allow_headwear')).toBe('true');
  });

  it('un error corregible al enviar muestra el motivo y reanuda; uno no corregible termina', async () => {
    serve();
    onSubmit.mockRejectedValueOnce(new ApiError({ statusCode: 422, code: 'TOO_DARK', message: 'Hay poca luz' }));
    renderFlow();
    await stable();
    expect(message()).toHaveTextContent('Hay poca luz');
    expect(heading()).toHaveTextContent('Intentemos de nuevo');
    await advance(3_000);
    expect(message()).toHaveTextContent('Rostro detectado. Mantente quieto...');
    onSubmit.mockRejectedValueOnce(new Error('falla inesperada'));
    await stable();
    expect(onFatal).toHaveBeenCalledWith(new Error('falla inesperada'));
  });

  it('al salir mientras se valida o se envía, la respuesta (o su falla) ya no hace nada', async () => {
    let answer: (response: Response) => void = () => undefined;
    serve({ challenge: () => new Promise((resolve) => (answer = resolve)) });
    const leaving = renderFlow();
    await stable();
    leaving.unmount();
    await act(() => Promise.resolve().then(() => answer(apiOk(NO_LIVENESS))));
    expect(onSubmit).not.toHaveBeenCalled();

    let fail: (error: Error) => void = () => undefined;
    onSubmit.mockImplementation(() => new Promise((_, reject) => (fail = reject)));
    serve();
    const sending = renderFlow();
    await stable();
    sending.unmount();
    await act(() => Promise.resolve().then(() => fail(new Error('falla tras salir'))));
    expect(onFatal).not.toHaveBeenCalled();
  });
});

describe('LiveFaceFlow: prueba de vida', () => {
  it('dos giros: gira, vuelve al frente y gira al otro lado; envía una captura por giro, en orden', async () => {
    serve({ challenge: () => apiOk(TWO_TURNS) });
    renderFlow();
    await stable();
    expect(detection.options).toMatchObject({ enabled: true, mode: { kind: 'turn', direction: 'TURN_LEFT', minYawRatio: 0.25 }, stableFrames: 3 });
    expect(heading()).toHaveTextContent('Sigue la indicación · giro 1 de 2');

    see({ guidance: 'turn', turnProgress: 0.1 });
    expect(message()).toHaveTextContent('Gira la cabeza hacia tu izquierda');
    expect(arrow()?.querySelector('.lucide-arrow-left')).not.toBeNull(); // con espejo, su izquierda se ve a la izquierda
    see({ turnProgress: 0.5 });
    expect(message()).toHaveTextContent('Un poco más...');
    see({ guidance: 'too_far' });
    expect(message()).toHaveTextContent('Acércate un poco más a la cámara');
    see({ guidance: 'hold_still' });
    expect(message()).toHaveTextContent('¡Bien! Mantén la posición...');
    expect(arrow()).toBeNull();

    await stable(); // primer giro capturado: de vuelta al frente
    expect(screen.getByText('Vuelve a mirar al frente para el siguiente giro.')).toBeInTheDocument();
    expect(message()).toHaveTextContent('¡Bien! Prepárate para el siguiente giro...');
    see({ guidance: 'turn', turnProgress: 0 });
    expect(message()).toHaveTextContent('Vuelve a mirar al frente');
    expect(detection.options?.mode).toEqual({ kind: 'frontal' });
    expect(arrow()).toBeNull();

    await stable(); // ya al frente: el segundo giro
    expect(heading()).toHaveTextContent('Sigue la indicación · giro 2 de 2');
    expect(detection.options?.mode).toEqual({ kind: 'turn', direction: 'TURN_RIGHT', minYawRatio: 0.25 });
    expect(message()).toHaveTextContent('Gira la cabeza hacia tu derecha');
    expect(arrow()?.querySelector('.lucide-arrow-right')).not.toBeNull();

    await stable();
    expect(onSubmit).toHaveBeenCalledWith({ frontal: [frames[0]], challenge: { id: 'ch-1', images: [frames[1], frames[2]] }, camera: 'FaceTime HD Camera', accessoryReview: false });
  });

  it('reto de una versión anterior (solo `action`, sin mínimo de giro) con la cámara trasera sin espejo', async () => {
    camera.isMirrored = false;
    const legacy: FaceChallenge = { ...NO_LIVENESS, liveness_required: true, challenge_id: 'ch-old', action: 'TURN_RIGHT', instruction: 'Gira a tu derecha' };
    serve({ challenge: () => apiOk(legacy) });
    renderFlow();
    await stable();
    expect(detection.options?.mode).toEqual({ kind: 'turn', direction: 'TURN_RIGHT', minYawRatio: 0.2 });
    expect(heading()).toHaveTextContent(/^Sigue la indicación$/);
    see({ guidance: 'turn' });
    expect(message()).toHaveTextContent('Gira a tu derecha');
    expect(arrow()?.querySelector('.lucide-arrow-left')).not.toBeNull(); // sin espejo, su derecha se ve a la izquierda
    await stable();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ challenge: { id: 'ch-old', images: [frames[1]] } }));
  });

  it('el giro no se detecta a tiempo: pide otro reto conservando el escaneo; al tercero reinicia todo', async () => {
    let issued = 0;
    const server = serve({ challenge: () => apiOk({ ...TWO_TURNS, challenge_id: `ch-${++issued}` }) });
    renderFlow();
    await stable();
    await advance(20_000);
    expect(message()).toHaveTextContent('No se detectó el giro. Gira despacio hasta que la barra se llene.');
    expect(heading()).toHaveTextContent('Intentemos de nuevo');
    await advance(3_000);
    expect(heading()).toHaveTextContent('Sigue la indicación · giro 1 de 2');
    expect(server.challenges()).toBe(2);

    await stable(); // primer giro; el tiempo también corre al volver al frente
    await advance(20_000);
    expect(message()).toHaveTextContent('No se detectó el giro');
    await advance(3_000);
    expect(heading()).toHaveTextContent('giro 1 de 2'); // el reto nuevo empieza desde su primer giro
    expect(server.challenges()).toBe(3);

    await advance(20_000);
    expect(message()).toHaveTextContent('No se detectó el giro de cabeza. Intentemos de nuevo.');
    await advance(3_000);
    expect(detection.options?.mode).toEqual({ kind: 'frontal' });
    expect(server.checks()).toBe(1); // los retos se repitieron sin volver a escanear
    expect(onFatal).not.toHaveBeenCalled();
  });

  it('si el reto nuevo falla, se trata como cualquier error; uno no corregible termina', async () => {
    let issued = 0;
    serve({ challenge: () => (++issued === 1 ? apiOk(TWO_TURNS) : apiFail(403, 'FORBIDDEN', 'Sin permiso')) });
    renderFlow();
    await stable();
    await advance(23_000);
    expect(onFatal).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('si el reto nuevo ya no trae id (la empresa quitó la prueba de vida), no se captura un giro', async () => {
    let issued = 0;
    serve({ challenge: () => apiOk(++issued === 1 ? TWO_TURNS : NO_LIVENESS) });
    renderFlow();
    await stable();
    await advance(23_000);
    await stable();
    expect(camera.capture).toHaveBeenCalledOnce(); // solo la frontal
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('si la cámara no da imagen al capturar el giro (llamada entrante), espera y vuelve a empezar sin rendirse', async () => {
    serve({ challenge: () => apiOk(TWO_TURNS) });
    renderFlow();
    await stable();
    camera.capture.mockRejectedValueOnce(new CameraNotReadyError());
    await stable();
    expect(heading()).toHaveTextContent('Intentemos de nuevo');
    expect(message()).toHaveTextContent('La cámara aún no está lista');
    await advance(3_000);
    expect(detection.options?.mode).toEqual({ kind: 'frontal' });
    expect(onFatal).not.toHaveBeenCalled();
  });

  it('al salir durante la pausa de un bloqueo, ya no se reanuda', async () => {
    serve({ check: () => apiFail(422, 'TOO_DARK', 'Hay poca luz') });
    const view = renderFlow();
    await stable();
    expect(message()).toHaveTextContent('Hay poca luz');
    const options = detection.options;
    view.unmount();
    await advance(3_000);
    expect(detection.options).toBe(options); // no se volvió a dibujar
  });

  it('al salir durante la pausa entre retos, el reto nuevo que llega ya no se muestra', async () => {
    const server = serve({ challenge: () => apiOk(TWO_TURNS) });
    const view = renderFlow();
    await stable();
    await advance(20_000);
    view.unmount();
    await advance(3_000);
    expect(server.challenges()).toBe(2);
    expect(onFatal).not.toHaveBeenCalled();
  });
});

describe('LiveFaceFlow: accesorios', () => {
  it('tras dos intentos con el mismo accesorio ofrece enviar a revisión; con revisión pedida el accesorio ya no detiene', async () => {
    let checks = 0;
    serve({ check: () => (++checks <= 3 ? accessoriesFound(['GLASSES', 'SCARF']) : apiFail(422, 'TOO_DARK', 'Hay poca luz')) });
    renderFlow({ allowAccessoryReview: true });
    await stable();
    expect(message()).toHaveTextContent('Retira tus accesorios');
    expect(document.querySelector('.accessory-alert')).toHaveTextContent('LentesSCARF');
    expect(screen.queryByRole('note')).toBeNull(); // un solo intento: aún no se ofrece
    await advance(3_000);
    await stable();
    // El código desconocido se muestra tal cual (catálogo sin esa frase).
    expect(screen.getByRole('note')).toHaveTextContent('¿No estás usando los lentes ni SCARF?');
    fireEvent.click(screen.getByRole('button', { name: 'No uso los lentes ni SCARF · enviar a revisión' }));
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByText(/Tu registro se enviará marcado para revisión de tu empresa/)).toBeInTheDocument();

    await advance(3_000);
    await stable(); // vuelve a detectar los lentes: ya no detiene
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ accessoryReview: true }));

    await stable(); // otro problema (luz) sí detiene aunque se haya pedido revisión
    expect(message()).toHaveTextContent('Hay poca luz');
  });

  it('sin la opción de revisión (verificación), insistir en el accesorio no la ofrece', async () => {
    serve({ check: () => accessoriesFound(['GLASSES']) });
    renderFlow();
    for (let i = 0; i < 3; i++) {
      await stable();
      await advance(3_000);
    }
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('LiveFaceFlow: captura manual, cámara virtual y otra forma de identificarse', () => {
  it('sin detección automática: "Capturar" solo con la cámara lista y buscando el rostro', async () => {
    detection.detector = null;
    detection.error = 'No se pudo cargar la detección facial automática';
    let answer: (response: Response) => void = () => undefined;
    serve({ check: () => new Promise((resolve) => (answer = resolve)) });
    renderFlow();
    expect(message()).toHaveTextContent('Detección automática no disponible. Usa "Capturar".');
    const capture = screen.getByRole('button', { name: 'Capturar' });
    fireEvent.click(capture);
    await advance(0);
    expect(capture).toBeDisabled(); // validando
    await act(() => Promise.resolve().then(() => answer(apiOk(CHECK_OK))));
    await advance(0);
    expect(onSubmit).toHaveBeenCalled();
  });

  it('cámara virtual: no se captura y se pide la cámara del dispositivo', () => {
    detection.detector = null;
    detection.error = 'sin detector';
    camera.trackLabel = 'OBS Virtual Camera';
    serve();
    renderFlow();
    expect(message()).toHaveTextContent('Cámara virtual no permitida: elige la cámara del dispositivo');
    expect(detection.options?.enabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Capturar' })).toBeDisabled();
  });

  it('cámara aún sin imagen: "Capturar" deshabilitado; mientras carga el detector se avisa', () => {
    detection.detector = null;
    detection.error = 'sin detector';
    camera.status = 'requesting';
    serve();
    const view = renderFlow();
    expect(screen.getByRole('button', { name: 'Capturar' })).toBeDisabled();
    view.unmount();

    detection.error = null; // cargando
    camera.status = 'active';
    renderFlow();
    expect(message()).toHaveTextContent('Preparando detección facial...');
    expect(document.querySelector('.faceid__actions')).toBeEmptyDOMElement(); // nada que ofrecer
  });

  it('otra forma de identificarse (p. ej. QR) siempre a la mano', () => {
    serve();
    const onSelect = vi.fn();
    renderFlow({ alternative: { label: 'Identificarme con QR', icon: null, onSelect } });
    fireEvent.click(screen.getByRole('button', { name: 'Identificarme con QR' }));
    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Capturar' })).toBeNull();
  });
});

describe('LiveFaceFlow: textos del visor (reglas puras)', () => {
  const base = { guidance: 'turn' as FaceGuidance, submittingMessage: 'Enviando...', detectorReady: true, detectorFailed: false };

  it('bloqueo sin motivo y giro sin instrucción usan su texto genérico', () => {
    expect(flowStatus({ ...base, phase: 'blocked' })).toEqual({ message: 'Intentemos de nuevo', tone: 'warn' });
    expect(flowStatus({ ...base, phase: 'challenge', instruction: null })).toEqual({ message: 'Gira la cabeza', tone: 'idle' });
    expect(flowStatus({ ...base, phase: 'checking', capture: null })).toEqual({ message: 'Analizando...', tone: 'busy' });
  });

  it('el anillo del giro empieza vacío si aún no hay lectura; sin reto no hay giros', () => {
    const view = scannerView({ ...base, phase: 'challenge', progress: 0.7, challenge: TWO_TURNS, step: 0, virtualCamera: false, mirrored: true, capture: null });
    expect(view.ringProgress).toBe(0);
    expect(challengeActions(null)).toEqual([]);
    expect(introFor({ phase: 'challenge', stage: 'liveness', submittingMessage: 'Enviando...' })).toEqual({ title: 'Sigue la indicación', text: 'Gira la cabeza cuando el sistema te lo indique.' });
  });
});
