/**
 * API pública de la traducción: `t`/`useT` para textos, `Trans` para textos con partes
 * enriquecidas, `LazyText`/`localizedError` para lo que debe seguir al idioma después de crearse,
 * y el idioma activo (`useLocale`, `currentLocale`, `setLocale`).
 */
export { currentLocale, DEFAULT_LOCALE, isLocale, LOCALES, matchLocale, setLocale, t } from './core';
export type { Locale, MessageKey, Translate } from './core';
export { localizedError, resolveLazy } from './lazy';
export type { Lazy, LazyNode, LazyText } from './lazy';
export { Trans, useI18n, useLocale, useT } from './react';
