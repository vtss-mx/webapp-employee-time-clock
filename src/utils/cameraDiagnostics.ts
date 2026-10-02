/**
 * Diagnóstico de la cámara: identifica POR QUÉ no se puede usar y da los pasos exactos para el
 * sistema operativo y navegador del usuario (en vez de un mensaje genérico).
 */
export type CameraProblemKind = 'insecure' | 'unsupported' | 'denied' | 'not-found' | 'busy' | 'unknown';
type Os = 'macos' | 'windows' | 'ios' | 'android' | 'linux' | 'other';
type Browser = 'safari' | 'chrome' | 'edge' | 'firefox' | 'other';

export interface Platform {
  os: Os;
  browser: Browser;
}

export interface CameraProblem {
  kind: CameraProblemKind;
  title: string;
  message: string;
  steps: string[];
  /** Dirección HTTPS equivalente cuando se entró por http:// (la cámara exige conexión segura). */
  secureUrl?: string;
}

const BROWSER_NAMES: Record<Browser, string> = { safari: 'Safari', chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', other: 'tu navegador' };
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

function permissionSteps({ os, browser }: Platform): string[] {
  const name = BROWSER_NAMES[browser];
  const site: Record<Browser, string> = {
    chrome: 'En la barra de direcciones haz clic en el ícono de cámara o del candado → Cámara → "Permitir".',
    edge: 'En la barra de direcciones haz clic en el candado → Permisos de este sitio → Cámara → "Permitir".',
    firefox: 'Haz clic en el ícono de cámara tachada junto a la dirección y quita el bloqueo.',
    safari:
      os === 'ios'
        ? 'Toca "aA" en la barra de direcciones → Ajustes del sitio web → Cámara → "Permitir".'
        : 'En Safari: menú Safari → Ajustes → Sitios web → Cámara → elige "Permitir" para este sitio.',
    other: 'Abre los permisos del sitio (ícono junto a la dirección) y permite la cámara.',
  };
  const system: Partial<Record<Os, string>> = {
    macos: `En la Mac: menú Apple  → Ajustes del Sistema → Privacidad y seguridad → Cámara → activa ${name}. Después cierra y vuelve a abrir ${name}.`,
    windows: 'En Windows: Configuración → Privacidad y seguridad → Cámara → activa "Acceso a la cámara" y "Permitir que las aplicaciones de escritorio accedan a la cámara".',
    ios: `En el iPhone/iPad: Ajustes → ${browser === 'safari' ? 'Safari' : name} → Cámara → "Permitir".`,
    android: `En Android: Ajustes → Aplicaciones → ${name} → Permisos → Cámara → "Permitir".`,
  };
  return [site[browser], ...(system[os] ? [system[os]] : []), 'Pulsa "Reintentar".'];
}

function notFoundSteps({ os }: Platform): string[] {
  const antivirus =
    'Si tu equipo tiene antivirus o control corporativo (p. ej. Kaspersky → "Protección de cámara web"), puede estar bloqueando la cámara: desactívalo o agrega tu navegador como excepción.';
  if (os === 'macos') {
    return [
      'Verifica que la Mac detecte la cámara: menú Apple  → Acerca de esta Mac → Más información → Informe del sistema → Cámara.',
      `Si no aparece ninguna cámara: ${antivirus.charAt(0).toLowerCase()}${antivirus.slice(1)}`,
      'En Mac mini, Mac Studio o una MacBook con la tapa cerrada no hay cámara integrada disponible: conecta una cámara USB o usa la cámara de Continuidad del iPhone.',
    ];
  }
  if (os === 'windows') {
    return [
      'Revisa el Administrador de dispositivos → Cámaras (debe aparecer sin errores).',
      'Algunas laptops tienen un interruptor o una tecla (F8, F10 o con ícono de cámara) que la apaga.',
      antivirus,
    ];
  }
  return ['Verifica que el dispositivo tenga una cámara conectada y habilitada.', antivirus];
}

export function describeCameraProblem(
  kind: CameraProblemKind,
  platform: Platform = detectPlatform(),
  location: Pick<Location, 'protocol' | 'hostname' | 'pathname' | 'search'> = window.location,
): CameraProblem {
  switch (kind) {
    case 'insecure': {
      const secureUrl = secureUrlFor(location);
      return {
        kind,
        title: 'La cámara necesita una conexión segura',
        message: 'Los navegadores solo permiten usar la cámara en páginas HTTPS (o en localhost).',
        steps: secureUrl
          ? ['Abre la versión segura con el botón de abajo.', 'Si aparece un aviso de certificado (red local), elige "Avanzado" → "Continuar".']
          : ['Entra a la aplicación con una dirección https://.'],
        secureUrl,
      };
    }
    case 'unsupported':
      return {
        kind,
        title: 'Tu navegador no permite usar la cámara',
        message: 'Usa la versión más reciente de Chrome, Edge, Safari o Firefox.',
        steps: ['Actualiza tu navegador o abre la aplicación en otro.'],
      };
    case 'denied':
      return {
        kind,
        title: 'El permiso de cámara está bloqueado',
        message: `${BROWSER_NAMES[platform.browser]} o el sistema no permiten que esta página use la cámara.`,
        steps: permissionSteps(platform),
      };
    case 'not-found':
      return {
        kind,
        title: 'No se detectó ninguna cámara',
        message: 'El sistema no reporta una cámara disponible para el navegador.',
        steps: notFoundSteps(platform),
      };
    case 'busy':
      return {
        kind,
        title: 'La cámara no se pudo iniciar',
        message: 'Otra aplicación la está usando o algo la bloquea.',
        steps: [
          'Cierra Zoom, Teams, Meet, FaceTime u otra pestaña que esté usando la cámara.',
          ...(platform.os === 'macos' || platform.os === 'windows'
            ? ['Si persiste, un antivirus puede estar bloqueándola (p. ej. Kaspersky → "Protección de cámara web").']
            : []),
          'Pulsa "Reintentar".',
        ],
      };
    default:
      return {
        kind: 'unknown',
        title: 'No fue posible iniciar la cámara',
        message: 'Ocurrió un problema inesperado al abrir la cámara.',
        steps: ['Recarga la página y pulsa "Reintentar".', 'Si continúa, prueba con otro navegador.'],
      };
  }
}
