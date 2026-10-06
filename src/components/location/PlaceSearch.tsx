import { MapPin, Search, SearchX, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useDismissOnOutsidePointer } from '../../hooks/useDismissOnOutsidePointer';
import { useMountedRef } from '../../hooks/useMountedRef';
import { t, useLocale } from '../../i18n';
import { MapsApiError, mapsService, type FoundPlace, type PlaceSuggestion, type SearchSession, type SearchSource } from '../../services/maps/googleMaps';
import type { GeoPoint } from '../../utils/address';
import { knownLocation } from '../../utils/geolocation';
import { formatDistance } from '../../utils/numbers';
import { Spinner } from '../Spinner';
import { Floating } from '../ui/Floating';

/**
 * Pausa tras la última tecla: lo bastante corta para sentirse inmediata, sin una consulta por letra.
 * Places está hecho para cada tecla; la geocodificación (respaldo) se cobra por consulta y espera un poco más.
 */
const DEBOUNCE_MS: Record<SearchSource, number> = { places: 220, geocoding: 300 };

/** Toda falla se informa (nunca se calla): lo que no venga del servicio de mapas cuenta como falla de Places. */
function asPlacesProblem(error: unknown): MapsApiError {
  return error instanceof MapsApiError ? error : new MapsApiError('places', 'failed', String(error));
}
const MIN_CHARS = 3;

interface PlaceSearchProps {
  /** País del domicilio: las sugerencias (de Places o de la geocodificación) se limitan a él. */
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

/** Lo que dice la lista cuando no hay sugerencias, según por qué (en el idioma activo, al dibujar). */
function emptyCopy(problem: MapsApiError | null): { title: string; hint: string } {
  if (problem?.problem === 'failed') return { title: t('location.search.failed.title'), hint: t('location.search.failed.hint') };
  if (problem) return { title: t('location.search.unavailable.title'), hint: t('location.search.unavailable.hint') };
  return { title: t('location.search.none.title'), hint: t('location.search.none.hint') };
}

/**
 * Buscador de lugares y direcciones de Google con su lista propia: las 5 sugerencias más cercanas
 * mientras se escribe (con pausa entre teclas; solo se dibuja la respuesta de lo último que se
 * escribió), con su distancia, flechas, Enter y Escape. Busca con Places (Autocomplete) y, si Places
 * no está disponible, con la geocodificación de lo escrito: mismas filas, mismas distancias. Al
 * elegir, entrega el punto y el domicilio del lugar. Si no hay resultados, o Google no responde o no
 * tiene las APIs habilitadas, la misma lista lo dice (nunca un popup) y el formulario sigue a mano.
 * Al cambiar el idioma, lo escrito se vuelve a buscar: las sugerencias llegan en el idioma nuevo.
 */
export function PlaceSearch({ country, near = null, disabled = false, onSelect, onError }: PlaceSearchProps) {
  const locale = useLocale();
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
  const session = useRef<SearchSession>({ token: null });
  /** Ni Places ni Geocoding pueden buscar (no habilitados): no se vuelve a llamar a Google. */
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
      // Sin ninguna API habilitada no se vuelve a llamar a Google: la lista dice que no hay resultados.
      setSearched(true);
      setOpen(true);
      return;
    }
    // Lo que se escriba después cancela esta búsqueda: su respuesta se ignora y el servicio no pide más.
    const latest = new AbortController();
    const timer = window.setTimeout(() => {
      setBusy(true);
      mapsService
        // Places primero; si no está (apagado, negado o falla), la geocodificación. El problema de Places se informa.
        .searchPlaces(term, session.current, { country, near: nearRef.current ?? device.current, signal: latest.signal, onProblem: onError })
        .then((found) => {
          if (latest.signal.aborted) return;
          setProblem(null);
          setSuggestions(found);
          setActive(0);
        })
        .catch((error: unknown) => {
          if (latest.signal.aborted) return;
          const found = asPlacesProblem(error);
          failed.current = found.problem !== 'failed'; // sin la API habilitada no se vuelve a intentar
          setProblem(found);
          onError?.(found);
        })
        .finally(() => {
          if (latest.signal.aborted) return;
          setBusy(false);
          setSearched(true);
          setOpen(true);
        });
    }, DEBOUNCE_MS[mapsService.searchSource() ?? 'places']);
    return () => {
      latest.abort();
      window.clearTimeout(timer);
    };
  }, [query, country, onError, locale]);

  const choose = async (suggestion: PlaceSuggestion) => {
    setOpen(false);
    setBusy(true);
    try {
      const place = await mapsService.resolvePlace(suggestion);
      session.current = { token: null }; // la sesión de búsqueda termina al elegir
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
  const empty = emptyCopy(problem);
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
        aria-label={t('location.search.label')}
        placeholder={t('location.search.label')}
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
        <button type="button" className="place-search__clear" aria-label={t('location.search.clear')} onClick={() => setQuery('')}>
          <X size={16} />
        </button>
      )}
      {showList && (
        <Floating anchorRef={controlRef} floatingRef={menuRef} className="select__menu select__menu--light place-search__menu" matchWidth>
          <ul id={listId} role="listbox" aria-label={t('location.search.results')}>
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
          <p className="place-search__credit">{t(byDistance ? 'location.search.creditNearest' : 'location.search.credit')}</p>
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
