import { Crosshair, Info, LocateFixed, MapPinOff, SearchCheck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useFeedback } from '../../hooks/useFeedback';
import { useMountedRef } from '../../hooks/useMountedRef';
import { reportMapsProblem } from '../../services/clientErrorService';
import { MapsApiError, mapsService, type FoundPlace } from '../../services/maps/googleMaps';
import { addressLine, formatPoint, type AddressValues, type GeoPoint } from '../../utils/address';
import { config } from '../../utils/config';
import { currentLocation, LocationError } from '../../utils/geolocation';
import { Button } from '../ui/Button';
import { locationProblemMessage } from './locationMessages';
import { MapCanvas, type MapView } from './MapCanvas';
import { PlaceSearch } from './PlaceSearch';

interface LocationPickerProps {
  point: GeoPoint | null;
  /** Radio permitido (m) para dibujarlo; null: no se exige ubicación. */
  radius: number | null;
  /** Domicilio escrito (para "Ubicar la dirección" y limitar la búsqueda a su país). */
  address: AddressValues;
  /** Por qué falta el punto (p. ej. si se exige ubicación). */
  error?: string;
  disabled?: boolean;
  /** De qué es el punto, para la indicación "Toca el mapa para marcar el punto del acceso". */
  pointOf?: string;
  onPoint: (point: GeoPoint | null) => void;
  /** Domicilio que Google encontró para el punto elegido: el formulario lo aplica. */
  onAddress: (found: Partial<AddressValues>) => void;
}

type Busy = 'address' | 'locate' | 'geocode' | null;

/** Aviso bajo el mapa cuando Google no pudo completar algo (nunca un popup: el formulario sigue a mano). */
const NOTICES: Record<MapsApiError['api'], string> = {
  geocoding: 'No pudimos completar el domicilio desde el mapa: escríbelo a mano (el punto sí quedó marcado).',
  geolocation: 'No pudimos estimar tu ubicación: marca el punto directamente en el mapa.',
  places: 'La búsqueda de lugares no está disponible: escribe el domicilio y marca el punto en el mapa.',
  maps: 'El mapa no está disponible: escribe el domicilio a mano.',
};
const OFFLINE_NOTICE = 'Google Maps no respondió. Revisa tu conexión e inténtalo de nuevo.';
const NOT_FOUND_NOTICE = 'No encontramos esa dirección: revisa el domicilio o marca el punto directamente en el mapa.';
/** Desde este acercamiento lo que se ve del mapa es una zona concreta (una ciudad), no el país completo. */
const AREA_ZOOM = 10;

/**
 * Referencia para buscar lugares cercanos: el punto marcado; si no hay, el centro de lo que se ve del
 * mapa cuando ya se acercó a una zona. null: el buscador usa la ubicación que el dispositivo ya conoce
 * (si ya dio el permiso) o, sin ella, solo el país.
 */
function searchOrigin(point: GeoPoint | null, view: MapView | null): GeoPoint | null {
  if (point) return point;
  return view && view.zoom >= AREA_ZOOM ? view.center : null;
}

/**
 * Punto del domicilio en el mapa de Google: buscar un lugar, tocar o arrastrar el mapa, "Mi
 * ubicación" o "Ubicar la dirección escrita". Al marcar un punto se intenta llenar el domicilio
 * con lo que Google conoce de ese lugar. Si Google no responde o una API no está habilitada, se
 * dice en línea (la lista del buscador o un aviso bajo el mapa) y se sigue a mano: nunca un popup.
 * Una API sin habilitar es configuración de la plataforma: se reporta al ADMIN (`reportMapsProblem`).
 */
export function LocationPicker({ point, radius, address, error, disabled = false, pointOf = 'del acceso', onPoint, onAddress }: LocationPickerProps) {
  const feedback = useFeedback();
  const mounted = useMountedRef();
  const [busy, setBusy] = useState<Busy>(null);
  const [mapReady, setMapReady] = useState(true);
  /** Lo último que Google no pudo completar (se dice bajo el mapa hasta la siguiente acción). */
  const [notice, setNotice] = useState<string | null>(null);
  /** Lo que se ve del mapa (referencia de cercanía del buscador cuando aún no hay punto). */
  const [view, setView] = useState<MapView | null>(null);

  const notify = useCallback((problem: MapsApiError) => {
    reportMapsProblem(problem);
    if (problem.problem === 'off') return;
    setNotice(problem.problem === 'failed' ? OFFLINE_NOTICE : NOTICES[problem.api]);
  }, []);

  const run = async <T,>(kind: Busy, task: () => Promise<T>): Promise<T | undefined> => {
    setBusy(kind);
    setNotice(null);
    try {
      return await task();
    } catch (err) {
      if (err instanceof MapsApiError) notify(err);
      else if (err instanceof LocationError) void feedback.show(locationProblemMessage(err.problem, 'map'));
      else void feedback.fromError(err, { title: 'No se pudo ubicar el punto' });
      return undefined;
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  /** Punto nuevo y, si se puede, el domicilio de ese lugar. */
  const pick = (next: GeoPoint) => {
    onPoint(next);
    if (!config.maps.geocoding) return;
    void run('address', async () => {
      const found = await mapsService.reverseGeocode(next);
      if (mounted.current && Object.keys(found).length) onAddress(found);
    });
  };

  const choosePlace = (place: FoundPlace) => {
    onPoint(place.point);
    onAddress(place.address);
  };

  const locate = () =>
    void run('locate', async () => {
      try {
        const here = await currentLocation();
        pick({ lat: here.latitude, lng: here.longitude });
      } catch (err) {
        if (!(err instanceof LocationError) || !config.maps.geolocation || err.problem === 'denied') throw err;
        pick((await mapsService.approximateLocation()).point); // aproximada (por red) como respaldo
      }
    });

  const written = addressLine(address, { withCountry: true });
  const geocodeWritten = () =>
    void run('geocode', async () => {
      const found = await mapsService.geocodeAddress(written, address.country_code);
      if (found) onPoint(found.point);
      else setNotice(NOT_FOUND_NOTICE);
    });

  if (!config.maps.apiKey) {
    return <p className="inline-note small muted">El mapa no está configurado: el domicilio se captura a mano y no se puede exigir ubicación.</p>;
  }

  return (
    <div className={`location-picker ${error ? 'has-error' : ''}`}>
      {config.maps.places && (
        <PlaceSearch country={address.country_code} near={searchOrigin(point, view)} disabled={disabled} onSelect={choosePlace} onError={reportMapsProblem} />
      )}
      <div className="location-picker__map">
        <MapCanvas
          point={point}
          radius={radius}
          onPick={pick}
          onView={setView}
          onFailure={(problem) => {
            setMapReady(false);
            reportMapsProblem(problem);
          }}
        />
        {mapReady && (
          <div className="location-picker__tools">
            <Button size="sm" variant="secondary" icon={<LocateFixed size={16} />} loading={busy === 'locate'} disabled={disabled || busy !== null} onClick={locate}>
              Mi ubicación
            </Button>
          </div>
        )}
      </div>
      <div className="location-picker__footer">
        <p className={`location-picker__point ${point ? 'is-set' : ''}`} aria-live="polite">
          <Crosshair size={16} aria-hidden />
          {point ? <span>Punto: {formatPoint(point)}</span> : <span>Toca el mapa para marcar el punto {pointOf}</span>}
          {busy === 'address' && <span className="muted"> · buscando el domicilio...</span>}
        </p>
        <div className="button-row">
          {config.maps.geocoding && (
            <Button size="sm" variant="ghost" icon={<SearchCheck size={16} />} loading={busy === 'geocode'} disabled={disabled || busy !== null || !address.street.trim() || !address.city.trim()} onClick={geocodeWritten}>
              Ubicar la dirección escrita
            </Button>
          )}
          {point && (
            <Button size="sm" variant="ghost" icon={<MapPinOff size={16} />} disabled={disabled} onClick={() => onPoint(null)}>
              Quitar punto
            </Button>
          )}
        </div>
      </div>
      {notice && (
        <p className="location-picker__notice" role="status">
          <Info size={16} aria-hidden />
          <span>{notice}</span>
        </p>
      )}
      {error && (
        <small className="field__error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
