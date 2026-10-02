import { Camera, CameraOff, Lock, RefreshCw } from 'lucide-react';
import type { CameraFacing } from '../hooks/useCamera';
import type { CameraProblem } from '../utils/cameraDiagnostics';
import type { MessageInput } from './MessageDialog';

export const CAMERA_CONSENT_KEY = 'camera-consent';

const PURPOSE: Record<CameraFacing, string> = {
  user: 'Para verificar tu identidad usaremos la cámara frontal durante unos segundos.',
  environment: 'Para leer tu código QR usaremos la cámara durante unos segundos.',
};

/**
 * Explicación previa al aviso de permisos del navegador: el usuario sabe para qué se usa la
 * cámara antes de decidir (un "Bloquear" por sorpresa obliga a cambiar ajustes del sistema).
 */
export function cameraConsentMessage(facing: CameraFacing): MessageInput {
  return {
    variant: 'info',
    icon: <Camera size={30} />,
    eyebrow: 'Permiso de cámara',
    title: 'Permite el acceso a tu cámara',
    text: PURPOSE[facing],
    details: [
      'Solo se activa mientras estás en esta pantalla.',
      'Las imágenes viajan cifradas y solo se usan para validar tu identidad.',
      'Puedes retirar el permiso en los ajustes de tu navegador.',
    ],
    detailsStyle: 'checks',
    actions: [
      { id: 'later', label: 'Ahora no', variant: 'ghost' },
      { id: 'allow', label: 'Permitir acceso', icon: <Camera size={18} /> },
    ],
    footnote: 'Tu navegador te pedirá confirmarlo: elige «Permitir».',
    key: CAMERA_CONSENT_KEY,
  };
}

/** Por qué no se pudo abrir la cámara y los pasos para resolverlo (sistema y navegador). */
export function cameraProblemMessage(problem: CameraProblem): MessageInput {
  return {
    // Permiso bloqueado o conexión no segura los resuelve el usuario: advertencia; lo demás, error.
    variant: problem.kind === 'denied' || problem.kind === 'insecure' ? 'warning' : 'error',
    icon: <CameraOff size={30} />,
    eyebrow: 'Cámara',
    title: problem.title,
    text: problem.message,
    details: problem.steps,
    detailsStyle: 'steps',
    actions: problem.secureUrl
      ? [
          { id: 'retry', label: 'Reintentar', variant: 'ghost' },
          { id: 'secure', label: 'Abrir versión segura', icon: <Lock size={18} /> },
        ]
      : [
          { id: 'close', label: 'Cerrar', variant: 'ghost' },
          { id: 'retry', label: 'Reintentar', icon: <RefreshCw size={18} /> },
        ],
    key: `camera-problem-${problem.kind}`,
  };
}
