import { act, screen } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import type { CapturedFace } from '../components/LiveFaceFlow';
import { LiveFaceFlow } from '../components/LiveFaceFlow';
import type { FaceChallenge } from '../types';
import type { FaceBaseline } from '../utils/facePose';
import { camera, detection, type Reading } from './faceFlowMocks';
import { samplePolicy } from './fixtures';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from './http';
import { renderWithProviders } from './render';

export { camera, detection } from './faceFlowMocks';

/*
 * Banco de pruebas del flujo facial (LiveFaceFlow) con la cámara y MediaPipe simulados
 * (`faceFlowMocks`): la prueba decide qué ve el detector (guía, avance) y cuándo el rostro queda
 * estable; el backend (validación previa y reto) responde por fetch como el real.
 */

export const CHECK_OK = { ok: true, message: 'Captura válida', detection_score: 0.99, quality_score: 0.9, yaw_ratio: 0 };

export const NO_LIVENESS: FaceChallenge = {
  liveness_required: false,
  challenge_id: null,
  action: null,
  instruction: null,
  actions: [],
  instructions: [],
  min_yaw_ratio: null,
  min_pitch_delta: null,
  min_closer_scale: null,
  flash: [],
  flash_required: false,
  expires_in: null,
  liveness_hold_ms: null,
  liveness_max_retries: null,
};

export const TWO_TURNS: FaceChallenge = {
  ...NO_LIVENESS,
  liveness_required: true,
  challenge_id: 'ch-1'.padEnd(64, '0'),
  action: 'TURN_LEFT',
  instruction: 'Gira la cabeza hacia tu izquierda',
  actions: ['TURN_LEFT', 'TURN_RIGHT'],
  instructions: ['Gira la cabeza hacia tu izquierda', 'Gira la cabeza hacia tu derecha'],
  min_yaw_ratio: 0.25,
  min_pitch_delta: 0.09,
  min_closer_scale: 1.3,
  expires_in: 60,
};

type Responder = (call: MockCall) => Response | Promise<Response>;

/** Backend del flujo: validación previa (/face/check) y reto (/face/challenge). */
export function serve({ check = () => apiOk(CHECK_OK), challenge = () => apiOk(NO_LIVENESS) }: { check?: Responder; challenge?: Responder } = {}) {
  const { calls } = mockFetch((call) => {
    if (call.url.includes('/face/check')) return check(call);
    if (call.url.includes('/face/challenge')) return challenge(call);
    if (call.url.includes('/verification/sessions/')) return apiOk({
      id: call.url.split('/').at(-1), execution_status: 'READY', decision_status: null,
      created_at: '2026-10-10T22:00:00Z', expires_at: '2026-10-10T22:01:00Z',
      flow_version: 'synthetic-test-protocol', policy_version: '0'.repeat(64), attempt_id: null, device_nonce: null,
    });
    return apiFail(404, 'NOT_FOUND');
  });
  return { checks: () => calls.filter((c) => c.url.includes('/face/check')).length, challenges: () => calls.filter((c) => c.url.includes('/face/challenge')).length, calls };
}

/** La validación previa aceptada que INFORMA accesorios (bloqueados o no): las insignias sobre el rostro. */
export const checkReporting = (accessories: string[]) => apiOk({ ...CHECK_OK, accessories });

/** Rechazo de la validación previa por accesorios que la política bloquea (con los códigos que el servidor detectó). */
export const accessoriesFound = (accessories: string[]) =>
  jsonResponse(
    envelope(null, {
      status: 422,
      code: 'ACCESSORIES_DETECTED',
      message: 'Quítate el cubrebocas para continuar',
      errors: [{ code: 'ACCESSORIES_DETECTED', message: 'Quítate el cubrebocas para continuar', field: null, details: { accessories } }],
    }),
    422,
  );

/** El reto del REGISTRO (decisión del dueño, 2026-10-07): siempre los cuatro movimientos de la cabeza, en orden al azar. */
export const FOUR_MOVES: FaceChallenge = {
  ...TWO_TURNS,
  challenge_id: 'ch-enroll'.padEnd(64, '0'),
  action: 'LOOK_UP',
  instruction: 'Levanta un poco la barbilla y mira hacia arriba',
  actions: ['LOOK_UP', 'TURN_RIGHT', 'LOOK_DOWN', 'TURN_LEFT'],
  instructions: ['Levanta un poco la barbilla y mira hacia arriba', 'Gira la cabeza hacia tu derecha', 'Baja un poco la barbilla y mira hacia abajo', 'Gira la cabeza hacia tu izquierda'],
};

/** Las fotos del registro (una sola válida, del tamaño de la configuración) para las pruebas del flujo. */
export const ENROLLMENT = { frontalFrames: 1, frontalPhoto: { maxSide: 640, gapMs: 10 } };

/** Lo que el flujo entrega a la pantalla (envío) y sus errores no corregibles. */
export const flow = {
  onSubmit: vi.fn<(captured: CapturedFace) => Promise<void>>(),
  onFatal: vi.fn<(error: unknown) => void>() as Mock<(error: unknown) => void>,
};

/** Estado inicial de cada prueba (con temporizadores simulados). */
export function resetFaceFlow() {
  vi.useFakeTimers();
  camera.status = 'active';
  camera.trackLabel = 'FaceTime HD Camera';
  camera.isMirrored = true;
  camera.frames = [];
  camera.capture.mockReset().mockImplementation(() => {
    const blob = new Blob([`captura-${camera.frames.length + 1}`], { type: 'image/jpeg' });
    camera.frames.push(blob);
    return Promise.resolve(blob);
  });
  detection.detector = {};
  detection.failed = false;
  detection.options = null;
  detection.reset();
  flow.onSubmit.mockReset().mockImplementation(() => Promise.resolve());
  flow.onFatal.mockReset();
}

export function renderFlow(props: Partial<Parameters<typeof LiveFaceFlow>[0]> = {}) {
  return renderWithProviders(
    <LiveFaceFlow
      title="Verificación facial"
      frontalFrames={1}
      submittingMessage="Confirmando tu identidad..."
      policy={samplePolicy}
      onSubmit={flow.onSubmit}
      onFatal={flow.onFatal}
      onCancel={() => undefined}
      {...props}
    />,
  );
}

export const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
/** El detector ve el rostro estable: dispara la captura de la fase actual (con lo medido) y deja que avance. */
export async function stable(sample?: FaceBaseline) {
  act(() => void detection.options?.onStable?.(sample));
  await advance(0);
}
export const see = (reading: Partial<Reading>) => act(() => detection.see(reading));
/** El mensaje bajo el círculo (el aviso en vivo): su indicación vigente, sin la que se desvanece en el fundido cruzado. */
const status = () => screen.getAllByRole('status')[0];
export const message = () => status().querySelector('.crossfade__layer--current') ?? status();
/** La cuenta de las fotos bajo la indicación («Foto 2 de 3»), mientras se toman. */
export const detail = () => status().querySelector('.camera__detail');
export const heading = () => screen.getByRole('heading', { level: 2 });
