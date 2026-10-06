/**
 * Plantilla de una ruta: la pantalla o la API sin los datos que identifican un registro. La usan la analítica de
 * uso (`services/analytics.ts`) y los observadores de rendimiento (`services/perf`): ninguno envía ids, query ni
 * fragmentos (pueden llevar datos de la persona), solo esta plantilla.
 */

/** Un segmento de la ruta que identifica un registro: número, UUID o token largo con dígitos. */
const ID_SEGMENT = /^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?=.*\d)[\w-]{16,})$/i;

/** La ruta sin datos: los segmentos que identifican un registro se vuelven `{id}` (sin query ni hash). */
export function routeTemplate(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  const segments = path.split('/').map((segment) => (ID_SEGMENT.test(segment) ? '{id}' : segment));
  return segments.join('/') || '/';
}
