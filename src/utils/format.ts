const dateFormatter = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  // Las fechas "YYYY-MM-DD" se interpretan en hora local para evitar desfase de un día.
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

export function formatPercent(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`;
}

/**
 * Confianza con hasta 3 decimales, truncada (nunca redondea hacia arriba): 0.999996 → "99.999 %",
 * no "100 %", que ningún sistema biométrico puede garantizar.
 */
export function formatConfidence(value: number | null | undefined): string {
  if (value == null) return '—';
  // Tope en 99.999 %: una similitud perfecta (misma imagen) tampoco se presenta como certeza.
  const percent = Math.min(Math.floor(value * 100_000), 99_999) / 1000;
  return `${percent.toLocaleString('es-MX', { maximumFractionDigits: 3 })} %`;
}

/** Los roles de la aplicación, con su nombre oficial. */
export const roleLabel = { ADMIN: 'Admin', COMPANY: 'Company', EMPLOYEE: 'Employee', VALIDATOR: 'Validator' } as const;

/** Cómo se identificó una persona (bitácora). */
export const methodLabel = { FACE: 'Rostro', QR: 'QR', QR_FACE: 'QR + rostro' } as const;

/** Motivo de un intento fallido (códigos que registra el backend en la bitácora). */
const FAILURE_REASONS: Record<string, string> = {
  NO_MATCH: 'Rostro no coincide',
  LIVENESS_FAILED: 'Prueba de vida no superada',
  LIVENESS_MISMATCH: 'Capturas de personas distintas',
  INVALID_FORMAT: 'QR inválido',
  NOT_FOUND: 'QR no reconocido',
  OTHER_COMPANY: 'QR no reconocido',
  REVOKED: 'QR revocado',
  EXPIRED: 'QR expirado',
  OTHER_EMPLOYEE: 'QR de otro empleado',
  EMPLOYEE_INACTIVE: 'Empleado desactivado',
  FACE_NOT_REGISTERED: 'Sin rostro validado',
  EMPTY_GALLERY: 'Sin rostros registrados',
  AMBIGUOUS_MATCH: 'Parecido a varias personas',
  INCONSISTENT_MATCH: 'Capturas no concluyentes',
};

export function failureReason(code: string | null | undefined): string {
  return FAILURE_REASONS[code ?? ''] ?? 'Fallida';
}

export function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function ageFrom(birthDate: string): number {
  const d = new Date(`${birthDate}T00:00:00`);
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--;
  return age;
}

const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });

export function timeAgo(value: string | null | undefined): string {
  if (!value) return '—';
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'hace un momento';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDate(value);
}
