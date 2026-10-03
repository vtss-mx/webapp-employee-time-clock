import { MapPin } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DEFAULT_CENTER, DEFAULT_ZOOM, loadGoogleMaps, MapsApiError, onMapsAuthFailure, POINT_ZOOM } from '../../services/maps/googleMaps';
import type { GeoPoint } from '../../utils/address';
import { Spinner } from '../Spinner';

interface MapCanvasProps {
  /** Punto elegido (null: aún no se marca). */
  point: GeoPoint | null;
  /** Radio permitido (m) para dibujar alrededor del punto; null: sin círculo. */
  radius: number | null;
  /** El usuario tocó el mapa o lo arrastró con el punto puesto. */
  onPick: (point: GeoPoint) => void;
  /** El mapa no se pudo mostrar (clave rechazada, sin red). */
  onFailure: (error: MapsApiError) => void;
}

type MapState = 'loading' | 'ready' | 'failed';

/** Por debajo de este acercamiento, tocar el mapa también acerca al punto. */
const MIN_PICK_ZOOM = 15;
const CIRCLE_STYLE = { strokeColor: '#2563eb', strokeOpacity: 0.85, strokeWeight: 2, fillColor: '#3b82f6', fillOpacity: 0.14, clickable: false };

/**
 * Mapa de Google con el punto SIEMPRE al centro (pin fijo): tocar el mapa lleva el punto ahí y,
 * con el punto puesto, arrastrar el mapa lo ajusta. El círculo muestra el radio permitido.
 * Es el único componente que usa `google.maps` directamente para dibujar.
 */
export function MapCanvas({ point, radius, onPick, onFailure }: MapCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [state, setState] = useState<MapState>('loading');
  // Últimos valores para los manejadores del mapa (se registran una sola vez).
  const latest = useRef({ point, onPick, onFailure });
  useLayoutEffect(() => {
    latest.current = { point, onPick, onFailure };
  });

  useEffect(() => {
    let cancelled = false;
    const failed = (error: MapsApiError) => {
      if (cancelled) return;
      setState('failed');
      latest.current.onFailure(error);
    };
    const stopAuth = onMapsAuthFailure(() => failed(new MapsApiError('maps', 'denied', 'gm_authFailure')));
    loadGoogleMaps()
      .then(async () => {
        const { Map, Circle } = await google.maps.importLibrary('maps');
        if (cancelled || !boxRef.current) return;
        const start = latest.current.point;
        const map = new Map(boxRef.current, {
          center: start ?? DEFAULT_CENTER,
          zoom: start ? POINT_ZOOM : DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          // Dentro de una página que se desplaza: un dedo desplaza la página, dos mueven el mapa.
          gestureHandling: 'cooperative',
        });
        mapRef.current = map;
        circleRef.current = new Circle({ ...CIRCLE_STYLE, map: null });
        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          map.panTo(event.latLng);
          // Desde lejos (país o estado) se acerca al punto para afinarlo y ver el radio.
          if ((map.getZoom() ?? 0) < MIN_PICK_ZOOM) map.setZoom(POINT_ZOOM);
          latest.current.onPick(event.latLng.toJSON());
        });
        // Con el punto puesto, el pin queda al centro: el círculo lo sigue y al soltar se fija.
        map.addListener('center_changed', () => {
          if (latest.current.point) circleRef.current?.setCenter(map.getCenter() ?? null);
        });
        map.addListener('dragend', () => {
          const center = map.getCenter();
          if (latest.current.point && center) latest.current.onPick(center.toJSON());
        });
        setState('ready');
      })
      .catch((error: unknown) => failed(error instanceof MapsApiError ? error : new MapsApiError('maps', 'failed')));
    return () => {
      cancelled = true;
      stopAuth();
    };
  }, []);

  // Punto nuevo desde fuera (búsqueda, "Mi ubicación", dirección escrita): el mapa va hacia él.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return;
    const center = map.getCenter();
    if (!center || Math.abs(center.lat() - point.lat) > 1e-7 || Math.abs(center.lng() - point.lng) > 1e-7) {
      map.panTo(point);
      if ((map.getZoom() ?? 0) < MIN_PICK_ZOOM) map.setZoom(POINT_ZOOM);
    }
  }, [point, state]);

  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;
    const visible = Boolean(point && radius);
    circle.setMap(visible ? mapRef.current : null);
    if (visible && point && radius) {
      circle.setCenter(point);
      circle.setRadius(radius);
    }
  }, [point, radius, state]);

  return (
    <div className={`map-canvas ${point ? 'has-point' : ''}`}>
      <div ref={boxRef} className="map-canvas__map" role="application" aria-label="Mapa: toca para marcar el punto" />
      {state === 'ready' && point && (
        <span className="map-canvas__pin" aria-hidden>
          <MapPin size={40} strokeWidth={2.2} />
        </span>
      )}
      {state === 'loading' && (
        <div className="map-canvas__state">
          <Spinner size={28} />
          <span>Cargando el mapa...</span>
        </div>
      )}
      {state === 'failed' && (
        <div className="map-canvas__state map-canvas__state--failed">
          <span>El mapa no está disponible. Escribe el domicilio a mano.</span>
        </div>
      )}
    </div>
  );
}
