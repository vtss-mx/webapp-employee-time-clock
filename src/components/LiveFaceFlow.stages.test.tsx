import { fireEvent, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { ApiError } from '../services/apiClient';
import {
  accessoriesFound,
  advance,
  camera,
  CHECK_OK,
  detection,
  flow,
  heading,
  message,
  NO_LIVENESS,
  renderFlow,
  resetFaceFlow,
  see,
  serve,
  stable,
  TWO_TURNS,
} from '../test/faceFlow';
import { apiFail, apiOk } from '../test/http';
import { CameraNotReadyError } from '../utils/cameraDiagnostics';
import { challengeActions, flowStatus, introFor, scannerView } from './liveFaceView';

/*
 * Flujo facial completo con la cámara y MediaPipe simulados (test/faceFlowMocks): escaneo frontal,
 * prueba de vida con giros (el destello y los demás movimientos: LiveFaceFlow.liveness.test.tsx),
 * accesorios, captura manual y cámara virtual.
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));

const arrow = () => document.querySelector('.turn-arrow');
const { onSubmit, onFatal } = flow;

beforeEach(resetFaceFlow);
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
    expect(onSubmit).toHaveBeenCalledWith({ frontal: camera.frames, camera: 'FaceTime HD Camera', accessoryReview: false });
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

describe('LiveFaceFlow: prueba de vida con giros', () => {
  it('dos giros: gira, vuelve al frente y gira al otro lado; envía una captura por giro, en orden', async () => {
    serve({ challenge: () => apiOk(TWO_TURNS) });
    renderFlow();
    const baseline = { pitch: 0.52, width: 210 };
    await stable(baseline);
    expect(detection.options).toMatchObject({ enabled: true, mode: { kind: 'action', action: 'TURN_LEFT', minimum: 0.25, baseline }, stableFrames: 3 });
    expect(heading()).toHaveTextContent('Prueba de vida · paso 1 de 2');

    see({ guidance: 'move', moveProgress: 0.1 });
    expect(message()).toHaveTextContent('Gira la cabeza hacia tu izquierda');
    expect(arrow()?.querySelector('.lucide-arrow-left')).not.toBeNull(); // con espejo, su izquierda se ve a la izquierda
    see({ moveProgress: 0.5 });
    expect(message()).toHaveTextContent('Un poco más...');
    see({ guidance: 'too_far' });
    expect(message()).toHaveTextContent('Acércate un poco más a la cámara');
    see({ guidance: 'hold_still' });
    expect(message()).toHaveTextContent('¡Bien! Mantén la posición...');
    expect(arrow()).toBeNull();

    await stable(); // primer giro capturado: de vuelta al frente
    expect(screen.getByText('Vuelve a mirar al frente para el siguiente paso.')).toBeInTheDocument();
    expect(message()).toHaveTextContent('¡Bien! Prepárate para el siguiente paso...');
    see({ guidance: 'move', moveProgress: 0 });
    expect(message()).toHaveTextContent('Vuelve a mirar al frente');
    expect(detection.options?.mode).toEqual({ kind: 'frontal' });
    expect(arrow()).toBeNull();

    await stable(); // ya al frente: el segundo giro
    expect(heading()).toHaveTextContent('Prueba de vida · paso 2 de 2');
    expect(detection.options?.mode).toEqual({ kind: 'action', action: 'TURN_RIGHT', minimum: 0.25, baseline });
    expect(message()).toHaveTextContent('Gira la cabeza hacia tu derecha');
    expect(arrow()?.querySelector('.lucide-arrow-right')).not.toBeNull();

    await stable();
    const [frontal, left, right] = camera.frames;
    expect(onSubmit).toHaveBeenCalledWith({ frontal: [frontal], challenge: { id: 'ch-1', images: [left, right] }, camera: 'FaceTime HD Camera', accessoryReview: false });
  });

  it('un solo giro con la cámara trasera sin espejo (y sin mínimo del servidor: el piso)', async () => {
    camera.isMirrored = false;
    const single = { ...TWO_TURNS, challenge_id: 'ch-2', actions: ['TURN_RIGHT' as const], instructions: ['Gira a tu derecha'], min_yaw_ratio: null };
    serve({ challenge: () => apiOk(single) });
    renderFlow();
    await stable();
    expect(detection.options?.mode).toEqual({ kind: 'action', action: 'TURN_RIGHT', minimum: 0.2, baseline: null });
    expect(heading()).toHaveTextContent(/^Prueba de vida$/);
    see({ guidance: 'move' });
    expect(message()).toHaveTextContent('Gira a tu derecha');
    expect(arrow()?.querySelector('.lucide-arrow-left')).not.toBeNull(); // sin espejo, su derecha se ve a la izquierda
    await stable();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ challenge: { id: 'ch-2', images: [camera.frames[1]] } }));
  });

  it('el movimiento no se detecta a tiempo: pide otro reto conservando el escaneo; al tercero reinicia todo', async () => {
    let issued = 0;
    const server = serve({ challenge: () => apiOk({ ...TWO_TURNS, challenge_id: `ch-${++issued}` }) });
    renderFlow();
    await stable();
    await advance(20_000);
    expect(message()).toHaveTextContent('No se completó el movimiento a tiempo. Hazlo despacio, hasta que el anillo se llene.');
    expect(heading()).toHaveTextContent('Intentemos de nuevo');
    await advance(3_000);
    expect(heading()).toHaveTextContent('Prueba de vida · paso 1 de 2');
    expect(server.challenges()).toBe(2);

    await stable(); // primer giro; el tiempo también corre al volver al frente
    await advance(20_000);
    expect(message()).toHaveTextContent('No se completó el movimiento a tiempo');
    await advance(3_000);
    expect(heading()).toHaveTextContent('paso 1 de 2'); // el reto nuevo empieza desde su primer movimiento
    expect(server.challenges()).toBe(3);

    await advance(20_000);
    expect(message()).toHaveTextContent('No se completó la prueba de vida. Intentemos de nuevo desde el inicio.');
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

  it('si el reto nuevo ya no pide prueba de vida (la empresa la quitó), se envían las frontales', async () => {
    let issued = 0;
    serve({ challenge: () => apiOk(++issued === 1 ? TWO_TURNS : NO_LIVENESS) });
    renderFlow();
    await stable();
    await advance(23_000);
    expect(camera.capture).toHaveBeenCalledOnce(); // solo la frontal
    expect(onSubmit).toHaveBeenCalledWith({ frontal: [camera.frames[0]], camera: 'FaceTime HD Camera', accessoryReview: false });
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
  const base = { guidance: 'move' as FaceGuidance, submittingMessage: 'Enviando...', detectorReady: true, detectorFailed: false };

  it('bloqueo sin motivo y movimiento sin instrucción usan su texto genérico', () => {
    expect(flowStatus({ ...base, phase: 'blocked' })).toEqual({ message: 'Intentemos de nuevo', tone: 'warn' });
    expect(flowStatus({ ...base, phase: 'challenge', instruction: null })).toEqual({ message: 'Haz el movimiento que se indica', tone: 'idle' });
    expect(flowStatus({ ...base, phase: 'checking', capture: null })).toEqual({ message: 'Analizando...', tone: 'busy' });
  });

  it('el anillo del movimiento empieza vacío si aún no hay lectura; sin reto no hay movimientos', () => {
    const view = scannerView({ ...base, phase: 'challenge', progress: 0.7, challenge: TWO_TURNS, step: 0, virtualCamera: false, capture: null });
    expect(view.ringProgress).toBe(0);
    expect(challengeActions(null)).toEqual([]);
    expect(introFor({ phase: 'challenge', stage: 'liveness', submittingMessage: 'Enviando...' })).toEqual({ title: 'Prueba de vida', text: 'Mueve la cabeza como se indique; la pantalla puede cambiar de color un instante.' });
    const legacy = { ...TWO_TURNS, instructions: undefined as unknown as string[] }; // sin la lista: la instrucción del primero
    expect(scannerView({ ...base, phase: 'challenge', progress: 0, challenge: legacy, step: 0, virtualCamera: false }).message).toBe('Gira la cabeza hacia tu izquierda');
  });
});
