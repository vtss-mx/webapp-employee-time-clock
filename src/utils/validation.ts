import { t } from '../i18n/core';
import { config } from './config';
import { businessDate, localeDateFormat, NUMERIC_DATE } from './format';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .-]*$/;
const EMPLOYEE_NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,29}$/;
// RFC de persona física (SAT): 4 letras, fecha aammdd y homoclave de 3 (el último, dígito o "A").
const RFC_RE = /^[A-ZÑ&]{4}(\d{2})(\d{2})(\d{2})[A-Z\d]{2}[\dA]$/;
const GENERIC_RFCS = new Set(['XAXX010101000', 'XEXX010101000']);
export const RFC_LENGTH = 13;
/** RFC y CURP de ejemplo de los mensajes de formato (códigos: no se traducen). */
const RFC_EXAMPLE = 'PEGJ900515AB1';
const CURP_EXAMPLE = 'HEGG560427MVZRRL04';
export const MIN_EMPLOYEE_AGE = config.minEmployeeAge;
/**
 * Largo mínimo de la contraseña en la validación del cliente (solo UX: el servidor la vuelve a validar con su
 * `PASSWORD_MIN_LENGTH` y puede exigir más). Subió de 8 a 12 con la migración 0096 del backend: doce caracteres
 * son lo que piden hoy los controles de acceso que se auditan (SOC 2 CC6.1, ISO A.5.17, Cyber Essentials).
 */
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;
const NAME_MAX = 100;
const COMPANY_NAME_MAX = 200;

/*
 * Los mensajes se traducen al validar: las reglas corren al dibujar el formulario, así que un error
 * visible cambia de idioma junto con la pantalla (nunca se guarda el texto ya traducido).
 */

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return t('forms.validation.email.required');
  if (!EMAIL_RE.test(value.trim())) return t('forms.validation.email.invalid');
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return t('forms.validation.password.required');
  if (value.length < PASSWORD_MIN) return t('forms.validation.minChars', { min: PASSWORD_MIN });
  if (value.length > PASSWORD_MAX) return t('forms.validation.maxChars', { max: PASSWORD_MAX });
  if (!/[a-z]/.test(value)) return t('forms.validation.password.lowercase');
  if (!/[A-Z]/.test(value)) return t('forms.validation.password.uppercase');
  if (!/\d/.test(value)) return t('forms.validation.password.digit');
  return undefined;
}

/**
 * Códigos con que el servidor rechaza una contraseña (migración 0096: largo, filtradas y reciclada) llevados al
 * CAMPO de la contraseña, no solo al popup: lo que hay que corregir es ese campo. Es UNA definición que usan
 * todos los formularios que asignan o cambian una contraseña (`field` es el nombre del campo en cada uno).
 */
export function passwordErrorFields<T>(field: keyof T): Partial<Record<string, keyof T>> {
  return {
    PASSWORD_TOO_SHORT: field,
    PASSWORD_BREACHED: field,
    PASSWORD_REUSED: field,
    PASSWORD_REQUIRED: field,
    new_password: field,
    password: field,
  };
}

/** Repetir la contraseña (toda contraseña que se asigna se confirma: evita errores de dedo). */
export function validatePasswordConfirm(password: string, confirm: string): string | undefined {
  if (!confirm) return t('forms.validation.password.repeat');
  return confirm === password ? undefined : t('forms.validation.password.mismatch');
}

/**
 * `required`: el aviso completo de campo vacío, ya traducido ("El nombre es obligatorio"): cada campo
 * da el suyo porque el género y el número cambian ("La razón social es obligatoria").
 */
export function validateName(value: string, required: string): string | undefined {
  const v = value.trim();
  if (!v) return required;
  if (v.length > NAME_MAX) return t('forms.validation.maxChars', { max: NAME_MAX });
  if (!NAME_RE.test(v)) return t('forms.validation.name.characters');
  return undefined;
}

export function validateBirthDate(value: string): string | undefined {
  if (!value) return t('forms.validation.birthDate.required');
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return t('forms.validation.birthDate.invalid');
  const today = businessDate();
  if (date >= today) return t('forms.validation.birthDate.notBeforeToday');
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  if (age < MIN_EMPLOYEE_AGE) return t('forms.validation.birthDate.minAge', { age: MIN_EMPLOYEE_AGE });
  if (age > 100) return t('forms.validation.birthDate.invalid');
  return undefined;
}

/** El número de empleado es opcional: vacío no es un error; con valor, su formato (el backend revisa que sea único). */
export function validateEmployeeNumber(value: string): string | undefined {
  const number = value.trim();
  if (number && !EMPLOYEE_NUMBER_RE.test(number)) return t('forms.validation.employeeNumber.format');
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

/**
 * Fecha numérica en el orden y con los separadores del idioma activo ("01/09/2003" en es-MX,
 * "09/01/2003" en en-US). Las partes se ponen tal cual: la fecha de un documento puede no existir
 * en el siglo de la fecha capturada (29 de febrero) y aun así se muestra como está escrita.
 */
function numericDate(year: string, month: string, day: string): string {
  const parts = { year, month, day } as Partial<Record<Intl.DateTimeFormatPartTypes, string>>;
  return localeDateFormat(NUMERIC_DATE)
    .formatToParts(0)
    .map((part) => parts[part.type] ?? part.value)
    .join('');
}

/** "El RFC indica nacimiento el 01/09/2003, pero la fecha de nacimiento es 03/09/2003" (mismo texto que el backend). */
function birthDateMismatch(document: 'rfc' | 'curp', yymmdd: string, birthIso: string): string {
  const [year, month, day] = birthIso.split('-');
  // La fecha aammdd del documento, con el siglo de la fecha capturada.
  const documentDate = numericDate(`${birthIso.slice(0, 2)}${yymmdd.slice(0, 2)}`, yymmdd.slice(2, 4), yymmdd.slice(4, 6));
  return t(`forms.validation.${document}.birthMismatch`, { document: documentDate, birth: numericDate(year, month, day) });
}

/*
 * RFC, CURP y NSS del empleado son OPCIONALES (decisión del dueño del producto: la plataforma se abre a otros
 * países): vacíos no tienen nada que validar; con valor, las mismas reglas que el backend.
 */

/** Mismas reglas que el backend; con `birthDate` (ISO) verifica también que coincida la fecha. Vacío: opcional. */
export function validateRfc(value: string, birthDate?: string): string | undefined {
  const rfc = normalizeRfc(value);
  if (!rfc) return undefined;
  if (GENERIC_RFCS.has(rfc)) return t('forms.validation.rfc.generic');
  if (rfc.length !== RFC_LENGTH) return t('forms.validation.rfc.length', { length: RFC_LENGTH, current: rfc.length });
  const match = RFC_RE.exec(rfc);
  if (!match) return t('forms.validation.rfc.format', { example: RFC_EXAMPLE });
  if (!rfcDateIsValid(Number(match[1]), Number(match[2]), Number(match[3]))) return t('forms.validation.rfc.date');
  const birthIso = birthDate ?? '';
  const birth = /^\d{2}(\d{2})-(\d{2})-(\d{2})$/.exec(birthIso);
  if (birth && rfc.slice(4, 10) !== `${birth[1]}${birth[2]}${birth[3]}`) return birthDateMismatch('rfc', rfc.slice(4, 10), birthIso);
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

/** Vacía: opcional (sin capturar). */
export function validateCurp(value: string, birthDate?: string): string | undefined {
  const curp = normalizeCurp(value);
  if (!curp) return undefined;
  if (curp.length !== CURP_LENGTH) return t('forms.validation.curp.length', { length: CURP_LENGTH, current: curp.length });
  const match = CURP_RE.exec(curp);
  if (!match) return t('forms.validation.curp.format', { example: CURP_EXAMPLE });
  if (!rfcDateIsValid(Number(match[1]), Number(match[2]), Number(match[3]))) return t('forms.validation.curp.date');
  if (curpCheckDigit(curp.slice(0, 17)) !== curp[17]) return t('forms.validation.curp.checkDigit');
  const birthIso = birthDate ?? '';
  const birth = /^(\d{2})(\d{2})-(\d{2})-(\d{2})$/.exec(birthIso);
  if (birth) {
    if (curp.slice(4, 10) !== `${birth[2]}${birth[3]}${birth[4]}`) return birthDateMismatch('curp', curp.slice(4, 10), birthIso);
    if (/\d/.test(curp[16]) !== Number(`${birth[1]}${birth[2]}`) < 2000) return t('forms.validation.curp.century');
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

/** Vacío: opcional (sin capturar). */
export function validateNss(value: string): string | undefined {
  const nss = value.replace(/\D/g, '');
  if (!nss) return undefined;
  if (nss.length !== NSS_LENGTH) return t('forms.validation.nss.length', { length: NSS_LENGTH });
  if (!luhnValid(nss)) return t('forms.validation.nss.checkDigit');
  return undefined;
}

// ---------- Empresas (consola de la plataforma) ----------
const COMPANY_RFC_RE = /^[A-ZÑ&]{3}(\d{2})(\d{2})(\d{2})[A-Z\d]{2}[\dA]$/;

/**
 * RFC de empresa: persona moral (12) o persona física con actividad empresarial (13). Vacío: opcional (sin capturar),
 * como los documentos del empleado (decisión del dueño del producto: la plataforma se abre a otros países).
 */
export function validateCompanyRfc(value: string): string | undefined {
  const rfc = normalizeRfc(value);
  if (!rfc) return undefined;
  // 13 caracteres: persona física (validateRfc también rechaza los RFC genéricos, que tienen 13).
  if (rfc.length === RFC_LENGTH) return validateRfc(rfc);
  const match = COMPANY_RFC_RE.exec(rfc);
  if (!match) return t('forms.validation.rfc.companyLength');
  if (!rfcDateIsValid(Number(match[1]), Number(match[2]), Number(match[3]))) return t('forms.validation.rfc.date');
  return undefined;
}

/** `required`: el aviso completo de campo vacío, ya traducido ("La razón social es obligatoria"). */
export function validateCompanyName(value: string, required: string): string | undefined {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return required;
  if (name.length > COMPANY_NAME_MAX) return t('forms.validation.maxChars', { max: COMPANY_NAME_MAX });
  return undefined;
}

/** Límite de empleados del plan: vacío (sin límite) o un entero de 1 a 1 000 000. */
export function validateMaxEmployees(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? undefined : t('forms.validation.maxEmployees');
}

/** Fecha máxima (YYYY-MM-DD) para el selector: edad mínima cumplida hoy (en la zona del negocio). */
export function maxBirthDate(today: Date = businessDate()): string {
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - MIN_EMPLOYEE_AGE);
  // No usar toISOString(): en UTC puede ser ya "mañana" y el validador rechazaría la fecha.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
