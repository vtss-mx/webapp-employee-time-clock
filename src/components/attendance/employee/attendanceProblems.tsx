import { CalendarClock, LocateOff, MapPinOff, RefreshCw, Route } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '../../../services/apiClient';
import { LocationError, type LocationProblem } from '../../../utils/geolocation';
import { locationProblemMessage } from '../../location/locationMessages';
import type { MessageAction, MessageInput } from '../../MessageDialog';

/**
 * Lo que impide registrar la asistencia sin ser del rostro: la ubicación del teléfono (permiso, GPS) o
 * la respuesta del servidor (fuera del sitio, imprecisa, no creíble, el estado ya cambió). Cada caso
 * se explica en un popup con qué hacer; los de ubicación ofrecen "Reintentar" (con una lectura nueva).
 */

const RETRY_ACTIONS: MessageAction[] = [
  { id: 'close', label: 'Cancelar', variant: 'ghost' },
  { id: 'retry', label: 'Reintentar', variant: 'primary', icon: <RefreshCw size={18} /> },
];

/** Permiso, GPS o conexión del teléfono que impidieron leer la ubicación. */
export function attendanceLocationMessage(problem: LocationProblem): MessageInput {
  return { ...locationProblemMessage(problem, 'attendance'), actions: RETRY_ACTIONS };
}

const API_PROBLEMS: Partial<Record<string, { title: string; icon: ReactNode; steps: string[] }>> = {
  LOCATION_INACCURATE: {
    title: 'Tu ubicación no es precisa',
    icon: <LocateOff size={30} />,
    steps: [
      'Activa la ubicación precisa: en iPhone, Ajustes › Privacidad › Localización › Safari › «Ubicación exacta».',
      'Sal a un lugar abierto o acércate a una ventana y espera unos segundos.',
      'Toca «Reintentar».',
    ],
  },
  LOCATION_OUT_OF_SITE: {
    title: 'Estás fuera de tu sitio de trabajo',
    icon: <MapPinOff size={30} />,
    steps: ['Acércate a uno de tus sitios de trabajo (los ves en «Mi asistencia»).', 'Activa la ubicación precisa (GPS) del teléfono.', 'Toca «Reintentar».'],
  },
  IMPOSSIBLE_TRAVEL: {
    title: 'Tu ubicación no es creíble',
    icon: <Route size={30} />,
    steps: [
      'Desactiva cualquier aplicación que cambie o simule tu ubicación (y la VPN).',
      'Activa la ubicación precisa (GPS) y vuelve a intentarlo.',
      'Si sigue ocurriendo, avisa a tu empresa.',
    ],
  },
};

export interface AttendanceProblem {
  /** retry: se puede reintentar con otra ubicación; stale: lo permitido cambió (se vuelve a "Mi asistencia"). */
  kind: 'retry' | 'stale';
  message: MessageInput;
}

/** El problema de ubicación o de estado detrás de un error; null si es otro (rostro, red, servidor). */
export function attendanceProblem(error: unknown): AttendanceProblem | null {
  if (error instanceof LocationError) return { kind: 'retry', message: attendanceLocationMessage(error.problem) };
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'ATTENDANCE_ACTION_NOT_ALLOWED') {
    return {
      kind: 'stale',
      message: {
        variant: 'warning',
        icon: <CalendarClock size={30} />,
        eyebrow: 'Mi asistencia',
        title: 'Tu asistencia cambió',
        text: error.message,
        footnote: 'Revisa lo que puedes registrar ahora.',
        key: 'attendance-stale',
      },
    };
  }
  const copy = API_PROBLEMS[error.code];
  if (!copy) return null;
  return {
    kind: 'retry',
    message: {
      variant: 'warning',
      icon: copy.icon,
      eyebrow: 'Ubicación',
      title: copy.title,
      text: error.message,
      details: copy.steps,
      detailsStyle: 'steps',
      actions: RETRY_ACTIONS,
      key: `attendance-${error.code}`,
    },
  };
}
