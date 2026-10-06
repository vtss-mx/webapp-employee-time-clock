import type * as AnalyticsSdk from '@firebase/analytics';
import type { Analytics } from '@firebase/analytics';
import { config } from '../utils/config';
import { routeTemplate } from '../utils/routeTemplate';

/**
 * Analítica de uso con Firebase (Google Analytics 4), con candados de privacidad.
 *
 * Es una excepción documentada a la regla 13 de AGENTS.md (decisión del dueño del producto) y por eso
 * vive SOLO aquí:
 * - Se envían pantallas como plantilla (`/company/employees/{id}`: sin ids, sin query ni hash) y el rol
 *   de la cuenta; nunca nombres, correos, empresas ni identificadores. La URL real, el título de la
 *   pestaña y el sitio de origen se reemplazan en TODOS los eventos (también los automáticos).
 * - Sin señales de Google ni personalización de anuncios (consentimiento de anuncios negado).
 * - Se carga bajo demanda (import dinámico) solo si está habilitada y configurada; si el navegador no
 *   la soporta o algo falla, la app sigue igual: es de mejor esfuerzo, nunca lanza ni abre un popup.
 */

type Sdk = typeof AnalyticsSdk;
interface Session {
  sdk: Sdk;
  analytics: Analytics;
}

// La pantalla sin datos (`/company/employees/{id}`): la misma plantilla que usan los observadores de rendimiento.
export { routeTemplate };

let session: Promise<Session | null> | null = null;

function configured(): boolean {
  const { enabled, firebase } = config.analytics;
  return enabled && Boolean(firebase.apiKey && firebase.appId && firebase.measurementId);
}

async function load(): Promise<Session | null> {
  const [{ initializeApp }, sdk] = await Promise.all([import('@firebase/app'), import('@firebase/analytics')]);
  if (!(await sdk.isSupported())) return null;
  // Antes de iniciar: nada de anuncios ni datos para anuncios; solo la medición de uso.
  sdk.setConsent({ ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
  const analytics = sdk.initializeAnalytics(initializeApp(config.analytics.firebase), {
    config: { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false },
  });
  return { sdk, analytics };
}

/** Inicia la analítica una sola vez (si está habilitada y configurada). */
function current(): Promise<Session | null> | null {
  if (!configured()) return null;
  // De mejor esfuerzo: si el SDK no carga (red, bloqueador de anuncios), la app sigue sin medir.
  session ??= load().catch(() => null);
  return session;
}

/** Ejecuta `task` con la analítica lista (nada si está apagada o no cargó; un error no sale de aquí). */
function withSession(task: (current: Session) => void): void {
  void current()
    ?.then((ready) => {
      if (ready) task(ready);
    })
    // De mejor esfuerzo: medir nunca interrumpe a la persona.
    .catch(() => undefined);
}

/** Vista de una pantalla: solo su plantilla, en el evento y como dato por omisión de todos los demás. */
export function trackScreen(pathname: string): void {
  withSession(({ sdk, analytics }) => {
    const template = routeTemplate(pathname);
    const page = { page_location: `${window.location.origin}${template}`, page_path: template, page_title: config.appName };
    sdk.setDefaultEventParameters({ ...page, page_referrer: '' });
    sdk.logEvent(analytics, 'page_view', page);
  });
}

/** El rol de la cuenta (o ninguno al salir): permite ver el uso por tipo de usuario, sin identificarlo. */
export function trackRole(role: string | null): void {
  withSession(({ sdk, analytics }) => sdk.setUserProperties(analytics, { role: role ?? 'GUEST' }));
}

/** Olvida la sesión de analítica (para las pruebas). */
export function resetAnalytics(): void {
  session = null;
}
