import { Languages } from 'lucide-react';
import { useId } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LOCALES, useT, type Locale } from '../i18n';
import { ENDONYMS } from '../i18n/endonyms';
import { useLanguage } from '../i18n/useLanguage';
import { FieldLabel, FieldMessage } from './FormField';
import { Select, type SelectOption } from './ui/Select';

interface LanguageSwitcherProps {
  /**
   * `compact`: solo el control, pequeño (barra del inicio de sesión); `field`: con etiqueta y la ayuda
   * de dónde se guarda (Mi perfil).
   */
  variant?: 'compact' | 'field';
  /** `dark` sobre superficies oscuras (la barra azul del inicio de sesión). */
  tone?: 'light' | 'dark';
  className?: string;
}

/**
 * Selector de idioma (lista propia `Select`, nunca un `<select>` nativo). Cada idioma se nombra en sí
 * mismo ("English (United States)") —así lo reconoce quien no entiende el idioma que se ve— y debajo
 * en el idioma activo. Cambia EN CALIENTE (`useLanguage`): la app se redibuja sin recargar.
 */
export function LanguageSwitcher({ variant = 'field', tone = 'light', className = '' }: LanguageSwitcherProps) {
  const t = useT();
  const id = useId();
  const { isAuthenticated } = useAuth();
  const { locale, change, changing } = useLanguage();
  const options: Array<SelectOption<Locale>> = LOCALES.map((code) => ({ value: code, label: ENDONYMS[code], description: t(`language.names.${code}`) }));
  const select = (
    <Select<Locale>
      id={id}
      value={changing ?? locale}
      options={options}
      onChange={(next) => void change(next)}
      aria-label={variant === 'compact' ? t('language.label') : undefined}
      aria-describedby={variant === 'field' ? `${id}-hint` : undefined}
      icon={<Languages size={16} aria-hidden />}
      size={variant === 'compact' ? 'sm' : 'md'}
      tone={tone}
      menuWidth="content"
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
