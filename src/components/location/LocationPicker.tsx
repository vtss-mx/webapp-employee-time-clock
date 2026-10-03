import { Crosshair, LocateFixed, MapPinOff, SearchCheck } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useFeedback } from '../../hooks/useFeedback';
import { useMountedRef } from '../../hooks/useMountedRef';
import { MapsApiError, mapsService, type FoundPlace } from '../../services/maps/googleMaps';
import { addressLine, formatPoint, type AddressValues, type GeoPoint } from '../../utils/address';
import { config } from '../../utils/config';
import { currentLocation, LocationError } from '../../utils/geolocation';
import { Button } from '../ui/Button';
import { locationProblemMessage, mapsProblemMessage } from './locationMessages';
import { MapCanvas } from './MapCanvas';
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
  onPoint: (point: GeoPoint | null) => void;
  /** Domicilio que Google encontró para el punto elegido: el formulario lo aplica. */
  onAddress: (found: Partial<AddressValues>) => void;
}

type Busy = 'address' | 'locate' | 'geocode' | null;

/**
 * Punto del domicilio en el mapa de Google: buscar un lugar, tocar o arrastrar el mapa, "Mi
 * ubicación" o "Ubicar la dirección escrita". Al marcar un punto se intenta llenar el domicilio
 * con lo que Google conoce de ese lugar (si la API está habilitada; si no, se explica una vez).
 */
export function LocationPicker({ point, radius, address, error, disabled = false, onPoint, onAddress }: LocationPickerProps) {
  const feedback = useFeedback();
  const mounted = useMountedRef();
  const [busy, setBusy] = useState<Busy>(null);
  const [mapReady, setMapReady] = useState(true);
  const notified = useRef(new Set<string>());

  // Cada problema de Google se explica una vez por formulario (no en cada clic).
  const notify = useCallback(
    (problem: MapsApiError) => {
      const key = `${problem.api}-${problem.problem}`;
      if (problem.problem === 'off' || notified.current.has(key)) return;
      if (problem.problem !== 'failed') notified.current.add(key);
      void feedback.show(mapsProblemMessage(problem));
    },
    [feedback],
  );

  const run = async <T,>(kind: Busy, task: () => Promise<T>): Promise<T | undefined> => {
    setBusy(kind);
    try {
      return await task();
    } catch (err) {
      if (err instanceof MapsApiError) notify(err);
      else if (err instanceof LocationError) void feedback.show(locationProblemMessage(err.problem));
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
      else void feedback.show({ variant: 'info', title: 'No encontramos esa dirección', text: 'Revisa el domicilio o marca el punto directamente en el mapa.', key: 'maps-geocode-empty' });
    });

  if (!config.maps.apiKey) {
    return <p className="inline-note small muted">El mapa no está configurado: el domicilio se captura a mano y no se puede exigir ubicación.</p>;
  }

  return (
    <div className={`location-picker ${error ? 'has-error' : ''}`}>
      {config.maps.places && <PlaceSearch country={address.country_code} disabled={disabled} onSelect={choosePlace} onError={notify} />}
      <div className="location-picker__map">
        <MapCanvas
          point={point}
          radius={radius}
          onPick={pick}
          onFailure={(problem) => {
            setMapReady(false);
            notify(problem);
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
          {point ? <span>Punto: {formatPoint(point)}</span> : <span>Toca el mapa para marcar el punto del acceso</span>}
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
      {error && (
        <small className="field__error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
