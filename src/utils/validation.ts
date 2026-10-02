import { config } from './config';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .-]*$/;
const EMPLOYEE_NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,29}$/;
// RFC de persona física (SAT): 4 letras, fecha aammdd y homoclave de 3 (el último, dígito o "A").
const RFC_RE = /^[A-ZÑ&]{4}(\d{2})(\d{2})(\d{2})[A-Z\d]{2}[\dA]$/;
const GENERIC_RFCS = new Set(['XAXX010101000', 'XEXX010101000']);
export const RFC_LENGTH = 13;
export const MIN_EMPLOYEE_AGE = config.minEmployeeAge;

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'El correo es obligatorio';
  if (!EMAIL_RE.test(value.trim())) return 'Ingresa un correo válido';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'La contraseña es obligatoria';
  if (value.length < 8) return 'Mínimo 8 caracteres';
  if (value.length > 128) return 'Máximo 128 caracteres';
  if (!/[a-z]/.test(value)) return 'Debe incluir una letra minúscula';
  if (!/[A-Z]/.test(value)) return 'Debe incluir una letra mayúscula';
  if (!/\d/.test(value)) return 'Debe incluir un número';
  return undefined;
}

export function validateName(value: string, label: string): string | undefined {
  const v = value.trim();
  if (!v) return `${label} es obligatorio`;
  if (v.length > 100) return 'Máximo 100 caracteres';
  if (!NAME_RE.test(v)) return 'Solo letras, espacios, apóstrofes, puntos y guiones';
  return undefined;
}

export function validateBirthDate(value: string): string | undefined {
  if (!value) return 'La fecha de nacimiento es obligatoria';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Fecha inválida';
  const today = new Date();
  if (date >= today) return 'Debe ser anterior a hoy';
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  if (age < MIN_EMPLOYEE_AGE) return `El empleado debe tener al menos ${MIN_EMPLOYEE_AGE} años`;
  if (age > 100) return 'Fecha inválida';
  return undefined;
}

export function validateEmployeeNumber(value: string): string | undefined {
  if (!value.trim()) return 'El número de empleado es obligatorio';
  if (!EMPLOYEE_NUMBER_RE.test(value.trim())) return '1-30 caracteres: letras, números, guion o guion bajo';
  return undefined;
}

/** Como se guarda el RFC: mayúsculas, sin espacios ni guiones (y sin caracteres no válidos). */
export function normalizeRfc(value: string): string {
  return value.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '');
}

/** La fecha del RFC no indica el siglo: es válida si existe en 19aa o en 20aa (29 de febrero). */
function rfcDateIsValid(yy: number, mm: number, dd: number): boolean {
  return [1900, 2000].some((century) => {
    const date = new Date(century + yy, mm - 1, dd);
    return date.getMonth() === mm - 1 && date.getDate() === dd;
  });
}

/** Mismas reglas que el backend; con `birthDate` (ISO) verifica también que coincida la fecha. */
export function validateRfc(value: string, birthDate?: string): string | undefined {
  const rfc = normalizeRfc(value);
  if (!rfc) return 'El RFC es obligatorio';
  if (GENERIC_RFCS.has(rfc)) return 'Captura el RFC personal del empleado; el RFC genérico no es válido';
  if (rfc.length !== RFC_LENGTH) return `El RFC de una persona física tiene ${RFC_LENGTH} caracteres`;
  const match = RFC_RE.exec(rfc);
  if (!match) return 'El RFC no tiene un formato válido (p. ej. PEGJ900515AB1)';
  if (!rfcDateIsValid(Number(match[1]), Number(match[2]), Number(match[3]))) return 'La fecha del RFC (aammdd) no es válida';
  const birth = /^\d{2}(\d{2})-(\d{2})-(\d{2})$/.exec(birthDate ?? '');
  if (birth && rfc.slice(4, 10) !== `${birth[1]}${birth[2]}${birth[3]}`) return 'El RFC no coincide con la fecha de nacimiento';
  return undefined;
}

// ---------- CURP ----------
const CURP_RE =
  /^[A-Z][AEIOUX][A-Z]{2}(\d{2})(\d{2})(\d{2})[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}([A-Z\d])(\d)$/;
const CURP_ALPHABET = '0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ';
export const CURP_LENGTH = 18;

export function normalizeCurp(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Dígito verificador de la CURP (algoritmo de RENAPO). */
export function curpCheckDigit(first17: string): string {
  const total = [...first17].reduce((sum, char, i) => sum + CURP_ALPHABET.indexOf(char) * (18 - i), 0);
  return String((10 - (total % 10)) % 10);
}

export function validateCurp(value: string, birthDate?: string): string | undefined {
  const curp = normalizeCurp(value);
  if (!curp) return 'La CURP es obligatoria';
  if (curp.length !== CURP_LENGTH) return `La CURP tiene ${CURP_LENGTH} caracteres`;
  const match = CURP_RE.exec(curp);
  if (!match) return 'La CURP no tiene un formato válido (p. ej. HEGG560427MVZRRL04)';
  if (!rfcDateIsValid(Number(match[1]), Number(match[2]), Number(match[3]))) return 'La fecha de la CURP (aammdd) no es válida';
  if (curpCheckDigit(curp.slice(0, 17)) !== curp[17]) return 'La CURP no es válida: el dígito verificador no corresponde';
  const birth = /^(\d{2})(\d{2})-(\d{2})-(\d{2})$/.exec(birthDate ?? '');
  if (birth) {
    const centuryOk = /\d/.test(curp[16]) === Number(`${birth[1]}${birth[2]}`) < 2000;
    if (curp.slice(4, 10) !== `${birth[2]}${birth[3]}${birth[4]}` || !centuryOk) return 'La CURP no coincide con la fecha de nacimiento';
  }
  return undefined;
}

// ---------- NSS (IMSS) ----------
export const NSS_LENGTH = 11;

export function luhnValid(digits: string): boolean {
  const total = [...digits].reverse().reduce((sum, char, i) => {
    const n = Number(char) * (i % 2 === 1 ? 2 : 1);
    return sum + (n > 9 ? n - 9 : n);
  }, 0);
  return total % 10 === 0;
}

export function validateNss(value: string): string | undefined {
  const nss = value.replace(/\D/g, '');
  if (!nss) return 'El NSS es obligatorio';
  if (nss.length !== NSS_LENGTH) return `El NSS tiene ${NSS_LENGTH} dígitos`;
  if (!luhnValid(nss)) return 'El NSS no es válido: el dígito verificador no corresponde';
  return undefined;
}

// ---------- Empresas (consola de la plataforma) ----------
const COMPANY_RFC_RE = /^[A-ZÑ&]{3}(\d{2})(\d{2})(\d{2})[A-Z\d]{2}[\dA]$/;

/** RFC de empresa: persona moral (12) o persona física con actividad empresarial (13). */
export function validateCompanyRfc(value: string): string | undefined {
  const rfc = normalizeRfc(value);
  if (!rfc) return 'El RFC es obligatorio';
  if (rfc.length === RFC_LENGTH) return validateRfc(rfc);
  if (GENERIC_RFCS.has(rfc)) return 'Captura el RFC de la empresa; el RFC genérico no es válido';
  const match = COMPANY_RFC_RE.exec(rfc);
  if (!match) return 'El RFC debe tener 12 caracteres (persona moral) o 13 (persona física)';
  if (!rfcDateIsValid(Number(match[1]), Number(match[2]), Number(match[3]))) return 'La fecha del RFC (aammdd) no es válida';
  return undefined;
}

export function validateCompanyName(value: string, label: string): string | undefined {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return `${label} es obligatorio`;
  if (name.length > 200) return 'Máximo 200 caracteres';
  return undefined;
}

/** Límite de empleados del plan: vacío (sin límite) o un entero de 1 a 1 000 000. */
export function validateMaxEmployees(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? undefined : 'Escribe un número entero mayor a 0';
}

/** Fecha máxima (YYYY-MM-DD, hora LOCAL) para el selector: edad mínima cumplida hoy. */
export function maxBirthDate(today: Date = new Date()): string {
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - MIN_EMPLOYEE_AGE);
  // No usar toISOString(): en UTC puede ser ya "mañana" y el validador rechazaría la fecha.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
