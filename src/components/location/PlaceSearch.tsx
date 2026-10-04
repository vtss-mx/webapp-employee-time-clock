import { MapPin, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useDismissOnOutsidePointer } from '../../hooks/useDismissOnOutsidePointer';
import { useMountedRef } from '../../hooks/useMountedRef';
import { MapsApiError, mapsService, type FoundPlace, type PlaceSuggestion } from '../../services/maps/googleMaps';
import { Spinner } from '../Spinner';
import { Floating } from '../ui/Floating';

const DEBOUNCE_MS = 300;

/** Toda falla se informa (nunca se calla): lo que no venga del servicio de mapas cuenta como falla de Places. */
function asPlacesProblem(error: unknown): MapsApiError {
  return error instanceof MapsApiError ? error : new MapsApiError('places', 'failed', String(error));
}
const MIN_CHARS = 3;

interface PlaceSearchProps {
  /** País del domicilio: las sugerencias se limitan a él. */
  country?: string;
  disabled?: boolean;
  onSelect: (place: FoundPlace) => void;
  onError: (error: MapsApiError) => void;
}

/**
 * Buscador de lugares y direcciones (Places de Google) con su lista propia: sugerencias mientras
 * se escribe (con pausa entre teclas), flechas, Enter y Escape. Al elegir, entrega el punto y el
 * domicilio del lugar.
 */
export function PlaceSearch({ country, disabled = false, onSelect, onError }: PlaceSearchProps) {
  const id = useId();
  const mounted = useMountedRef();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const session = useRef<Promise<google.maps.places.AutocompleteSessionToken> | null>(null);
  const failed = useRef(false);
  /** El texto del lugar elegido: no es una búsqueda nueva (no se abre otra sesión ni la lista). */
  const chosen = useRef<string | null>(null);
  useDismissOnOutsidePointer([controlRef, menuRef], open, () => setOpen(false));

  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_CHARS || failed.current || query === chosen.current) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setBusy(true);
      session.current ??= mapsService.newSearchSession();
      session.current
        .then((token) => mapsService.suggestPlaces(term, token, country))
        .then((found) => {
          if (cancelled) return;
          setSuggestions(found);
          setActive(0);
          setOpen(true);
        })
        .catch((error: unknown) => {
          // La siguiente búsqueda empieza otra sesión: una que falló (p. ej. sin red) no se reutiliza.
          session.current = null;
          if (cancelled) return;
          const problem = asPlacesProblem(error);
          failed.current = problem.problem !== 'failed'; // sin la API habilitada no se vuelve a intentar
          onError(problem);
        })
        .finally(() => !cancelled && setBusy(false));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, country, onError]);

  const choose = async (suggestion: PlaceSuggestion) => {
    setOpen(false);
    setBusy(true);
    try {
      const place = await mapsService.resolvePlace(suggestion);
      session.current = null; // la sesión de búsqueda termina al elegir
      if (!mounted.current) return;
      chosen.current = place.label;
      setQuery(place.label);
      onSelect(place);
    } catch (error) {
      onError(asPlacesProblem(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = suggestions.length - 1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (event.key === 'ArrowDown' ? Math.min(last, i + 1) : Math.max(0, i - 1)));
    } else if (event.key === 'Enter' && open && suggestions.length) {
      event.preventDefault(); // no envía el formulario
      void choose(suggestions[active]);
    } else if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };

  const listId = `${id}-list`;
  const showList = open && suggestions.length > 0;
  return (
    <div className="place-search" ref={controlRef}>
      <Search size={18} className="place-search__icon" aria-hidden />
      <input
        type="search"
        className="input place-search__input"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList ? `${id}-opt-${active}` : undefined}
        aria-autocomplete="list"
        aria-label="Buscar un lugar o una dirección"
        placeholder="Buscar un lugar o una dirección"
        autoComplete="off"
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {busy && (
        <span className="place-search__busy">
          <Spinner size={18} />
        </span>
      )}
      {!busy && query && (
        <button type="button" className="place-search__clear" aria-label="Borrar búsqueda" onClick={() => setQuery('')}>
          <X size={16} />
        </button>
      )}
      {showList && (
        <Floating anchorRef={controlRef} floatingRef={menuRef} className="select__menu select__menu--light place-search__menu" matchWidth>
          <ul id={listId} role="listbox" aria-label="Lugares encontrados">
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={index === active}
                className={`select__option ${index === active ? 'is-active' : ''}`}
                onPointerMove={() => setActive(index)}
                onClick={() => void choose(suggestion)}
              >
                <span className="select__option-icon">
                  <MapPin size={16} />
                </span>
                <span className="select__option-text">
                  <span>{suggestion.primary}</span>
                  {suggestion.secondary && <small>{suggestion.secondary}</small>}
                </span>
              </li>
            ))}
          </ul>
          <p className="place-search__credit">Resultados de Google</p>
        </Floating>
      )}
    </div>
  );
}
