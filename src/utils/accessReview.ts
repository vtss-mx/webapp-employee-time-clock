/**
 * Reglas puras de la revisión de accesos (pantalla `ADMIN_ACCESS_REVIEW`): las marcas de cada cuenta y los
 * controles DECLARADOS como filas legibles. Sin React ni peticiones: se prueban solas.
 *
 * Ningún umbral se calcula aquí: el plazo de inactividad, la gracia del segundo factor y los parámetros de
 * Argon2id vienen del resumen que envía el servidor, tomados de su código vigente.
 */
import { t } from '../i18n';
import type { AccessControls, AccessReviewAccount, AccessReviewFilters } from '../types/accessReview';
import type { StatusTone } from '../types/index';
import { formatDateTime, formatMinutes } from './format';
import { formatCount, formatList } from './numbers';

/** Lo que hay que atender primero de una cuenta: bloqueada, sin segundo factor, inactiva o sin entrar nunca. */
export type AccountFlag = 'locked' | 'withoutMfa' | 'neverSignedIn' | 'stale' | 'inactive';

/** El tono con que se dibuja cada marca (la misma paleta de los catálogos con tono). */
export const FLAG_TONE: Record<AccountFlag, StatusTone> = {
  locked: 'danger',
  withoutMfa: 'danger',
  neverSignedIn: 'warning',
  stale: 'warning',
  inactive: 'muted',
};

/**
 * Las marcas de una cuenta, de la más grave a la menos. «Sin segundo factor» solo aplica a quien lo DEBE tener
 * (`mfa_required`): el servidor ya decidió a quién se le exige; la app no lo deduce del rol.
 */
export function accountFlags(account: AccessReviewAccount): AccountFlag[] {
  const flags: AccountFlag[] = [];
  if (account.locked) flags.push('locked');
  if (account.mfa_required && !account.mfa_satisfied) flags.push('withoutMfa');
  if (account.last_login_at === null) flags.push('neverSignedIn');
  else if (account.stale) flags.push('stale');
  if (!account.active) flags.push('inactive');
  return flags;
}

/** Último acceso de una cuenta: la fecha con los días que han pasado, o que nunca ha entrado. */
export function lastAccessText(account: AccessReviewAccount): string {
  if (account.last_login_at === null) return t('accessReview.neverSignedIn');
  const date = formatDateTime(account.last_login_at);
  return account.days_since_login === null ? date : `${date} · ${t('accessReview.daysAgo', { count: account.days_since_login })}`;
}

/** Su segundo factor: cuántas llaves tiene, si ya cumple o hasta cuándo tiene plazo. */
export function mfaText(account: AccessReviewAccount): string {
  if (!account.mfa_required) return t('accessReview.mfa.notRequired');
  if (account.mfa_satisfied) return t('accessReview.mfa.satisfied', { count: account.passkeys });
  return account.mfa_grace_until ? t('accessReview.mfa.grace', { date: formatDateTime(account.mfa_grace_until) }) : t('accessReview.mfa.expired');
}

/** Una fila del bloque de controles: su etiqueta y su valor, ya legibles. */
export interface ControlRow {
  key: string;
  label: string;
  value: string;
}

/**
 * Cada parámetro de Argon2id con su nombre EN EL IDIOMA de quien lee (regla 16: nunca se mezclan idiomas): las
 * pasadas, la memoria en MB (regla 17) y los hilos. Un parámetro que esta versión no conoce se dibuja con su código
 * tal cual (es un dato del servidor, no un texto de la app).
 */
const ARGON2_TEXTS: Partial<Record<string, (value: number) => string>> = {
  time_cost: (count) => t('accessReview.controls.argon2Passes', { count }),
  memory_mb: (value) => t('accessReview.controls.argon2Memory', { value: formatCount(value) }),
  parallelism: (count) => t('accessReview.controls.argon2Lanes', { count }),
};

/** Argon2id tal como el servidor lo declara, con cada parámetro nombrado en el idioma activo. */
function argon2Text(argon2: Record<string, number>): string {
  const parts = Object.entries(argon2).map(([name, value]) => ARGON2_TEXTS[name]?.(value) ?? `${name} ${formatCount(value)}`);
  return parts.length ? parts.join(' · ') : t('audit.noValue');
}

/**
 * Los controles DECLARADOS como filas legibles: es justo lo que un auditor pide por correo, y sale del código
 * vigente del servidor (nunca de un documento que puede quedar viejo). `roleName` los nombra con el catálogo
 * `roles`: la app no escribe el nombre de ningún rol.
 */
export function controlRows(controls: AccessControls, roleName: (role: string) => string): ControlRow[] {
  const days = (count: number) => t('accessReview.controls.days', { count });
  const switchText = (value: boolean) => t(value ? 'accessReview.controls.on' : 'accessReview.controls.off');
  return [
    { key: 'mfaRequiredFor', label: t('accessReview.controls.mfaRequiredFor'), value: controls.mfa_required_for.length ? formatList(controls.mfa_required_for.map(roleName)) : t('accessReview.controls.noRole') },
    { key: 'mfaGrace', label: t('accessReview.controls.mfaGrace'), value: days(controls.mfa_grace_days) },
    { key: 'passwordMinLength', label: t('accessReview.controls.passwordMinLength'), value: t('accessReview.controls.chars', { count: controls.password_min_length }) },
    { key: 'passwordHistory', label: t('accessReview.controls.passwordHistory'), value: t('accessReview.controls.passwords', { count: controls.password_history_size }) },
    { key: 'breachedCheck', label: t('accessReview.controls.breachedCheck'), value: switchText(controls.breached_password_check) },
    { key: 'argon2', label: t('accessReview.controls.argon2'), value: argon2Text(controls.argon2) },
    { key: 'lockout', label: t('accessReview.controls.lockout'), value: t('accessReview.controls.lockoutValue', { count: controls.lockout_max_failures, minutes: formatMinutes(controls.lockout_minutes) }) },
    { key: 'sessionAbsolute', label: t('accessReview.controls.sessionAbsolute'), value: formatMinutes(controls.session_absolute_minutes) },
    { key: 'sessionIdle', label: t('accessReview.controls.sessionIdle'), value: formatMinutes(controls.session_idle_minutes) },
    { key: 'privilegedIdle', label: t('accessReview.controls.privilegedIdle'), value: formatMinutes(controls.privileged_session_idle_minutes) },
    { key: 'staleDays', label: t('accessReview.controls.staleDays'), value: days(controls.stale_days) },
  ];
}

/** ¿El informe está filtrado? (el vacío dice «nada coincide» en lugar de «aún no hay cuentas»). */
export function isFiltered(filters: AccessReviewFilters): boolean {
  return Boolean(filters.role || filters.company_id || filters.without_mfa || filters.stale || filters.locked || filters.search);
}

/** La exportación llegó al tope del servidor: hay que filtrar más para llevarse todo. */
export function reachedLimit(rows: number, limit: number): boolean {
  return rows >= limit;
}
