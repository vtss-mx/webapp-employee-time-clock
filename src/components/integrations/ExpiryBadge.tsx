import { useT } from '../../i18n';
import type { ApiKeyStatus } from '../../types';

interface ExpiryBadgeProps {
  /** Lo decide el SERVIDOR con su propio plazo de aviso (`expiring_soon`), nunca la app. */
  expiringSoon: boolean;
  status: ApiKeyStatus;
  /** Días que le quedan, también del servidor (`days_to_expire`); null = una credencial sin vencimiento. */
  days: number | null;
}

/**
 * Aviso de rotar una credencial de la API ANTES de que el sistema que la usa se quede sin servicio.
 * El umbral y los días los envía el backend (regla 25 de la raíz: la app no calcula un valor derivado); aquí solo
 * se dibuja. Lo comparten las llaves de la API (migración 0096) y las claves de firma (0105): el aviso es el mismo,
 * así que su texto vive una sola vez (`apiKeys.row.*`, regla 6).
 */
export function ExpiryBadge({ expiringSoon, status, days }: ExpiryBadgeProps) {
  const t = useT();
  if (!expiringSoon || status !== 'ACTIVE') return null;
  return <span className="badge badge--warning">{days === null ? t('apiKeys.row.expiringSoon') : t('apiKeys.row.expiresInDays', { count: days })}</span>;
}
