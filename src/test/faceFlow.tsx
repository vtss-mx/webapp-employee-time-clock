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
};

export const TWO_TURNS: FaceChallenge = {
  ...NO_LIVENESS,
  liveness_required: true,
  challenge_id: 'ch-1',
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
  const { calls } = mockFetch((call) => (call.url.includes('/face/check') ? check(call) : call.url.includes('/face/challenge') ? challenge(call) : apiFail(404, 'NOT_FOUND')));
  return { checks: () => calls.filter((c) => c.url.includes('/face/check')).length, challenges: () => calls.filter((c) => c.url.includes('/face/challenge')).length, calls };
}

/** Rechazo de la validación previa por accesorios (con los códigos que el servidor detectó). */
export const accessoriesFound = (accessories: string[]) =>
  jsonResponse(
    envelope(null, {
      status: 422,
      code: 'ACCESSORIES_DETECTED',
      message: 'Retira tus accesorios',
      errors: [{ code: 'ACCESSORIES_DETECTED', message: 'Retira tus accesorios', field: null, details: { accessories } }],
    }),
    422,
  );

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
  detection.error = null;
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
export const message = () => screen.getAllByRole('status')[0];
export const heading = () => screen.getByRole('heading', { level: 2 });
