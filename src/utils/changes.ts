import type { ConfirmDetail, FieldChange } from '../types/confirm';

/**
 * Cómo se muestra un campo en una confirmación: su nombre y, si hace falta, cómo leer su valor
 * (un id → su nombre, un código → su texto del catálogo, una fecha → "10 may 1990").
 * `format` es un método (no una propiedad) para que un formato de un tipo concreto sirva en la lista.
 */
export interface FieldLabel<V = unknown> {
  label: string;
  format?(value: V): string;
  /** Dato secreto (contraseña): nunca se muestra su valor, solo que se cambia. */
  secret?: boolean;
}

/** Campos que se muestran, en este orden; los que no estén aquí no se comparan ni se muestran. */
export type FieldLabels<T> = { [K in keyof T]?: string | FieldLabel<T[K]> };

/** Un campo sin valor en la confirmación ("Teléfono: Sin capturar → 662 123 4567"). */
export const EMPTY_VALUE = 'Sin capturar';
/** Lo único que se dice de un secreto: que se asigna uno nuevo. */
export const SECRET_VALUE = '••••••••';

const isEmpty = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0);

/** Mismo valor para la persona: los espacios sobrantes y "vacío" (null, '', []) no cuentan como cambio. */
function sameValue(a: unknown, b: unknown): boolean {
  if (isEmpty(a) || isEmpty(b)) return isEmpty(a) && isEmpty(b);
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  return JSON.stringify(a) === JSON.stringify(b);
}

function plainText(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/** Valor legible: el formato del campo, o el texto del valor; vacío → "Sin capturar". */
function readable(value: unknown, spec: FieldLabel): string {
  const text = spec.format ? spec.format(value) : isEmpty(value) ? '' : plainText(value);
  return text.trim() || EMPTY_VALUE;
}

/** Los campos de `labels` con su especificación completa, en el orden en que se declararon. */
function specs<T extends object>(labels: FieldLabels<T>): Array<[keyof T, FieldLabel]> {
  return (Object.keys(labels) as Array<keyof T>).map((field) => {
    const spec = labels[field] as string | FieldLabel;
    return [field, typeof spec === 'string' ? { label: spec } : spec];
  });
}

/**
 * Cambios de una edición para la confirmación: "Campo: antes → después", solo de los campos que
 * cambiaron. Una lista vacía significa "sin cambios" (la confirmación lo avisa y no se envía nada).
 */
export function describeChanges<T extends object>(before: T, after: T, labels: FieldLabels<T>): FieldChange[] {
  return specs(labels).flatMap(([field, spec]) => {
    if (sameValue(before[field], after[field])) return [];
    if (spec.secret) return [{ label: spec.label, before: SECRET_VALUE, after: 'Nueva' }];
    return [{ label: spec.label, before: readable(before[field], spec), after: readable(after[field], spec) }];
  });
}

/** Lo que se va a crear, para la confirmación: "Etiqueta: valor" de los campos con valor. */
export function describeValues<T extends object>(values: T, labels: FieldLabels<T>): ConfirmDetail[] {
  return specs(labels).flatMap(([field, spec]) => {
    if (isEmpty(values[field])) return [];
    return [{ label: spec.label, value: spec.secret ? SECRET_VALUE : readable(values[field], spec) }];
  });
}

/** "Ana, Luis y Eva": nombres unidos como se dicen en español. */
const joinNames = (names: readonly string[]) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`);

/**
 * A quiénes afecta una acción masiva, para su confirmación: hasta `max` nombres y "y N más" (`total`
 * puede incluir elegidos cuyo nombre no se conoce, p. ej. los de "Seleccionar los N de este filtro").
 * Sin ningún nombre conocido, solo cuántos son ("12 empleados").
 */
export function namesSummary(names: readonly string[], total: number, noun: { one: string; other: string }, max = 8): string {
  const shown = names.slice(0, max);
  if (!shown.length) return `${total} ${total === 1 ? noun.one : noun.other}`;
  const rest = total - shown.length;
  return rest > 0 ? `${shown.join(', ')} y ${rest} más` : joinNames(shown);
}
