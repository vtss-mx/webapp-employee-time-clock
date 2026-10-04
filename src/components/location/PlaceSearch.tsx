import { MapPin, Search, SearchX, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useDismissOnOutsidePointer } from '../../hooks/useDismissOnOutsidePointer';
import { useMountedRef } from '../../hooks/useMountedRef';
import { MapsApiError, mapsService, type FoundPlace, type PlaceSuggestion } from '../../services/maps/googleMaps';
import type { GeoPoint } from '../../utils/address';
import { knownLocation } from '../../utils/geolocation';
import { formatDistance } from '../attendance/sessionFacts';
import { Spinner } from '../Spinner';
import { Floating } from '../ui/Floating';

/** Pausa tras la última tecla: lo bastante corta para sentirse inmediata, sin una consulta por letra. */
const DEBOUNCE_MS = 220;

/** Toda falla se informa (nunca se calla): lo que no venga del servicio de mapas cuenta como falla de Places. */
function asPlacesProblem(error: unknown): MapsApiError {
  return error instanceof MapsApiError ? error : new MapsApiError('places', 'failed', String(error));
}
const MIN_CHARS = 3;

interface PlaceSearchProps {
  /** País del domicilio: las sugerencias se limitan a él. */
  country?: string;
  /**
   * Punto de referencia (el marcado o lo que se ve del mapa): las sugerencias más cercanas primero,
   * con su distancia. Sin él se usa la ubicación que el dispositivo ya conoce (si ya dio el permiso).
   */
  near?: GeoPoint | null;
  disabled?: boolean;
  onSelect: (place: FoundPlace) => void;
  /** Una falla de Google (API no habilitada, sin red), además de decirla en la lista (p. ej. para registrarla). */
  onError?: (error: MapsApiError) => void;
}

/** Lo que dice la lista cuando no hay sugerencias, según por qué. */
function emptyCopy(term: string, problem: MapsApiError | null): { title: string; hint: string } {
  if (problem?.problem === 'failed') {
    return { title: 'No se pudo buscar en este momento', hint: 'Revisa tu conexión e inténtalo de nuevo, o marca el punto en el mapa.' };
  }
  if (problem) return { title: 'Sin resultados', hint: 'Escribe el domicilio en los campos y marca el punto directamente en el mapa.' };
  return { title: `Sin resultados para «${term}»`, hint: 'Prueba con otra dirección o marca el punto directamente en el mapa.' };
}

/**
 * Buscador de lugares y direcciones (Places de Google) con su lista propia: las 5 sugerencias más
 * cercanas mientras se escribe (con pausa entre teclas; solo se dibuja la respuesta de lo último que
 * se escribió), con su distancia, flechas, Enter y Escape. Al elegir, entrega el punto y el
 * domicilio del lugar. Si no hay resultados, o Google no responde o no tiene la API habilitada, la
 * misma lista lo dice (nunca un popup) y el formulario sigue funcionando a mano.
 */
export function PlaceSearch({ country, near = null, disabled = false, onSelect, onError }: PlaceSearchProps) {
  const id = useId();
  const mounted = useMountedRef();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Por qué no hay sugerencias (falla de Google); null si simplemente no se encontró nada. */
  const [problem, setProblem] = useState<MapsApiError | null>(null);
  /** La búsqueda ya respondió (con o sin resultados): solo entonces se dice "sin resultados". */
  const [searched, setSearched] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const session = useRef<Promise<google.maps.places.AutocompleteSessionToken> | null>(null);
  const failed = useRef(false);
  /** El texto del lugar elegido: no es una búsqueda nueva (no se abre otra sesión ni la lista). */
  const chosen = useRef<string | null>(null);
  /** La referencia más reciente: mover el mapa la cambia sin lanzar otra búsqueda. */
  const nearRef = useRef(near);
  useLayoutEffect(() => {
    nearRef.current = near;
  });
  /** Ubicación que el dispositivo ya conoce (permiso ya dado): referencia de respaldo. Se pide una vez. */
  const device = useRef<GeoPoint | null>(null);
  const deviceAsked = useRef(false);
  useDismissOnOutsidePointer([controlRef, menuRef], open, () => setOpen(false));

  useEffect(() => {
    const term = query.trim();
    setSuggestions([]);
    setSearched(false);
    setBusy(false); // una búsqueda anterior aún en curso ya no cuenta (su respuesta se ignora)
    if (term.length < MIN_CHARS || query === chosen.current) return;
    if (failed.current) {
      // Sin la API habilitada no se vuelve a llamar a Google: la lista dice que no hay resultados.
      setSearched(true);
      setOpen(true);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setBusy(true);
      session.current ??= mapsService.newSearchSession();
      session.current
        // Si ya se escribió otra cosa mientras se abría la sesión, no se pide a Google algo que se ignoraría.
        .then((token) => (cancelled ? [] : mapsService.suggestPlaces(term, token, { country, near: nearRef.current ?? device.current })))
        .then((found) => {
          if (cancelled) return;
          setProblem(null);
          setSuggestions(found);
          setActive(0);
        })
        .catch((error: unknown) => {
          // La siguiente búsqueda empieza otra sesión: una que falló (p. ej. sin red) no se reutiliza.
          session.current = null;
          if (cancelled) return;
          const found = asPlacesProblem(error);
          failed.current = found.problem !== 'failed'; // sin la API habilitada no se vuelve a intentar
          setProblem(found);
          onError?.(found);
        })
        .finally(() => {
          if (cancelled) return;
          setBusy(false);
          setSearched(true);
          setOpen(true);
        });
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
      const found = asPlacesProblem(error);
      setProblem(found);
      setSearched(true);
      setOpen(true);
      onError?.(found);
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

  const onFocus = () => {
    if (searched) setOpen(true);
    if (deviceAsked.current) return;
    deviceAsked.current = true;
    // Accesorio: sin permiso ya dado (o sin ubicación) responde null y se busca sin esa referencia.
    void knownLocation().then((here) => {
      device.current = here && { lat: here.latitude, lng: here.longitude };
    });
  };

  const listId = `${id}-list`;
  const showList = open && suggestions.length > 0;
  const showEmpty = open && !busy && searched && suggestions.length === 0;
  const empty = emptyCopy(query.trim(), problem);
  const byDistance = suggestions.some((suggestion) => suggestion.distanceMeters !== null);
  return (
    <div className="place-search" ref={controlRef}>
      <Search size={18} className="place-search__icon" aria-hidden />
      <input
        type="search"
        className="input place-search__input"
        role="combobox"
        aria-expanded={showList || showEmpty}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList ? `${id}-opt-${active}` : undefined}
        aria-autocomplete="list"
        aria-label="Buscar un lugar o una dirección"
        placeholder="Buscar un lugar o una dirección"
        autoComplete="off"
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={onFocus}
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
                {suggestion.distanceMeters !== null && <span className="place-search__distance">{formatDistance(suggestion.distanceMeters)}</span>}
              </li>
            ))}
          </ul>
          <p className="place-search__credit">{byDistance ? 'Los más cercanos primero · Resultados de Google' : 'Resultados de Google'}</p>
        </Floating>
      )}
      {showEmpty && (
        <Floating anchorRef={controlRef} floatingRef={menuRef} className="select__menu select__menu--light place-search__menu" matchWidth>
          <div className="place-search__empty" role="status">
            <span className="place-search__empty-icon" aria-hidden>
              <SearchX size={18} />
            </span>
            <span className="place-search__empty-text">
              <strong>{empty.title}</strong>
              <small>{empty.hint}</small>
            </span>
          </div>
        </Floating>
      )}
    </div>
  );
}
