import { CameraOff, Lock, RefreshCw } from 'lucide-react';
import type { CameraProblem } from '../utils/cameraDiagnostics';
import type { MessageInput } from './MessageDialog';

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
