import { CalendarClock, LocateOff, MapPinOff, RefreshCw, Route } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../../i18n';
import { ApiError } from '../../../services/apiClient';
import { LocationError, type LocationProblem } from '../../../utils/geolocation';
import { locationProblemMessage } from '../../location/locationMessages';
import type { MessageAction, MessageInput } from '../../MessageDialog';

/**
 * Lo que impide registrar la asistencia sin ser del rostro: la ubicación del teléfono (permiso, GPS) o
 * la respuesta del servidor (fuera del sitio, imprecisa, no creíble, el estado ya cambió). Cada caso
 * se explica en un popup con qué hacer; los de ubicación ofrecen "Reintentar" (con una lectura nueva).
 * Los popups se arman al dibujarse (en el idioma activo): un popup abierto sigue al idioma.
 */

const retryActions = (): MessageAction[] => [
  { id: 'close', label: t('common.actions.cancel'), variant: 'ghost' },
  { id: 'retry', label: t('common.actions.retry'), variant: 'primary', icon: <RefreshCw size={18} /> },
];

/** Permiso, GPS o conexión del teléfono que impidieron leer la ubicación. */
export function attendanceLocationMessage(problem: LocationProblem): MessageInput {
  return { ...locationProblemMessage(problem, 'attendance'), actions: retryActions() };
}

/** Título y pasos (llaves) de cada respuesta del servidor que se puede reintentar con otra ubicación. */
const API_PROBLEMS = {
  LOCATION_INACCURATE: {
    title: 'location.server.inaccurate',
    icon: <LocateOff size={30} />,
    steps: ['myAttendance.problems.inaccurate.precise', 'myAttendance.problems.inaccurate.outdoors', 'myAttendance.problems.tapRetry'],
  },
  LOCATION_OUT_OF_SITE: {
    title: 'myAttendance.problems.outOfSite.title',
    icon: <MapPinOff size={30} />,
    steps: ['myAttendance.problems.outOfSite.approach', 'myAttendance.problems.outOfSite.gps', 'myAttendance.problems.tapRetry'],
  },
  IMPOSSIBLE_TRAVEL: {
    title: 'myAttendance.problems.impossibleTravel.title',
    icon: <Route size={30} />,
    steps: ['myAttendance.problems.impossibleTravel.spoofing', 'myAttendance.problems.impossibleTravel.gps', 'myAttendance.problems.impossibleTravel.report'],
  },
} as const satisfies Record<string, { title: string; icon: ReactNode; steps: readonly string[] }>;

const isApiProblem = (code: string): code is keyof typeof API_PROBLEMS => code in API_PROBLEMS;

export interface AttendanceProblem {
  /** retry: se puede reintentar con otra ubicación; stale: lo permitido cambió (se vuelve a "Mi asistencia"). */
  kind: 'retry' | 'stale';
  /** El popup, armado al dibujarse (sigue al idioma activo). */
  message: () => MessageInput;
}

/** El problema de ubicación o de estado detrás de un error; null si es otro (rostro, red, servidor). */
export function attendanceProblem(error: unknown): AttendanceProblem | null {
  if (error instanceof LocationError) return { kind: 'retry', message: () => attendanceLocationMessage(error.problem) };
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'ATTENDANCE_ACTION_NOT_ALLOWED') {
    return {
      kind: 'stale',
      message: () => ({
        variant: 'warning',
        icon: <CalendarClock size={30} />,
        eyebrow: t('myAttendance.home.eyebrow'),
        title: t('myAttendance.problems.stale.title'),
        text: error.message,
        footnote: t('myAttendance.problems.stale.footnote'),
        key: 'attendance-stale',
      }),
    };
  }
  if (!isApiProblem(error.code)) return null;
  const copy = API_PROBLEMS[error.code];
  return {
    kind: 'retry',
    message: () => ({
      variant: 'warning',
      icon: copy.icon,
      eyebrow: t('location.eyebrow'),
      title: t(copy.title),
      text: error.message,
      details: copy.steps.map((step) => t(step)),
      detailsStyle: 'steps',
      actions: retryActions(),
      key: `attendance-${error.code}`,
    }),
  };
}
