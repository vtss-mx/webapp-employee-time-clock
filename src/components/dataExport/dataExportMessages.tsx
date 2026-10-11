import { Clock, ShieldAlert } from 'lucide-react';
import { t } from '../../i18n';
import { ApiError } from '../../services/apiClient';
import { formatDateTime } from '../../utils/format';
import { formatDuration } from '../../utils/numbers';
import type { MessageInput, MessageSource } from '../MessageDialog';

/**
 * Rechazos de una exportación que necesitan su PROPIA explicación, porque reintentar no podría funcionar (regla 7
 * de la raíz: nunca un «Reintentar» que no sirve):
 * - 429 `EXPORT_TOO_SOON`: el servidor entrega una por titular cada tantas horas; se dice CUÁNDO podrá de nuevo
 *   con el `Retry-After` que envió.
 * - 403 `COMPANY_REQUIRED`: la sesión no opera en una empresa (una cuenta de la plataforma). Su expediente es su
 *   cuenta, que ya ve en «Mi perfil».
 */
const BLOCKED: Record<string, number> = { EXPORT_TOO_SOON: 429, COMPANY_REQUIRED: 403 };

/** ¿Es uno de los dos rechazos con aviso propio? (código Y estado: un código igual con otro estado no cuenta). */
export function isExportBlocked(error: unknown): error is ApiError {
  return error instanceof ApiError && BLOCKED[error.code] === error.status;
}

/** El aviso de ese rechazo, armado en el idioma vigente. */
function blockedMessage(error: ApiError): MessageInput {
  if (error.code === 'EXPORT_TOO_SOON') {
    const wait = error.retryAfterMs;
    return {
      variant: 'info',
      icon: <Clock size={30} />,
      eyebrow: t('dataExport.blocked.eyebrow'),
      title: t('dataExport.blocked.tooSoon'),
      text: error.message,
      details: wait === null ? undefined : [t('dataExport.blocked.availableAt', { date: formatDateTime(new Date(Date.now() + wait).toISOString()), wait: formatDuration(wait) })],
      key: 'export-too-soon',
    };
  }
  return {
    variant: 'info',
    icon: <ShieldAlert size={30} />,
    eyebrow: t('dataExport.blocked.eyebrow'),
    title: t('dataExport.blocked.companyRequired'),
    text: error.message,
    footnote: t('dataExport.blocked.companyFootnote'),
    key: 'export-company-required',
  };
}

/**
 * El aviso propio de un rechazo (como FUNCIÓN: el popup abierto sigue al idioma activo), o null si el error es
 * otro y se explica con el popup de siempre.
 */
export function exportBlockedNotice(error: unknown): MessageSource | null {
  return isExportBlocked(error) ? () => blockedMessage(error) : null;
}
