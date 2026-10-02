import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { countryDirectory, foldText, formatNational, joinPhone, type CountryOption } from '../../utils/phone';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useDismissOnOutsidePointer } from '../../hooks/useDismissOnOutsidePointer';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { describedBy, FieldLabel, FieldMessage, type FieldStatus } from '../FormField';

interface PhoneFieldProps {
  label: string;
  /** E.164 (`+526621234567`) o "" si no hay número. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  /** Validación en vivo (verificando, disponible o aviso). */
  status?: FieldStatus;
  required?: boolean;
  disabled?: boolean;
  name?: string;
}

/** E.164 admite hasta 15 dígitos entre lada y número. */
const MAX_DIGITS = 15;

/**
 * Teléfono con lada internacional: selector de país propio (bandera, nombre y lada del catálogo
 * de países, con búsqueda y teclado) y el número con el formato del país mientras se escribe.
 * Pegar un número con lada (`+1 415…` o `0034…`) cambia el país automáticamente. Entrega siempre E.164.
 */
export function PhoneField({ label, value, onChange, onBlur, error, hint, status, required, disabled = false, name }: PhoneFieldProps) {
  const id = useId();
  const { countries } = useCatalogs();
  const directory = useMemo(() => countryDirectory(countries), [countries]);
  const [country, setCountry] = useState<CountryOption>(() => directory.split(value).country);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Valor externo (p. ej. al cargar el registro a editar): el país sale del número. Con lo que
  // escribe el usuario el país no cambia (el número ya lleva la lada elegida).
  useSyncOnChange(value, (next) => setCountry((current) => directory.split(next, current).country));

  useDismissOnOutsidePointer(rootRef, open, () => setOpen(false));

  const national = directory.split(value, country).national;
  const emit = (nextCountry: CountryOption, digits: string) => {
    const maxNational = MAX_DIGITS - (nextCountry.dialCode.length - 1);
    onChange(joinPhone(nextCountry, digits.replace(/\D/g, '').slice(0, maxNational)));
  };

  const onInput = (text: string) => {
    const pasted = /^\s*(\+|00)/.test(text) ? directory.parse(text, country) : null;
    if (pasted) setCountry(pasted.country);
    emit(pasted?.country ?? country, pasted?.national ?? text);
  };

  const choose = (option: CountryOption) => {
    setCountry(option);
    emit(option, national);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`field phone-field ${error ? 'field--error' : status ? `field--${status.tone}` : ''}`} ref={rootRef}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <div className="field__control">
        <button
          ref={toggleRef}
          type="button"
          className="phone-field__country"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Lada: ${country.name} (${country.dialCode}). Cambiar país`}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="phone-field__flag" aria-hidden>
            {country.flag}
          </span>
          <span>{country.dialCode}</span>
          <ChevronDown size={16} className={open ? 'is-flipped' : undefined} aria-hidden />
        </button>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={formatNational(country, national)}
          placeholder={country.code === 'MX' ? '662 123 4567' : undefined}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, error, status?.text ?? hint)}
          onChange={(e) => onInput(e.target.value)}
          onBlur={onBlur}
        />
        {open && (
          <CountryMenu
            options={directory.options}
            selected={country}
            onSelect={choose}
            onClose={() => {
              setOpen(false);
              toggleRef.current?.focus();
            }}
          />
        )}
      </div>
      <FieldMessage id={id} error={error} hint={status?.text ?? hint} />
    </div>
  );
}

interface CountryMenuProps {
  /** Países activos del catálogo, en su orden. */
  options: CountryOption[];
  selected: CountryOption;
  onSelect: (option: CountryOption) => void;
  onClose: () => void;
}

/** Lista de países con búsqueda (nombre, código ISO o lada) y navegación con teclado. */
function CountryMenu({ options: all, selected, onSelect, onClose }: CountryMenuProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const options = useMemo(() => {
    const term = foldText(query.trim());
    return term ? all.filter((c) => c.search.includes(term)) : all;
  }, [all, query]);
  const [active, setActive] = useState(() => Math.max(0, all.findIndex((c) => c.code === selected.code)));
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 };
    if (event.key in moves) {
      event.preventDefault();
      setActive((i) => Math.min(options.length - 1, Math.max(0, i + moves[event.key])));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options.at(active);
      if (option) onSelect(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // no cierra el popup o la pantalla que contiene el formulario
      onClose();
    }
  };

  return (
    <div className="phone-field__menu">
      <div className="search">
        <Search size={16} />
        <input
          className="input"
          type="search"
          role="combobox"
          aria-label="Buscar país o lada"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={options.length ? `${listId}-${active}` : undefined}
          placeholder="Buscar país o lada"
          autoComplete="off"
          // El menú se abre a petición del usuario: el foco va a la búsqueda.
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul ref={listRef} id={listId} role="listbox" aria-label="Países" className="phone-field__options">
        {options.map((c: CountryOption, index) => (
          <li
            key={c.code}
            id={`${listId}-${index}`}
            data-index={index}
            role="option"
            aria-selected={c.code === selected.code}
            className={`${index === active ? 'is-active' : ''} ${c.featured && !query && options[index + 1]?.featured === false ? 'is-group-end' : ''}`}
            onPointerMove={() => setActive(index)}
            onClick={() => onSelect(c)}
          >
            <span className="phone-field__flag" aria-hidden>
              {c.flag}
            </span>
            <span className="truncate">{c.name}</span>
            <small>{c.dialCode}</small>
          </li>
        ))}
        {options.length === 0 && <li className="phone-field__empty">Sin resultados para “{query}”</li>}
      </ul>
    </div>
  );
}
