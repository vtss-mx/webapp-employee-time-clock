/**
 * Backend falso para las pruebas del idioma (regla 16): responde cada ruta de la API que piden las pantallas con
 * datos de prueba y, como el backend real, con sus textos (`message`, `errors[].message`, `i18n` y los textos del
 * servidor dentro de `data`) en el idioma de la petición (`Accept-Language`). Así una pantalla que se queda con
 * textos del idioma anterior después de un cambio en caliente se nota: el servidor ya respondería en el nuevo.
 *
 * Cada ruta se declara con `route(método, plantilla, manejador)`; una petición sin ruta responde 404 y queda en
 * `unhandled` (la prueba lo exige vacío: cada pantalla se dibuja con datos reales, no con un error).
 */
import { isLocale, LOCALES, type Locale } from '../../i18n/core';
import { jsonResponse, type MockCall } from '../http';

export interface Ctx {
  locale: Locale;
  method: string;
  path: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: unknown;
}

/** Lo que responde una ruta: los datos (`data`) o una respuesta ya armada. */
export type Handler = (ctx: Ctx) => unknown;

export interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
  /** Sin efectos (como un GET): sus datos se comparan en los dos idiomas para reconocer los que escribió una persona. */
  pure: boolean;
}

/** Una ruta de la API (`/employees/:id`), sin el prefijo `/api`. `pure`: un POST sin efectos (renovar la sesión). */
export function route(method: string, template: string, handler: Handler, pure = method === 'GET'): Route {
  const keys: string[] = [];
  const source = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, (_, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { method, pattern: new RegExp(`^${source}$`), keys, handler, pure };
}

export const get = (template: string, handler: Handler) => route('GET', template, handler);

/** Un texto del servidor en cada idioma de la petición (los siete, como el backend real). */
export type Texts = Readonly<Record<Locale, string>>;
export const say = (texts: Texts): Texts => texts;
export const tx = (ctx: Pick<Ctx, 'locale'>, texts: Texts) => texts[ctx.locale];

/** Mensaje genérico de una respuesta exitosa (el de cada ruta real varía; aquí basta uno en cada idioma). */
const DONE = say({ 'es-MX': 'Listo', 'en-US': 'Done', 'pt-BR': 'Pronto', 'fr-FR': 'Terminé', 'de-DE': 'Fertig', 'it-IT': 'Fatto', 'es-ES': 'Listo' });

/** Respuesta con el contrato único, sus textos en el idioma de la petición y en cada idioma (`i18n`). */
export function envelopeOf(locale: Locale, status: number, code: string, data: unknown, message: Texts, errors: Array<{ code: string; message: Texts; field?: string | null }> = []): Response {
  return jsonResponse(
    {
      success: status < 400,
      statusCode: status,
      code,
      message: message[locale],
      data,
      errors: errors.map((error) => ({ code: error.code, message: error.message[locale], field: error.field ?? null, details: null })),
      traceId: 'trace-language',
      timestamp: '2026-10-06T15:00:00.000Z',
      i18n: Object.fromEntries(LOCALES.map((each) => [each, { message: message[each], errors: errors.map((error) => error.message[each]) }])),
    },
    status,
    { 'Content-Language': locale },
  );
}

/** Falla con su mensaje en cada idioma (p. ej. una regla de negocio al guardar). */
export class Fail {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly message: Texts,
  ) {}
}

function localeOf(init: RequestInit): Locale {
  const requested = new Headers(init.headers).get('Accept-Language');
  return isLocale(requested) ? requested : 'es-MX';
}

function bodyOf(init: RequestInit): unknown {
  if (typeof init.body !== 'string') return init.body ?? null;
  try {
    return JSON.parse(init.body) as unknown;
  } catch {
    return init.body;
  }
}

/** Los textos que son iguales en dos idiomas distintos en la misma posición de los datos: los escribió una persona. */
function sameStrings(one: unknown, other: unknown, into: Set<string>): void {
  if (typeof one === 'string') {
    if (one === other) into.add(one);
    return;
  }
  if (typeof one !== 'object' || one === null || typeof other !== 'object' || other === null) return;
  for (const [key, value] of Object.entries(one)) sameStrings(value, (other as Record<string, unknown>)[key], into);
}

/** Rutas cuyos textos SIEMPRE se revisan aunque sean iguales en los dos idiomas: los catálogos de la BD. */
const ALWAYS_CHECKED = new Set(['/catalogs']);

/**
 * El backend falso: `respond` sirve de `mockFetch`, `unhandled` junta las peticiones sin ruta y `data` los textos
 * que escribió una persona (nombres, correos, notas): los que una lectura devuelve iguales en inglés y en el idioma pedido
 * (o en español, si se pidió inglés). No
 * son de ningún idioma y la prueba no los revisa; todo texto del servidor (uno que cambia con el idioma) sí.
 */
export function fakeBackend(routes: readonly Route[], { failWrites }: { failWrites?: Texts } = {}) {
  const unhandled = new Set<string>();
  const requests: string[] = [];
  const data = new Set<string>();
  const respond = (call: MockCall): Response => {
    const url = new URL(call.url, 'http://localhost');
    const path = url.pathname.replace(/^\/api/, '');
    const method = (call.init.method ?? 'GET').toUpperCase();
    const locale = localeOf(call.init);
    requests.push(`${method} ${path}`);
    // Cada escritura falla con un mensaje del servidor (409): así queda abierto el popup de un error del servidor.
    const writes = failWrites && method !== 'GET' && !routes.some((candidate) => candidate.pure && candidate.method === method && candidate.pattern.test(path));
    if (writes) return envelopeOf(locale, 409, 'CONFLICT', null, failWrites, [{ code: 'CONFLICT', message: failWrites }]);
    for (const candidate of routes) {
      if (candidate.method !== method) continue;
      const match = candidate.pattern.exec(path);
      if (!match) continue;
      const params = Object.fromEntries(candidate.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
      const ctx: Ctx = { locale, method, path, query: url.searchParams, params, body: bodyOf(call.init) };
      const result = candidate.handler(ctx);
      if (candidate.pure && !ALWAYS_CHECKED.has(path)) sameStrings(result, candidate.handler({ ...ctx, locale: locale === 'en-US' ? 'es-MX' : 'en-US' }), data);
      if (result instanceof Response) return result;
      if (result instanceof Fail) return envelopeOf(locale, result.status, result.code, null, result.message, [{ code: result.code, message: result.message }]);
      return envelopeOf(locale, method === 'POST' ? 201 : 200, 'OK', result ?? null, DONE);
    }
    unhandled.add(`${method} ${path}`);
    return envelopeOf(locale, 404, 'NOT_FOUND', null, say({ 'es-MX': 'No encontrado', 'en-US': 'Not found', 'pt-BR': 'Não encontrado', 'fr-FR': 'Introuvable', 'de-DE': 'Nicht gefunden', 'it-IT': 'Non trovato', 'es-ES': 'No encontrado' }), [{ code: 'NOT_FOUND', message: say({ 'es-MX': 'No encontrado', 'en-US': 'Not found', 'pt-BR': 'Não encontrado', 'fr-FR': 'Introuvable', 'de-DE': 'Nicht gefunden', 'it-IT': 'Non trovato', 'es-ES': 'No encontrado' }) }]);
  };
  return { respond, unhandled, requests, data };
}

/** Página de resultados como la envía el backend. */
export const pageOf = <T>(items: readonly T[], extra: Record<string, unknown> = {}) => ({ items, total: items.length, page: 1, size: 10, ...extra });
