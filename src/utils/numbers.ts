import { currentLocale, t } from '../i18n/core';

/**
 * Formatos de cantidades (dinero, porcentajes, bytes, tiempo, distancias, conteos y listas) en el
 * idioma activo (`currentLocale()`): es-MX y en-US. Son de presentación: los cálculos de dinero los
 * hace siempre el backend (decimales exactos); aquí solo se muestran. Cada formato se crea una vez
 * por idioma y opciones; al cambiar el idioma la siguiente llamada ya usa el nuevo.
 */

const EMPTY = '—';
const numberFormats = new Map<string, Intl.NumberFormat>();

/** Formato de números en el idioma activo (en caché por idioma y opciones). */
export function localeNumberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const locale = currentLocale();
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, format);
  }
  return format;
}

/** Dinero del contrato ("1234.50") como número; vacío o inválido → 0. */
export function moneyValue(value: string | number | null | undefined): number {
  const number = typeof value === 'number' ? value : Number(value ?? '');
  return Number.isFinite(number) ? number : 0;
}

/**
 * Dinero en SU moneda (el código ISO 4217 que el backend envía con cada importe: MXN, USD, EUR...), sin
 * ambigüedad y igual en los dos idiomas: el símbolo corto, el monto con los separadores del idioma activo y
 * SIEMPRE el código ISO al final ("$1,234.50 MXN", "$1,234.50 USD", "€1,234.50 EUR"). Decisión: la
 * plataforma cobra en varias monedas y "$" es tanto peso como dólar; con el código, un importe nunca se
 * confunde aunque se vea junto a otros de otra moneda. Los decimales son los de la moneda (ISO 4217, los
 * mismos del catálogo `currencies`). Sin valor o sin moneda (una empresa sin plan ni movimientos), "—".
 */
export function formatMoney(value: string | number | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined || value === '' || !currency) return EMPTY;
  const amount = localeNumberFormat({ style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(moneyValue(value));
  // Espacio que no se parte: el código nunca queda solo en otra línea de una tabla angosta.
  return `${amount}\u00a0${currency}`;
}

/** Número con separador de miles y hasta `digits` decimales: 1234.5 → "1,234.5". */
export function formatNumber(value: number | null | undefined, digits = 3): string {
  return value === null || value === undefined ? EMPTY : localeNumberFormat({ maximumFractionDigits: digits }).format(value);
}

/** Porcentaje de 0 a 100 (no una proporción): 16 → "16 %" (es-MX) o "16%" (en-US); 12.34 → "12.3 %". */
export function formatRate(value: string | number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || value === '') return EMPTY;
  return t('format.percent', { value: formatNumber(moneyValue(value), digits) });
}

/** Conteo con separador de miles: 12345 → "12,345". */
export function formatCount(value: number | null | undefined): string {
  return formatNumber(value);
}

/** Conteo para el eje de una gráfica (la mitad del máximo puede no ser entera): 2,000.5 → "2,001". */
export function formatAxisCount(value: number): string {
  return formatCount(Math.round(value));
}

/** Bytes en un megabyte (base 1024, como el almacenamiento y la red se miden en la plataforma). */
export const BYTES_PER_MB = 1024 * 1024;
const MB_FORMAT: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * Toda medición de datos se muestra en MB (decisión del dueño del producto: una sola unidad para comparar
 * sin convertir): 0 → "0 MB", 1536 → "< 0.01 MB", 5 242 880 → "5.00 MB", 3 GB → "3,072.00 MB".
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return EMPTY;
  const megabytes = Math.max(0, bytes) / BYTES_PER_MB;
  if (megabytes === 0) return `${localeNumberFormat().format(0)} MB`;
  if (megabytes < 0.01) return `< ${localeNumberFormat(MB_FORMAT).format(0.01)} MB`;
  return `${localeNumberFormat(MB_FORMAT).format(megabytes)} MB`;
}

/** Tiempo de proceso legible: "850 ms", "12.4 s", "3.5 min", "2.1 h" (mismas unidades en ambos idiomas). */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return EMPTY;
  const value = Math.max(0, ms);
  if (value < 1000) return `${formatNumber(value, 1)} ms`;
  if (value < 60_000) return `${formatNumber(value / 1000, 1)} s`;
  if (value < 3_600_000) return `${formatNumber(value / 60_000, 1)} min`;
  return `${formatNumber(value / 3_600_000, 1)} h`;
}

/**
 * Distancia en el sistema métrico (los radios y las distancias del backend van en metros, también en
 * en-US): "350 m"; desde un kilómetro, "1.2 km" (`kmDigits` decimales como máximo).
 */
export function formatDistance(meters: number, kmDigits = 1): string {
  return meters >= 1000 ? `${formatNumber(meters / 1000, kmDigits)} km` : `${formatNumber(Math.round(meters), 0)} m`;
}

/** Radio de un sitio o de un validador: "100 m" o "1.5 km" (hasta 3 decimales en km), con los separadores del idioma activo. */
export function metersText(meters: number): string {
  return formatDistance(meters, 3);
}

/** Nombres unidos como se dicen en el idioma activo: "Ana, Luis y Eva" / "Ana, Luis, and Eva" ("o"/"or" con `disjunction`). */
export function formatList(items: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  return new Intl.ListFormat(currentLocale(), { type }).format(items);
}
