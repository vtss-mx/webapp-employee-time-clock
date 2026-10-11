import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Configuración de la analítica que cada prueba ajusta (habilitada y con el proyecto de Firebase).
const analyticsConfig = vi.hoisted(() => ({
  enabled: true,
  firebase: { apiKey: 'clave', authDomain: 'x', projectId: 'p', storageBucket: 'b', messagingSenderId: '1', appId: 'app', measurementId: 'G-1' },
}));
vi.mock('../utils/config', () => ({ config: { appName: 'Employee Time Clock', analytics: analyticsConfig } }));

const sdk = vi.hoisted(() => ({
  isSupported: vi.fn(() => Promise.resolve(true)),
  setConsent: vi.fn(),
  initializeAnalytics: vi.fn(() => ({ app: 'analytics' })),
  setDefaultEventParameters: vi.fn(),
  logEvent: vi.fn(),
  setUserProperties: vi.fn(),
}));
const initializeApp = vi.hoisted(() => vi.fn(() => ({ name: 'app' })));
vi.mock('@firebase/analytics', () => sdk);
vi.mock('@firebase/app', () => ({ initializeApp }));

const { analyticsAvailable, resetAnalytics, routeTemplate, setAnalyticsConsent, trackRole, trackScreen } = await import('./analytics');
const DEFAULTS = structuredClone(analyticsConfig);
/** Deja correr las promesas pendientes (la carga del SDK es asíncrona). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  resetAnalytics();
  Object.assign(analyticsConfig, structuredClone(DEFAULTS));
  // La medición exige un «sí» explícito (ePrivacy); las pruebas de comportamiento parten de ahí.
  setAnalyticsConsent('granted');
});
afterEach(() => vi.clearAllMocks());

describe('routeTemplate', () => {
  it('quita ids, UUID, tokens, query y hash: solo queda la pantalla', () => {
    expect(routeTemplate('/company/employees/123/edit')).toBe('/company/employees/{id}/edit');
    expect(routeTemplate('/admin/errors/3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe('/admin/errors/{id}');
    expect(routeTemplate('/qr/aB3dE5fG7hI9jK1lM2')).toBe('/qr/{id}');
    expect(routeTemplate('/company/verifications?date=2026-10-04#fila')).toBe('/company/verifications');
    expect(routeTemplate('/company/employees/reverify-all')).toBe('/company/employees/reverify-all'); // palabras largas sin dígitos
    expect(routeTemplate('')).toBe('/');
  });
});

describe('analítica con candados', () => {
  it('pantalla como plantilla en el evento y en los datos por omisión; sin anuncios ni señales de Google', async () => {
    trackScreen('/company/employees/42');
    trackScreen('/company/sites');
    await settle();
    expect(initializeApp).toHaveBeenCalledTimes(1); // una sola carga
    expect(sdk.setConsent).toHaveBeenCalledWith({ ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    expect(sdk.initializeAnalytics).toHaveBeenCalledWith(
      { name: 'app' },
      { config: { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false } },
    );
    const page = { page_location: `${window.location.origin}/company/employees/{id}`, page_path: '/company/employees/{id}', page_title: 'Employee Time Clock' };
    expect(sdk.setDefaultEventParameters).toHaveBeenCalledWith({ ...page, page_referrer: '' });
    expect(sdk.logEvent).toHaveBeenCalledWith({ app: 'analytics' }, 'page_view', page);
    expect(sdk.logEvent).toHaveBeenCalledTimes(2);
  });

  it('el rol de la cuenta (sin identificarla); sin sesión, GUEST', async () => {
    trackRole('COMPANY');
    trackRole(null);
    await settle();
    expect(sdk.setUserProperties).toHaveBeenNthCalledWith(1, { app: 'analytics' }, { role: 'COMPANY' });
    expect(sdk.setUserProperties).toHaveBeenNthCalledWith(2, { app: 'analytics' }, { role: 'GUEST' });
  });

  it.each([
    ['apagada', { enabled: false }],
    ['sin proyecto configurado', { firebase: { ...DEFAULTS.firebase, measurementId: '' } }],
  ])('%s: no carga el SDK ni envía nada', async (_case, change) => {
    Object.assign(analyticsConfig, change);
    trackScreen('/company/dashboard');
    await settle();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(sdk.logEvent).not.toHaveBeenCalled();
  });

  it('navegador sin soporte o SDK que no carga: la app sigue sin medir', async () => {
    sdk.isSupported.mockResolvedValueOnce(false);
    trackScreen('/company/dashboard');
    await settle();
    expect(sdk.logEvent).not.toHaveBeenCalled();

    resetAnalytics();
    setAnalyticsConsent('granted'); // olvidar la sesión también olvida la respuesta: aquí interesa el SDK, no el permiso
    sdk.isSupported.mockRejectedValueOnce(new Error('bloqueado'));
    trackScreen('/company/dashboard');
    await settle();
    expect(sdk.logEvent).not.toHaveBeenCalled();
  });

  it('un error al enviar no sale de la analítica', async () => {
    sdk.logEvent.mockImplementationOnce(() => {
      throw new Error('gtag falló');
    });
    trackScreen('/company/dashboard');
    await settle();
    expect(sdk.logEvent).toHaveBeenCalledTimes(1);
  });
});

describe('consentimiento: sin un «sí» no se mide', () => {
  it('sin respuesta de la persona no carga el SDK ni toca el almacenamiento del navegador', async () => {
    setAnalyticsConsent(null);
    trackScreen('/company/sites');
    trackRole('COMPANY');
    await settle();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(sdk.setConsent).not.toHaveBeenCalled();
    expect(sdk.logEvent).not.toHaveBeenCalled();
  });

  it('al rechazar, lo ya cargado se olvida y no se vuelve a cargar', async () => {
    trackScreen('/company/sites');
    await settle();
    expect(initializeApp).toHaveBeenCalledTimes(1);
    setAnalyticsConsent('denied');
    trackScreen('/company/employees');
    await settle();
    expect(initializeApp).toHaveBeenCalledTimes(1); // no hay una segunda carga
    expect(sdk.logEvent).toHaveBeenCalledTimes(1); // ni un evento más
  });

  it('`analyticsAvailable` dice si este despliegue mide (para no preguntar de más)', () => {
    expect(analyticsAvailable()).toBe(true);
    analyticsConfig.enabled = false;
    expect(analyticsAvailable()).toBe(false);
  });
});
