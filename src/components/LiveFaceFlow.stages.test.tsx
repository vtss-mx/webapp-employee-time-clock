import { fireEvent, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { ApiError } from '../services/apiClient';
import {
  accessoriesFound,
  advance,
  camera,
  CHECK_OK,
  checkReporting,
  detail,
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
 * prueba de vida con giros (los cuatro movimientos del registro: LiveFaceFlow.liveness.test.tsx),
 * captura manual y cámara virtual.
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));

const cue = () => document.querySelector('.ring-cue');
const { onSubmit, onFatal } = flow;

beforeEach(resetFaceFlow);
afterEach(() => vi.useRealTimers());

describe('LiveFaceFlow: escaneo frontal y envío', () => {
  it('sin prueba de vida: capturas con pausa entre ellas, validación previa y envío con el nombre de la cámara', async () => {
    const server = serve();
    let finish: () => void = () => undefined;
    onSubmit.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    renderFlow({ frontalFrames: 3 });
    expect(message()).toHaveTextContent('Mantente quieto');
    expect(heading()).toHaveTextContent('Centra tu rostro');
    expect(detection.options).toMatchObject({ enabled: true, mode: { kind: 'frontal' }, stableFrames: 6 });

    await stable();
    expect(message()).toHaveTextContent('Mantente quieto'); // la indicación no cambia con cada foto
    expect(detail()).toHaveTextContent('Foto 1 de 3');
    expect(detection.options?.enabled).toBe(false); // ya no busca el rostro mientras captura
    await advance(380);
    expect(detail()).toHaveTextContent('Foto 2 de 3');
    await advance(380);
    expect(camera.capture).toHaveBeenCalledTimes(3);
    expect(server.checks()).toBe(1);
    expect(message()).toHaveTextContent('Confirmando tu identidad...');
    expect(heading()).toHaveTextContent('Confirmando tu identidad');
    expect(onSubmit).toHaveBeenCalledWith({ frontal: camera.frames, camera: 'FaceTime HD Camera', telemetry: expect.any(String) });
    const form = server.calls.find((c) => c.url.includes('/face/check'))?.init.body as FormData;
    expect(form.getAll('images')).toHaveLength(3);
    expect(form.get('allow_headwear')).toBe('false');
    await act(() => Promise.resolve().then(() => finish()));
  });

  it('el reto del dispositivo del empleado viaja con las capturas (también sin prueba de vida)', async () => {
    serve({ challenge: () => apiOk({ ...NO_LIVENESS, device_nonce: 'reto-del-equipo' }) });
    renderFlow({ frontalFrames: 1 });
    await stable();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ deviceNonce: 'reto-del-equipo', telemetry: expect.stringContaining('"v":1') }));
  });

  it('una cámara sin nombre no se informa; la prenda de cabeza exenta viaja en la validación previa', async () => {
    camera.trackLabel = '';
    const server = serve();
    renderFlow({ allowHeadwear: true });
    await stable();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ camera: undefined }));
    // El reto se pide al empezar el escaneo (junto con las fotos) y la validación previa, al terminarlas.
    expect(server.calls.map((call) => call.url.split('/api')[1])).toEqual(['/face/challenge', '/face/check']);
    expect((server.calls.find((call) => call.url.includes('/face/check'))?.init.body as FormData).get('allow_headwear')).toBe('true');
  });

  it('un error corregible al enviar muestra el motivo y reanuda; uno no corregible termina', async () => {
    serve();
    onSubmit.mockRejectedValueOnce(new ApiError({ statusCode: 422, code: 'TOO_DARK', message: 'Hay poca luz' }));
    renderFlow();
    await stable();
    expect(message()).toHaveTextContent('Hay poca luz');
    expect(heading()).toHaveTextContent('Intenta de nuevo');
    await advance(3_000);
    expect(message()).toHaveTextContent('Mantente quieto');
    onSubmit.mockRejectedValueOnce(new Error('falla inesperada'));
    await stable();
    expect(onFatal).toHaveBeenCalledWith(new Error('falla inesperada'));
  });

  it('el motor de riesgo pide un paso más: el siguiente escaneo responde ese reto (sin pedir otro) con capturas nuevas', async () => {
    const server = serve();
    const stepUp = { ...TWO_TURNS, challenge_id: 'ch-up', actions: ['TURN_LEFT' as const], instructions: ['Gira la cabeza hacia tu izquierda'], step_up: true };
    const details = { challenge: stepUp };
    const message422 = 'Por seguridad, completa un paso más: sigue las indicaciones en pantalla.';
    onSubmit.mockRejectedValueOnce(
      new ApiError({ statusCode: 422, code: 'STEP_UP_REQUIRED', message: message422, errors: [{ code: 'STEP_UP_REQUIRED', message: message422, field: null, details }] }),
    );
    renderFlow();
    await stable(); // sin prueba de vida: envía y el servidor pide un paso más
    expect(message()).toHaveTextContent('Por seguridad, completa un paso más');
    await advance(3_000);
    await stable(); // escaneo nuevo: responde el reto del paso más
    expect(server.challenges()).toBe(1);
    expect(detection.options).toMatchObject({ mode: { kind: 'action', action: 'TURN_LEFT' } });
    await stable();
    const [, frontal, turn] = camera.frames;
    expect(onSubmit).toHaveBeenLastCalledWith({ frontal: [frontal], challenge: { id: 'ch-up', images: [turn] }, camera: 'FaceTime HD Camera', telemetry: expect.any(String) });
  });

  it('al salir mientras se valida o se envía, la respuesta (o su falla) ya no hace nada', async () => {
    let answer: (response: Response) => void = () => undefined;
    serve({ challenge: () => new Promise((resolve) => (answer = resolve)) });
    const leaving = renderFlow();
    await stable();
    leaving.unmount();
    await act(() => Promise.resolve().then(() => answer(apiOk(NO_LIVENESS))));
    expect(onSubmit).not.toHaveBeenCalled();

    let check: (response: Response) => void = () => undefined;
    serve({ check: () => new Promise((resolve) => (check = resolve)) });
    const checking = renderFlow();
    await stable();
    checking.unmount();
    await act(() => Promise.resolve().then(() => check(checkReporting(['GLASSES'])))); // las insignias ya no se dibujan
    expect(document.querySelector('.accessory-badge')).toBeNull();
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
    expect(cue()).toHaveClass('ring-cue--left'); // con espejo, su izquierda se ve a la izquierda
    see({ moveProgress: 0.5 });
    expect(message()).toHaveTextContent('Un poco más');
    see({ guidance: 'too_far' });
    expect(message()).toHaveTextContent('Acércate');
    see({ guidance: 'hold_still' });
    expect(message()).toHaveTextContent('Mantén la posición');
    expect(cue()).toBeNull();

    await stable(); // primer giro capturado: de vuelta al frente
    expect(screen.getByText('Vuelve a mirar al frente para el siguiente paso.')).toBeInTheDocument();
    expect(message()).toHaveTextContent('Listo para el siguiente paso');
    see({ guidance: 'move', moveProgress: 0 });
    expect(message()).toHaveTextContent('Centra tu rostro');
    see({ guidance: 'look_straight' });
    expect(message()).toHaveTextContent('Mira al frente'); // la corrección precisa, cuando la hay
    // De vuelta al frente se mide contra el rostro en reposo: la cabeza debe volver a su altura.
    expect(detection.options?.mode).toEqual({ kind: 'frontal', baseline });
    expect(cue()).toBeNull();
    see({ guidance: 'move' });

    await stable(); // ya al frente: el segundo giro
    expect(heading()).toHaveTextContent('Prueba de vida · paso 2 de 2');
    expect(detection.options?.mode).toEqual({ kind: 'action', action: 'TURN_RIGHT', minimum: 0.25, baseline });
    expect(message()).toHaveTextContent('Gira la cabeza hacia tu derecha');
    expect(cue()).toHaveClass('ring-cue--right');

    await stable();
    const [frontal, left, right] = camera.frames;
    expect(onSubmit).toHaveBeenCalledWith({ frontal: [frontal], challenge: { id: 'ch-1', images: [left, right] }, camera: 'FaceTime HD Camera', telemetry: expect.any(String) });
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
    expect(cue()).toHaveClass('ring-cue--left'); // sin espejo, su derecha se ve a la izquierda
    await stable();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ challenge: { id: 'ch-2', images: [camera.frames[1]] } }));
  });

  it('el movimiento no se detecta a tiempo: pide otro reto conservando el escaneo; al tercero reinicia todo', async () => {
    let issued = 0;
    const server = serve({ challenge: () => apiOk({ ...TWO_TURNS, challenge_id: `ch-${++issued}` }) });
    renderFlow();
    await stable();
    await advance(20_000);
    expect(message()).toHaveTextContent('No se completó el movimiento a tiempo. Hazlo despacio hasta llenar el anillo.');
    expect(heading()).toHaveTextContent('Intenta de nuevo');
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
    expect(message()).toHaveTextContent('No se completó la prueba de vida. El escaneo empezará de nuevo.');
    await advance(3_000);
    expect(detection.options?.mode).toEqual({ kind: 'frontal', baseline: null });
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
    expect(onSubmit).toHaveBeenCalledWith({ frontal: [camera.frames[0]], camera: 'FaceTime HD Camera', telemetry: expect.any(String) });
  });

  it('si la cámara no da imagen al capturar el giro (llamada entrante), espera y vuelve a empezar sin rendirse', async () => {
    serve({ challenge: () => apiOk(TWO_TURNS) });
    renderFlow();
    await stable();
    camera.capture.mockRejectedValueOnce(new CameraNotReadyError());
    await stable();
    expect(heading()).toHaveTextContent('Intenta de nuevo');
    expect(message()).toHaveTextContent('La cámara aún no está lista');
    await advance(3_000);
    expect(detection.options?.mode).toEqual({ kind: 'frontal', baseline: null });
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

describe('LiveFaceFlow: insignias de accesorios (decisión del dueño, 2026-10-07: la insignia es el único aviso)', () => {
  const badges = () => [...document.querySelectorAll('.accessory-badge')].map((badge) => badge.textContent?.trim());

  it('un accesorio que el servidor informa sin bloquear se muestra como insignia y las fotos siguen normal', async () => {
    serve({ check: () => checkReporting(['GLASSES']) });
    renderFlow();
    expect(badges()).toEqual([]);
    await stable();
    expect(badges()).toEqual(['Lentes']); // informativa: el envío ocurrió igual
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toMatch(/Quítate/);
  });

  it('dos accesorios bloqueados: dos insignias, la indicación de colocación (nunca el texto del servidor) y el escaneo se reanuda con las insignias a la vista hasta que una validación ya no las reporte', async () => {
    let checks = 0;
    serve({ check: () => (++checks === 1 ? accessoriesFound(['HEADWEAR', 'MASK']) : apiOk(CHECK_OK)) });
    renderFlow();
    await stable();
    expect(badges()).toEqual(['Gorra', 'Cubrebocas']);
    expect(heading()).toHaveTextContent('Intenta de nuevo');
    expect(message()).toHaveTextContent('Muestra tu rostro completo');
    expect(document.body.textContent).not.toMatch(/Quítate/);
    expect(onSubmit).not.toHaveBeenCalled();
    await advance(3_000); // se reanuda: las insignias siguen mientras el servidor no diga otra cosa
    expect(heading()).not.toHaveTextContent('Intenta de nuevo');
    expect(badges()).toEqual(['Gorra', 'Cubrebocas']);
    await stable(); // la siguiente validación ya no reporta accesorios: se retiran y se envía
    expect(badges()).toEqual([]);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('un rechazo por otro motivo retira las insignias; el 422 del envío también las muestra', async () => {
    let checks = 0;
    serve({ check: () => (++checks === 1 ? checkReporting(['GLASSES']) : apiFail(422, 'TOO_DARK', 'Hay poca luz')) });
    const error = new ApiError({
      statusCode: 422,
      code: 'ACCESSORIES_DETECTED',
      message: 'Quítate el cubrebocas para continuar',
      errors: [{ code: 'ACCESSORIES_DETECTED', message: 'm', field: null, details: { accessories: ['MASK'] } }],
    });
    onSubmit.mockRejectedValueOnce(error);
    renderFlow();
    await stable(); // la validación previa informa lentes; el envío falla por cubrebocas: la insignia es la del envío
    expect(badges()).toEqual(['Cubrebocas']);
    expect(message()).toHaveTextContent('Muestra tu rostro completo');
    await advance(3_000);
    await stable(); // otro motivo (luz): el servidor validó y no reportó accesorios
    expect(badges()).toEqual([]);
    expect(message()).toHaveTextContent('Hay poca luz');
  });
});

describe('LiveFaceFlow: captura manual, cámara virtual y otra forma de identificarse', () => {
  it('sin detección automática: "Capturar" solo con la cámara lista y buscando el rostro', async () => {
    detection.detector = null;
    detection.failed = true;
    let answer: (response: Response) => void = () => undefined;
    serve({ check: () => new Promise((resolve) => (answer = resolve)) });
    renderFlow();
    expect(message()).toHaveTextContent('Detección automática no disponible. Usa «Capturar».');
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
    detection.failed = true;
    camera.trackLabel = 'OBS Virtual Camera';
    serve();
    renderFlow();
    expect(message()).toHaveTextContent('Cámara virtual no permitida: elige la cámara del dispositivo');
    expect(detection.options?.enabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Capturar' })).toBeDisabled();
  });

  it('cámara aún sin imagen: "Capturar" deshabilitado; mientras carga el detector se avisa', () => {
    detection.detector = null;
    detection.failed = true;
    camera.status = 'requesting';
    serve();
    const view = renderFlow();
    expect(screen.getByRole('button', { name: 'Capturar' })).toBeDisabled();
    view.unmount();

    detection.failed = false; // cargando
    camera.status = 'active';
    renderFlow();
    expect(message()).toHaveTextContent('Preparando la detección facial…');
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
    expect(flowStatus({ ...base, phase: 'blocked' })).toEqual({ message: 'Intenta de nuevo', tone: 'warn' });
    expect(flowStatus({ ...base, phase: 'challenge', instruction: null })).toEqual({ message: 'Haz el movimiento que se indica', tone: 'idle' });
    expect(flowStatus({ ...base, phase: 'checking', capture: null })).toEqual({ message: 'Analizando…', tone: 'busy' });
  });

  it('sin reto no hay movimientos; sin la lista de instrucciones, la del primero', () => {
    expect(challengeActions(null)).toEqual([]);
    expect(introFor({ phase: 'challenge', stage: 'liveness', submittingMessage: 'Enviando...' })).toEqual({
      title: 'Prueba de vida',
      text: 'Mueve la cabeza como se indique hasta completar cada paso.',
      label: 'Prueba de vida',
    });
    const legacy = { ...TWO_TURNS, instructions: undefined as unknown as string[] }; // sin la lista: la instrucción del primero
    expect(scannerView({ ...base, phase: 'challenge', challenge: legacy, step: 0, virtualCamera: false }).message).toBe('Gira la cabeza hacia tu izquierda');
  });
});
