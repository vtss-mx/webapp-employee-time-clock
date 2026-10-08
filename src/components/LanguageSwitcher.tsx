import { Check } from 'lucide-react';
import { useId } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { LOCALES, useT, type Locale } from '../i18n';
import { ENDONYMS, endonymLabel } from '../i18n/endonyms';
import { useLanguage } from '../i18n/useLanguage';
import { FieldLabel, FieldMessage } from './FormField';
import { LocaleFlag } from './ui/LocaleFlag';
import { Select, type SelectOption } from './ui/Select';

interface LanguageSwitcherProps {
  /**
   * `compact`: solo el control, pequeño (barra del inicio de sesión, kiosco); `field`: con etiqueta y la ayuda
   * de dónde se guarda (Mi perfil).
   */
  variant?: 'compact' | 'field';
  /** `dark` sobre superficies oscuras (la barra azul del inicio de sesión). */
  tone?: 'light' | 'dark';
  className?: string;
}

/**
 * En teléfonos el control compacto de la barra del inicio de sesión muestra solo la bandera (`global.css`): ahí la lista
 * no puede medir lo que él; conserva este ancho mínimo, alineada a su borde derecho y dentro de la pantalla.
 */
const NARROW_MENU_MIN_WIDTH = 264;
const NARROW_SCREEN = '(max-width: 520px)';

/** Una opción: bandera, el idioma en sí mismo y, debajo, su país (también en ese idioma); la elegida con palomita. */
function LanguageOption({ locale, selected }: { locale: Locale; selected: boolean }) {
  const { language, country } = ENDONYMS[locale];
  return (
    <>
      <LocaleFlag locale={locale} className="language-option__flag" />
      <span className="select__option-text language-option__text">
        <span>{language}</span>
        <small>{country}</small>
      </span>
      {selected && <Check size={18} className="select__check" aria-hidden />}
    </>
  );
}

/**
 * Selector de idioma (lista propia `Select`, nunca un `<select>` nativo). Decisión del dueño del producto
 * (2026-10-06): cada idioma se muestra con su bandera (dibujada por la app, sin emoji), su nombre en sí mismo y su
 * país —así lo reconoce quien no entiende el idioma que se ve—; el control cerrado dice «Español (México)». La lista
 * mide EXACTAMENTE lo que el control (el compacto es tan ancho como el nombre más largo, «English (United States)»,
 * así nada se recorta; solo en teléfonos, donde el control muestra solo la bandera, la lista conserva un ancho mínimo
 * alineada a su borde derecho), con los mismos tokens que las demás listas de la app y, sobre la barra azul, los
 * colores de la propia barra. Cambia EN CALIENTE (`useLanguage`): la app se redibuja sin recargar.
 */
export function LanguageSwitcher({ variant = 'field', tone = 'light', className = '' }: LanguageSwitcherProps) {
  const t = useT();
  const id = useId();
  const { isAuthenticated } = useAuth();
  const { locale, change, changing } = useLanguage();
  const narrow = useMediaQuery(NARROW_SCREEN);
  const options: Array<SelectOption<Locale>> = LOCALES.map((code) => ({ value: code, label: endonymLabel(code), icon: <LocaleFlag locale={code} /> }));
  const select = (
    <Select<Locale>
      id={id}
      value={changing ?? locale}
      options={options}
      onChange={(next) => void change(next)}
      aria-label={variant === 'compact' ? t('language.label') : undefined}
      aria-describedby={variant === 'field' ? `${id}-hint` : undefined}
      size={variant === 'compact' ? 'sm' : 'md'}
      tone={tone}
      menuMinWidth={variant === 'compact' && narrow ? NARROW_MENU_MIN_WIDTH : undefined}
      menuAlign={variant === 'compact' ? 'end' : 'start'}
      menuClassName="language-switcher__menu"
      renderOption={(option, state) => <LanguageOption locale={option.value} selected={state.selected} />}
      disabled={changing !== null}
      className={`language-switcher language-switcher--${variant} ${className}`}
    />
  );
  if (variant === 'compact') return select;
  return (
    <div className="field">
      <FieldLabel htmlFor={id} label={t('language.label')} />
      {select}
      <FieldMessage id={id} hint={isAuthenticated ? t('language.hintAccount') : t('language.hintDevice')} />
    </div>
  );
}
