import type { ReactNode } from 'react';
import { ENDONYMS, type FlagCountry } from '../../i18n/endonyms';
import type { Locale } from '../../i18n';

/**
 * Bandera de cada idioma dibujada por la app (SVG plano, 20 × 14): nada de banderas emoji, que cada sistema
 * dibuja distinto (o no dibuja). Es decorativa (`aria-hidden`): el texto que la acompaña ya nombra el idioma y
 * su país (`ENDONYMS`). Colores oficiales simplificados; el borde fino lo pone la clase `locale-flag` para que las
 * franjas blancas se vean sobre blanco.
 */
const FLAGS: Readonly<Record<FlagCountry, ReactNode>> = {
  MX: (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect width="6.67" height="14" fill="#006847" />
      <rect x="13.33" width="6.67" height="14" fill="#ce1126" />
      <circle cx="10" cy="7" r="1.6" fill="#8c6239" />
    </>
  ),
  US: (
    <>
      <rect width="20" height="14" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((y) => (
        <rect key={y} y={y * (14 / 13)} width="20" height={14 / 13} fill="#b22234" />
      ))}
      <rect width="8.6" height={7 * (14 / 13)} fill="#3c3b6e" />
    </>
  ),
  BR: (
    <>
      <rect width="20" height="14" fill="#009c3b" />
      <path d="M10 1.8 18.2 7 10 12.2 1.8 7Z" fill="#ffdf00" />
      <circle cx="10" cy="7" r="3" fill="#002776" />
    </>
  ),
  FR: (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect width="6.67" height="14" fill="#0055a4" />
      <rect x="13.33" width="6.67" height="14" fill="#ef4135" />
    </>
  ),
  DE: (
    <>
      <rect width="20" height="4.67" fill="#000" />
      <rect y="4.67" width="20" height="4.67" fill="#d00" />
      <rect y="9.33" width="20" height="4.67" fill="#ffce00" />
    </>
  ),
  IT: (
    <>
      <rect width="20" height="14" fill="#fff" />
      <rect width="6.67" height="14" fill="#009246" />
      <rect x="13.33" width="6.67" height="14" fill="#ce2b37" />
    </>
  ),
  ES: (
    <>
      <rect width="20" height="14" fill="#f1bf00" />
      <rect width="20" height="3.5" fill="#aa151b" />
      <rect y="10.5" width="20" height="3.5" fill="#aa151b" />
      <rect x="5" y="5.2" width="2.4" height="3.6" rx="0.5" fill="#aa151b" />
    </>
  ),
};

/** La bandera del país del idioma, pequeña (20 × 14 por omisión, con esquinas redondeadas). */
export function LocaleFlag({ locale, width = 20, className = '' }: { locale: Locale; width?: number; className?: string }) {
  const country = ENDONYMS[locale].flag;
  return (
    <svg className={`locale-flag ${className}`} viewBox="0 0 20 14" width={width} height={(width * 14) / 20} aria-hidden focusable="false" data-country={country}>
      {FLAGS[country]}
    </svg>
  );
}
