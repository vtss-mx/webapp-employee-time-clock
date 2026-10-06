import { Crosshair, Info, LocateFixed, MapPinOff, SearchCheck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useFeedback } from '../../hooks/useFeedback';
import { useMountedRef } from '../../hooks/useMountedRef';
import { t, useT } from '../../i18n';
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
  /** De qué es el punto (el acceso de un validador o un sitio), para la indicación "Toca el mapa para marcar el punto del acceso". */
  pointOf?: PointOf;
  onPoint: (point: GeoPoint | null) => void;
  /** Domicilio que Google encontró para el punto elegido: el formulario lo aplica. */
  onAddress: (found: Partial<AddressValues>) => void;
}

/** De qué es el punto que se marca. */
export type PointOf = 'access' | 'site';

type Busy = 'address' | 'locate' | 'geocode' | null;

/**
 * Aviso bajo el mapa cuando Google no pudo completar algo (nunca un popup: el formulario sigue a
 * mano): la API que falló, sin red ("offline") o una dirección que no se encontró. Se guarda el
 * código y se traduce al dibujar (sigue al idioma activo).
 */
type Notice = MapsApiError['api'] | 'offline' | 'notFound';
/** Desde este acercamiento lo que se ve del mapa es una zona concreta (una ciudad), no el país completo. */
const AREA_ZOOM = 10;

/** Título del popup si ubicar el punto falla por otra causa (se arma al dibujarse: sigue al idioma activo). */
const locateError = () => t('location.picker.locateError');

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
export function LocationPicker({ point, radius, address, error, disabled = false, pointOf = 'access', onPoint, onAddress }: LocationPickerProps) {
  const t = useT();
  const feedback = useFeedback();
  const mounted = useMountedRef();
  const [busy, setBusy] = useState<Busy>(null);
  const [mapReady, setMapReady] = useState(true);
  /** Lo último que Google no pudo completar (se dice bajo el mapa hasta la siguiente acción). */
  const [notice, setNotice] = useState<Notice | null>(null);
  /** Lo que se ve del mapa (referencia de cercanía del buscador cuando aún no hay punto). */
  const [view, setView] = useState<MapView | null>(null);

  const notify = useCallback((problem: MapsApiError) => {
    reportMapsProblem(problem);
    if (problem.problem === 'off') return;
    setNotice(problem.problem === 'failed' ? 'offline' : problem.api);
  }, []);

  const run = async <T,>(kind: Busy, task: () => Promise<T>): Promise<T | undefined> => {
    setBusy(kind);
    setNotice(null);
    try {
      return await task();
    } catch (err) {
      if (err instanceof MapsApiError) notify(err);
      else if (err instanceof LocationError) void feedback.show(() => locationProblemMessage(err.problem, 'map'));
      else void feedback.fromError(err, { title: locateError });
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

  /**
   * En una computadora la lectura precisa suele fallar (macOS: CoreLocation `kCLErrorLocationUnknown`, sin GPS): se
   * pide una vez la de la red Wi-Fi del propio sistema (reciente, menos precisa) antes de estimarla con Google. Un
   * permiso negado o un navegador sin la API no se reintentan.
   */
  const networkReading = (err: unknown) => {
    if (!(err instanceof LocationError) || (err.problem !== 'unavailable' && err.problem !== 'timeout')) throw err;
    return currentLocation({ highAccuracy: false, maxAgeMs: config.locationNetworkMaxAgeMs, timeoutMs: config.locationNetworkTimeoutMs });
  };

  const choosePlace = (place: FoundPlace) => {
    onPoint(place.point);
    onAddress(place.address);
  };

  const locate = () =>
    void run('locate', async () => {
      try {
        const here = await currentLocation().catch(networkReading);
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
      else setNotice('notFound');
    });

  if (!config.maps.apiKey) {
    return <p className="inline-note small muted">{t('location.picker.notConfigured')}</p>;
  }

  return (
    <div className={`location-picker ${error ? 'has-error' : ''}`}>
      {/* Places o, como respaldo, la geocodificación de lo escrito: con cualquiera de las dos hay buscador. */}
      {(config.maps.places || config.maps.geocoding) && (
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
              {t('location.picker.myLocation')}
            </Button>
          </div>
        )}
      </div>
      <div className="location-picker__footer">
        <p className={`location-picker__point ${point ? 'is-set' : ''}`} aria-live="polite">
          <Crosshair size={16} aria-hidden />
          <span>{point ? t('location.picker.point', { point: formatPoint(point) }) : t(`location.picker.tapToMark.${pointOf}`)}</span>
          {busy === 'address' && <span className="muted"> · {t('location.picker.findingAddress')}</span>}
        </p>
        <div className="button-row">
          {config.maps.geocoding && (
            <Button size="sm" variant="ghost" icon={<SearchCheck size={16} />} loading={busy === 'geocode'} disabled={disabled || busy !== null || !address.street.trim() || !address.city.trim()} onClick={geocodeWritten}>
              {t('location.picker.locateWritten')}
            </Button>
          )}
          {point && (
            <Button size="sm" variant="ghost" icon={<MapPinOff size={16} />} disabled={disabled} onClick={() => onPoint(null)}>
              {t('location.picker.removePoint')}
            </Button>
          )}
        </div>
      </div>
      {notice && (
        <p className="location-picker__notice" role="status">
          <Info size={16} aria-hidden />
          <span>{t(`location.picker.notices.${notice}`)}</span>
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
