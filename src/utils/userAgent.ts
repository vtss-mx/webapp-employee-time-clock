/**
 * Navegador y sistema a partir del User-Agent (sesiones activas y dispositivos de validadores).
 * Es solo descriptivo: un cliente puede falsear su User-Agent.
 */

/** Descripción legible del navegador y sistema a partir del User-Agent. */
export function describeDevice(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: 'Dispositivo desconocido', mobile: false };
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Navegador';
  const os = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Sistema desconocido';
  return { label: `${browser} · ${os}`, mobile: /Mobile|Android|iPhone|iPad/.test(userAgent) };
}
