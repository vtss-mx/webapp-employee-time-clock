/**
 * Validador (punto de control): de quién es un QR y las identificaciones de este dispositivo. Cada persona llega con su
 * foto de perfil (`avatar`): el validador es una cuenta de la empresa y ve a su gente (decisión del dueño, 2026-10-06).
 */
import type { WithAvatar } from './avatar';
import type { Page, VerificationMethod } from './index';

/** Dueño de un QR (paso 1 del modo QR y rostro). */
export interface CheckpointEmployee extends WithAvatar {
  employee_id: number;
  name: string;
  /** Opcional (decisión del dueño del producto): null = sin número. */
  employee_number: string | null;
  /** El siguiente reto para firmar (antifraude 2b). */
  device_nonce?: string | null;
}

export interface CheckpointEvent extends WithAvatar {
  id: number;
  created_at: string;
  method: VerificationMethod;
  success: boolean;
  reason: string | null;
  confidence: number | null;
  employee_name: string | null;
  employee_number: string | null;
}

export type CheckpointEventList = Page<CheckpointEvent>;
