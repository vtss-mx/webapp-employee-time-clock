import { CameraOff, Lock, RefreshCw } from 'lucide-react';
import { t } from '../i18n';
import { cameraProblemText, type CameraProblem } from '../utils/cameraDiagnostics';
import type { MessageInput } from './MessageDialog';

/**
 * Por qué no se pudo abrir la cámara y los pasos para resolverlo (sistema y navegador), en el idioma
 * activo: el popup lo pide al dibujarse (`feedback.show(() => cameraProblemMessage(problem))`).
 */
export function cameraProblemMessage(problem: CameraProblem): MessageInput {
  const { title, message, steps } = cameraProblemText(problem);
  return {
    // Permiso bloqueado o conexión no segura los resuelve el usuario: advertencia; lo demás, error.
    variant: problem.kind === 'denied' || problem.kind === 'insecure' ? 'warning' : 'error',
    icon: <CameraOff size={30} />,
    eyebrow: t('face.camera.name'),
    title,
    text: message,
    details: steps,
    detailsStyle: 'steps',
    actions: problem.secureUrl
      ? [
          { id: 'retry', label: t('common.actions.retry'), variant: 'ghost' },
          { id: 'secure', label: t('face.camera.openSecure'), icon: <Lock size={18} /> },
        ]
      : [
          { id: 'close', label: t('common.actions.close'), variant: 'ghost' },
          { id: 'retry', label: t('common.actions.retry'), icon: <RefreshCw size={18} /> },
        ],
    key: cameraProblemKey(problem),
  };
}

/** Clave del popup de un problema: con ella se retira si la cámara se recupera. */
export const cameraProblemKey = (problem: CameraProblem) => `camera-problem-${problem.kind}`;
