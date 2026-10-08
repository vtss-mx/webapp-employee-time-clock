import { describe, expect, it } from 'vitest';
import { CameraTurnedError, cameraProblemText, describeCameraProblem, detectPlatform, errorKind, isInAppBrowser, secureUrlFor, type CameraProblemKind, type Platform } from './cameraDiagnostics';

/** Los textos del problema en el idioma activo (es-MX en las pruebas). */
const textOf = (...args: [CameraProblemKind, Platform?, Parameters<typeof describeCameraProblem>[2]?]) => cameraProblemText(describeCameraProblem(...args));

const UA = {
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  other: 'CustomAgent/1.0',
};

const lanHttp = { protocol: 'http:', hostname: '192.168.1.76', pathname: '/employee/enroll', search: '?x=1' };
const local = { protocol: 'http:', hostname: 'localhost', pathname: '/', search: '' };
const mac: Platform = { os: 'macos', browser: 'chrome' };

describe('detectPlatform', () => {
  it.each([
    [UA.macChrome, 0, { os: 'macos', browser: 'chrome' }],
    [UA.macSafari, 0, { os: 'macos', browser: 'safari' }],
    [UA.macFirefox, 0, { os: 'macos', browser: 'firefox' }],
    [UA.macSafari, 5, { os: 'ios', browser: 'safari' }], // iPadOS se presenta como Mac
    [UA.winEdge, 0, { os: 'windows', browser: 'edge' }],
    [UA.iphone, 5, { os: 'ios', browser: 'safari' }],
    [UA.iphoneChrome, 5, { os: 'ios', browser: 'chrome' }],
    [UA.android, 5, { os: 'android', browser: 'chrome' }],
    [UA.linux, 0, { os: 'linux', browser: 'firefox' }],
    [UA.other, 0, { os: 'other', browser: 'other' }],
  ])('identifica %s', (ua, touch, expected) => {
    expect(detectPlatform(ua, touch)).toEqual(expected);
  });

  it('usa el navegador actual por defecto', () => {
    expect(detectPlatform()).toHaveProperty('os');
  });
});

describe('errorKind', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['TypeError', 'unknown'],
  ])('%s → %s', (name, kind) => {
    expect(errorKind(new DOMException('x', name))).toBe(kind);
  });

  it('acepta Error y valores que no son errores', () => {
    const error = new Error('x');
    error.name = 'NotAllowedError';
    expect(errorKind(error)).toBe('denied');
    expect(errorKind('texto')).toBe('unknown');
    expect(errorKind(null)).toBe('unknown');
  });
});

describe('secureUrlFor', () => {
  it('propone la dirección HTTPS equivalente en la red local', () => {
    expect(secureUrlFor(lanHttp)).toBe('https://192.168.1.76:8443/employee/enroll?x=1');
  });

  it('no propone nada en localhost ni si ya es HTTPS', () => {
    expect(secureUrlFor(local)).toBeUndefined();
    expect(secureUrlFor({ ...local, hostname: '127.0.0.1' })).toBeUndefined();
    expect(secureUrlFor({ ...lanHttp, protocol: 'https:' })).toBeUndefined();
  });
});

describe('describeCameraProblem', () => {
  it('conexión insegura: ofrece la versión HTTPS', () => {
    const problem = describeCameraProblem('insecure', mac, lanHttp);
    expect(problem.secureUrl).toBe('https://192.168.1.76:8443/employee/enroll?x=1');
    expect(cameraProblemText(problem).steps.join(' ')).toContain('certificado');
  });

  it('conexión insegura sin dirección alternativa', () => {
    const problem = describeCameraProblem('insecure', mac, { ...lanHttp, protocol: 'https:' });
    expect(problem.secureUrl).toBeUndefined();
    expect(cameraProblemText(problem).steps).toEqual(['Entra a la aplicación con una dirección https://.']);
  });

  it('navegador sin soporte', () => {
    expect(textOf('unsupported', mac, local).title).toContain('navegador');
  });

  it.each<[Platform, string]>([
    [{ os: 'macos', browser: 'chrome' }, 'Privacidad y seguridad → Cámara → activa Chrome'],
    [{ os: 'macos', browser: 'safari' }, 'menú Safari → Ajustes → Sitios web'],
    [{ os: 'windows', browser: 'edge' }, 'Permitir que las aplicaciones de escritorio'],
    [{ os: 'windows', browser: 'firefox' }, 'cámara tachada'],
    [{ os: 'ios', browser: 'safari' }, 'Ajustes → Safari → Cámara'],
    [{ os: 'ios', browser: 'chrome' }, 'Ajustes → Chrome → Cámara'],
    [{ os: 'android', browser: 'chrome' }, 'Aplicaciones → Chrome → Permisos'],
    [{ os: 'linux', browser: 'other' }, 'permisos del sitio'],
  ])('permiso denegado en %o', (platform, expected) => {
    const { steps } = textOf('denied', platform, local);
    expect(steps.join(' ')).toContain(expected);
    expect(steps.at(-1)).toBe('Pulsa "Reintentar".');
  });

  it('Linux sin pasos del sistema: solo sitio y reintentar', () => {
    expect(textOf('denied', { os: 'linux', browser: 'chrome' }, local).steps).toHaveLength(2);
  });

  it('sin cámara en Mac: Informe del sistema, antivirus y Mac sin cámara integrada', () => {
    const steps = textOf('not-found', mac, local).steps.join(' ');
    expect(steps).toContain('Informe del sistema → Cámara');
    expect(steps).toContain('Kaspersky');
    expect(steps).toContain('Mac mini');
  });

  it('sin cámara en Windows y otros sistemas', () => {
    expect(textOf('not-found', { os: 'windows', browser: 'edge' }, local).steps.join(' ')).toContain('Administrador de dispositivos');
    expect(textOf('not-found', { os: 'android', browser: 'chrome' }, local).steps).toHaveLength(2);
  });

  it('cámara ocupada: menciona antivirus solo en escritorio', () => {
    expect(textOf('busy', mac, local).steps.join(' ')).toContain('antivirus');
    expect(textOf('busy', { os: 'ios', browser: 'safari' }, local).steps.join(' ')).not.toContain('antivirus');
  });

  it('error desconocido y valores por defecto', () => {
    expect(describeCameraProblem('unknown', mac, local).kind).toBe('unknown');
    expect(textOf('unknown').title).toContain('cámara');
  });
});

describe('navegadores integrados de otras aplicaciones y lienzos alterados', () => {
  const IN_APP = {
    instagramIos: `${UA.iphone} Instagram 350.0.0.30.85 (iPhone15,2; iOS 18_0; es_MX)`,
    facebookAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0]',
    tiktok: `${UA.android} musical_ly_2023 BytedanceWebview/d8a21c6`,
    linkedin: `${UA.iphone} LinkedInApp/9.30`,
    whatsappIos: `${UA.iphone} WAiOS/24.20`,
    webView: 'Mozilla/5.0 (Linux; Android 13; SM-A135F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36',
  };

  it('reconoce los navegadores integrados; Safari, Chrome, Edge y Firefox (también en iOS) no lo son', () => {
    Object.values(IN_APP).forEach((ua) => expect(isInAppBrowser(ua)).toBe(true));
    [UA.iphone, UA.iphoneChrome, UA.android, UA.macSafari, UA.winEdge, UA.linux].forEach((ua) => expect(isInAppBrowser(ua)).toBe(false));
    expect(isInAppBrowser()).toBe(false); // el navegador de las pruebas
  });

  it('si la cámara ya falló dentro de uno, la ayuda es abrir la página en el navegador del teléfono', () => {
    const ios: Platform = { os: 'ios', browser: 'safari' };
    const android: Platform = { os: 'android', browser: 'chrome' };
    (['denied', 'unsupported', 'unknown'] as const).forEach((kind) => expect(describeCameraProblem(kind, ios, local, true).kind).toBe('in-app'));
    // Lo que no se arregla cambiando de navegador conserva su ayuda; sin conexión segura, también.
    (['busy', 'not-found', 'insecure'] as const).forEach((kind) => expect(describeCameraProblem(kind, ios, local, true).kind).toBe(kind));
    const onIphone = cameraProblemText(describeCameraProblem('denied', ios, local, true));
    expect(onIphone.title).toBe('Abre esta página en tu navegador');
    expect(onIphone.steps[0]).toContain('Abrir en Safari');
    expect(onIphone.steps[1]).toContain('copia el enlace');
    expect(cameraProblemText(describeCameraProblem('denied', android, local, true)).steps[0]).toContain('Abrir en Chrome');
  });

  it('un lienzo alterado explica cómo permitirlo o cambiar de navegador', () => {
    const text = textOf('canvas-blocked', mac, local);
    expect(text.title).toBe('Tu navegador oculta la imagen de la cámara');
    expect(text.steps).toHaveLength(2);
  });

  it('la cámara girada a media toma se explica en el idioma activo', () => {
    const error = new CameraTurnedError();
    expect(error.name).toBe('CameraTurnedError');
    expect(error.message).toBe('La cámara cambió de orientación. Mantén el teléfono en la misma posición.');
  });
});
