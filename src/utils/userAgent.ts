/**
 * Navegador y sistema a partir del User-Agent (sesiones activas y dispositivos de validadores).
 * Es solo descriptivo: un cliente puede falsear su User-Agent.
 */

import { t } from '../i18n/core';

/** Descripción legible del navegador y sistema a partir del User-Agent, en el idioma activo (se pide al dibujar). */
export function describeDevice(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: t('forms.device.unknown'), mobile: false };
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : t('forms.device.browser');
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
            : t('forms.device.system');
  return { label: `${browser} · ${os}`, mobile: /Mobile|Android|iPhone|iPad/.test(userAgent) };
}
