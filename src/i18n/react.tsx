import { Fragment, useSyncExternalStore, type ReactNode } from 'react';
import type { MessageKey, ParamName } from '../types/i18n';
import { i18nSnapshot, subscribe, type I18nState, type Locale, type Translate } from './core';

/**
 * Idioma activo y su traductor. No necesita proveedor: lee el estado único de `core` y redibuja el
 * componente cuando cambia el idioma (y con él, todo lo que dibuja debajo).
 */
export function useI18n(): I18nState {
  return useSyncExternalStore(subscribe, i18nSnapshot);
}

/** `const t = useT(); t('common.actions.save')`: traduce y redibuja al cambiar el idioma. */
export function useT(): Translate {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/** Variables de un texto con partes enriquecidas (negritas, enlaces, íconos...). */
export type RichValues<K extends MessageKey> = { [P in ParamName<K>]: P extends 'count' ? number : ReactNode };

/**
 * Texto traducido con partes que no son texto plano, sin partir la frase en pedazos (cada idioma
 * ordena la oración a su manera): `<Trans k="auth.reset.sentTo" values={{ email: <strong>{email}</strong> }} />`.
 */
export function Trans<K extends MessageKey>({ k, values }: { k: K; values: RichValues<K> }) {
  const { template } = useI18n();
  const parts = values as Record<string, ReactNode>;
  const count = typeof parts.count === 'number' ? parts.count : undefined;
  // Con el grupo de captura, `split` deja el texto en las posiciones pares y el nombre de cada variable en las impares.
  const pieces = template(k, count).split(/\{(\w+)\}/);
  return <>{pieces.map((piece, i) => <Fragment key={i}>{i % 2 ? parts[piece] : piece}</Fragment>)}</>;
}
