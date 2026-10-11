import type { Phase } from '../components/FaceScan';
import type { FaceChallenge } from '../types';
import type { FaceBaseline } from './facePose';

/** Reto vigente con id emitido por el backend. */
export type ActiveChallenge = FaceChallenge & { challenge_id: string };

interface StableHandlers {
  frontal: (sample?: FaceBaseline) => Promise<void>;
  step: (active: ActiveChallenge) => Promise<void>;
  recenter: (active: ActiveChallenge) => Promise<void>;
}

/** Cada rostro estable conserva el paso original de captura, giro o vuelta al frente. */
export function stableHandler(phase: Phase, challenge: ActiveChallenge | null, handlers: StableHandlers): (sample?: FaceBaseline) => void | Promise<void> {
  if (phase === 'recenter' && challenge) return () => handlers.recenter(challenge);
  if (phase === 'challenge' && challenge) return () => handlers.step(challenge);
  return handlers.frontal;
}
