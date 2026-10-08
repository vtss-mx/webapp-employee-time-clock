import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { DEFAULT_CENTER, DEFAULT_ZOOM, loadGoogleMaps, MapsApiError, onMapsAuthFailure, POINT_ZOOM } from '../../services/maps/googleMaps';
import type { GeoPoint } from '../../utils/address';
import { Spinner } from '../Spinner';
import { PinMark } from './PinMark';

interface VerificationMapProps {
  /** Punto de la verificación elegida; null cuando no hay ninguna fila con ubicación seleccionada. */
  point: GeoPoint | null;
  /** El mapa no se pudo mostrar (clave rechazada, sin red): la pantalla lo reporta al ADMIN una vez. */
  onFailure?: (error: MapsApiError) => void;
}

type MapState = 'loading' | 'ready' | 'failed';

/**
 * Mapa de Google de SOLO LECTURA para ver DÓNDE se hizo una verificación: muestra el punto de la fila elegida con el
 * pin de la marca al centro y se recentra al elegir otra fila. A diferencia de `MapCanvas` (el selector de domicilios),
 * no deja marcar ni arrastrar: solo muestra. Usa el mismo SDK por `services/maps/googleMaps` (la clave vive solo en el
 * `.env` de la webapp, nunca en el código) y reutiliza los estilos `.map-canvas*` y el pin de la marca.
 */
export function VerificationMap({ point, onFailure }: VerificationMapProps) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [state, setState] = useState<MapState>('loading');
  // Último punto y manejador para el efecto de carga (se registra una sola vez).
  const latest = useRef({ point, onFailure });
  useLayoutEffect(() => {
    latest.current = { point, onFailure };
  });

  useEffect(() => {
    let cancelled = false;
    const failed = (error: MapsApiError) => {
      if (cancelled) return;
      setState('failed');
      latest.current.onFailure?.(error);
    };
    const stopAuth = onMapsAuthFailure(() => failed(new MapsApiError('maps', 'denied', 'gm_authFailure')));
    loadGoogleMaps()
      .then(async () => {
        const { Map } = await google.maps.importLibrary('maps');
        if (cancelled || !boxRef.current) return;
        const start = latest.current.point;
        mapRef.current = new Map(boxRef.current, {
          center: start ?? DEFAULT_CENTER,
          zoom: start ? POINT_ZOOM : DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          // Dentro de una página que se desplaza: un dedo desplaza la página, dos mueven el mapa.
          gestureHandling: 'cooperative',
        });
        setState('ready');
      })
      .catch((error: unknown) => failed(error instanceof MapsApiError ? error : new MapsApiError('maps', 'failed')));
    return () => {
      cancelled = true;
      stopAuth();
    };
  }, []);

  // La fila elegida cambia (o llega su punto): el mapa va hacia él y se acerca. Si ya está en ese punto (p. ej. al
  // quedar listo con el punto inicial), no se mueve de más.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return;
    const center = map.getCenter();
    if (!center || Math.abs(center.lat() - point.lat) > 1e-7 || Math.abs(center.lng() - point.lng) > 1e-7) {
      map.panTo(point);
      if ((map.getZoom() ?? 0) < POINT_ZOOM) map.setZoom(POINT_ZOOM);
    }
  }, [point, state]);

  return (
    <div className={`map-canvas ${point ? 'has-point' : ''}`}>
      <div ref={boxRef} className="map-canvas__map" role="application" aria-label={t('verification.map.label')} />
      {state === 'ready' && point && (
        <span className="map-canvas__marker">
          <span className="map-canvas__halo" aria-hidden />
          <PinMark label={t('verification.map.pin')} />
        </span>
      )}
      {state === 'loading' && (
        <div className="map-canvas__state">
          <Spinner size={28} />
          <span>{t('verification.map.loading')}</span>
        </div>
      )}
      {state === 'failed' && (
        <div className="map-canvas__state map-canvas__state--failed">
          <span>{t('verification.map.failed')}</span>
        </div>
      )}
    </div>
  );
}
