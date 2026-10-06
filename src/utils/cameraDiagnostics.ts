/**
 * Diagnóstico de la cámara: identifica POR QUÉ no se puede usar y da los pasos exactos para el
 * sistema operativo y navegador del usuario (en vez de un mensaje genérico).
 */
import { t } from '../i18n/core';

export type CameraProblemKind = 'insecure' | 'unsupported' | 'denied' | 'not-found' | 'busy' | 'unknown';

/**
 * La cámara no da imagen al capturar: aún se está abriendo o se cortó (llamada o Siri en iOS, permiso
 * retirado, cámara desconectada). Es pasajero: el flujo facial espera y continúa al volver la imagen
 * en lugar de abandonar el proceso. Su texto se lee en el idioma activo (se muestra sobre la cámara).
 */
export class CameraNotReadyError extends Error {
  constructor() {
    super();
    this.name = 'CameraNotReadyError';
    Object.defineProperty(this, 'message', { get: () => t('face.camera.notReady'), configurable: true, enumerable: false });
  }
}

type Os = 'macos' | 'windows' | 'ios' | 'android' | 'linux' | 'other';
type Browser = 'safari' | 'chrome' | 'edge' | 'firefox' | 'other';

export interface Platform {
  os: Os;
  browser: Browser;
}

/**
 * Qué impide usar la cámara y dónde (sin textos: se escriben al mostrarse, en el idioma activo, con
 * `cameraProblemText`). Así un problema guardado en el estado sigue al idioma si este cambia.
 */
export interface CameraProblem {
  kind: CameraProblemKind;
  /** Sistema operativo y navegador: los pasos se escriben para ellos. */
  platform: Platform;
  /** Dirección HTTPS equivalente cuando se entró por http:// (la cámara exige conexión segura). */
  secureUrl?: string;
}

/** Los textos de un problema de la cámara: título, causa y pasos para resolverlo. */
export interface CameraProblemText {
  title: string;
  message: string;
  steps: string[];
}

const BROWSER_NAMES: Record<Exclude<Browser, 'other'>, string> = { safari: 'Safari', chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox' };
const browserName = (browser: Browser) => (browser === 'other' ? t('face.cameraHelp.yourBrowser') : BROWSER_NAMES[browser]);
/** Puerto HTTPS publicado por docker compose (8443 → 443 del contenedor de Nginx). */
const HTTPS_PORT = '8443';

export function detectPlatform(userAgent: string = navigator.userAgent, touchPoints: number = navigator.maxTouchPoints ?? 0): Platform {
  const ua = userAgent;
  // iPadOS se identifica como Mac de escritorio: se distingue por la pantalla táctil.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  const os: Os = ios
    ? 'ios'
    : /Android/.test(ua)
      ? 'android'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macos'
        : /Windows/.test(ua)
          ? 'windows'
          : /Linux/.test(ua)
            ? 'linux'
            : 'other';
  const browser: Browser = /Edg\//.test(ua)
    ? 'edge'
    : /Firefox\/|FxiOS/.test(ua)
      ? 'firefox'
      : /Chrome\/|CriOS/.test(ua)
        ? 'chrome'
        : /Safari\//.test(ua)
          ? 'safari'
          : 'other';
  return { os, browser };
}

export function errorKind(error: unknown): CameraProblemKind {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)) return 'denied';
  if (['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'].includes(name)) return 'not-found';
  if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(name)) return 'busy';
  return 'unknown';
}

/** https://host:8443/ruta cuando se entró por http:// a una dirección que no es localhost. */
export function secureUrlFor(location: Pick<Location, 'protocol' | 'hostname' | 'pathname' | 'search'>): string | undefined {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (location.protocol !== 'http:' || local) return undefined;
  return `https://${location.hostname}:${HTTPS_PORT}${location.pathname}${location.search}`;
}

/** Cómo se pide el permiso en el sitio (barra de direcciones) según el navegador. */
function siteStep({ os, browser }: Platform): string {
  if (browser === 'safari') return os === 'ios' ? t('face.cameraHelp.site.safariIos') : t('face.cameraHelp.site.safariMac');
  return t(`face.cameraHelp.site.${browser}`);
}

/** Dónde se da el permiso en el sistema operativo (null si el sistema no lo pide). */
function systemStep({ os, browser }: Platform): string | null {
  if (os === 'linux' || os === 'other') return null;
  return t(`face.cameraHelp.system.${os}`, { browser: browserName(browser) });
}

function permissionSteps(platform: Platform): string[] {
  const system = systemStep(platform);
  return [siteStep(platform), ...(system ? [system] : []), t('face.cameraHelp.pressRetry')];
}

/** "Si tu equipo…" a media oración: "…: si tu equipo…". */
const lowerFirst = (text: string) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

function notFoundSteps({ os }: Platform): string[] {
  const antivirus = t('face.cameraHelp.notFound.antivirus');
  if (os === 'macos') {
    return [
      t('face.cameraHelp.notFound.macCheck'),
      t('face.cameraHelp.notFound.noCameraListed', { antivirus: lowerFirst(antivirus) }),
      t('face.cameraHelp.notFound.macNoBuiltIn'),
    ];
  }
  if (os === 'windows') return [t('face.cameraHelp.notFound.windowsDevices'), t('face.cameraHelp.notFound.windowsSwitch'), antivirus];
  return [t('face.cameraHelp.notFound.generic'), antivirus];
}

/** Qué impide usar la cámara: el tipo, el sistema y navegador del usuario y, sin conexión segura, la dirección HTTPS. */
export function describeCameraProblem(
  kind: CameraProblemKind,
  platform: Platform = detectPlatform(),
  location: Pick<Location, 'protocol' | 'hostname' | 'pathname' | 'search'> = window.location,
): CameraProblem {
  return kind === 'insecure' ? { kind, platform, secureUrl: secureUrlFor(location) } : { kind, platform };
}

/** Título, causa y pasos de un problema de la cámara, en el idioma activo (se piden al mostrarse). */
export function cameraProblemText({ kind, platform, secureUrl }: CameraProblem): CameraProblemText {
  switch (kind) {
    case 'insecure':
      return {
        title: t('face.cameraHelp.insecure.title'),
        message: t('face.cameraHelp.insecure.message'),
        steps: secureUrl ? [t('face.cameraHelp.insecure.openSecure'), t('face.cameraHelp.insecure.certificate')] : [t('face.cameraHelp.insecure.useHttps')],
      };
    case 'unsupported':
      return { title: t('face.cameraHelp.unsupported.title'), message: t('face.cameraHelp.unsupported.message'), steps: [t('face.cameraHelp.unsupported.update')] };
    case 'denied':
      return {
        title: t('face.cameraHelp.denied.title'),
        message: t('face.cameraHelp.denied.message', { browser: browserName(platform.browser) }),
        steps: permissionSteps(platform),
      };
    case 'not-found':
      return { title: t('face.cameraHelp.notFound.title'), message: t('face.cameraHelp.notFound.message'), steps: notFoundSteps(platform) };
    case 'busy':
      return {
        title: t('face.cameraHelp.busy.title'),
        message: t('face.cameraHelp.busy.message'),
        steps: [
          t('face.cameraHelp.busy.closeApps'),
          ...(platform.os === 'macos' || platform.os === 'windows' ? [t('face.cameraHelp.busy.antivirus')] : []),
          t('face.cameraHelp.pressRetry'),
        ],
      };
    default:
      return {
        title: t('face.cameraHelp.unknown.title'),
        message: t('face.cameraHelp.unknown.message'),
        steps: [t('face.cameraHelp.unknown.reload'), t('face.cameraHelp.unknown.otherBrowser')],
      };
  }
}
