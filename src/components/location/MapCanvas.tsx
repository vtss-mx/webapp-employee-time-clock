import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { DEFAULT_CENTER, DEFAULT_ZOOM, loadGoogleMaps, MapsApiError, onMapsAuthFailure, POINT_ZOOM } from '../../services/maps/googleMaps';
import type { GeoPoint } from '../../utils/address';
import { Spinner } from '../Spinner';

/** Lo que se ve del mapa: su centro y su acercamiento (referencia de cercanía para el buscador). */
export interface MapView {
  center: GeoPoint;
  zoom: number;
}

interface MapCanvasProps {
  /** Punto elegido (null: aún no se marca). */
  point: GeoPoint | null;
  /** Radio permitido (m) para dibujar alrededor del punto; null: sin círculo. */
  radius: number | null;
  /** El usuario tocó el mapa o lo arrastró con el punto puesto. */
  onPick: (point: GeoPoint) => void;
  /** El mapa no se pudo mostrar (clave rechazada, sin red). */
  onFailure: (error: MapsApiError) => void;
  /** El mapa terminó de moverse o de acercarse (y al quedar listo): lo que se ve ahora. */
  onView: (view: MapView) => void;
}

type MapState = 'loading' | 'ready' | 'failed';

/** Por debajo de este acercamiento, tocar el mapa también acerca al punto. */
const MIN_PICK_ZOOM = 15;
/** Azul de la marca, si la hoja de estilos no define `--map-accent` (Google no lee variables CSS). */
const BRAND_BLUE = '#2563eb';

/** Color de la marca para lo que dibuja Google (el círculo): el token `--map-accent` del mapa. */
function accentColor(element: Element): string {
  return getComputedStyle(element).getPropertyValue('--map-accent').trim() || BRAND_BLUE;
}

/** Radio permitido con el color de la marca: relleno tenue y borde fino, sin tapar las calles. */
const circleStyle = (color: string): google.maps.CircleOptions => ({ strokeColor: color, strokeOpacity: 0.6, strokeWeight: 1.5, fillColor: color, fillOpacity: 0.08, clickable: false });

/**
 * Pin de la marca (SVG: nítido en cualquier pantalla): gota con el color `--map-pin`, aro blanco,
 * brillo sutil y un disco blanco con el punto al centro. La punta marca el punto exacto.
 */
function PinMark({ label }: { label: string }) {
  return (
    <svg className="map-canvas__pin" viewBox="0 0 44 56" width="44" height="56" role="img" aria-label={label}>
      <title>{label}</title>
      <path className="map-canvas__pin-body" d="M22 2C11.5 2 3 10.3 3 20.6c0 12.8 13.6 27.1 17.5 32.6a1.9 1.9 0 0 0 3 0C27.4 47.7 41 33.4 41 20.6 41 10.3 32.5 2 22 2z" />
      <path className="map-canvas__pin-shine" d="M22 4.5c-9.1 0-16.5 7.2-16.5 16.1 0 1.4.2 2.8.6 4.2C8 15.6 14.6 9 22 9s14 6.6 15.9 15.8c.4-1.4.6-2.8.6-4.2 0-8.9-7.4-16.1-16.5-16.1z" />
      <circle className="map-canvas__pin-disc" cx="22" cy="20.6" r="8.5" />
      <circle className="map-canvas__pin-dot" cx="22" cy="20.6" r="4" />
    </svg>
  );
}

/**
 * Mapa de Google con el punto SIEMPRE al centro (pin fijo): tocar el mapa lleva el punto ahí y,
 * con el punto puesto, arrastrar el mapa lo ajusta (el pin se levanta mientras se arrastra y se
 * asienta al soltar). El círculo muestra el radio permitido.
 * Es el único componente que usa `google.maps` directamente para dibujar. Sus textos siguen al idioma
 * activo; los controles y las calles de Google se quedan en el idioma con que se cargó el SDK (una vez
 * por página; cambiarlo exigiría recargar la página, y eso nunca se hace).
 */
export function MapCanvas({ point, radius, onPick, onFailure, onView }: MapCanvasProps) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [state, setState] = useState<MapState>('loading');
  /** La persona arrastra el mapa (el pin se levanta para mostrar que el punto se está moviendo). */
  const [dragging, setDragging] = useState(false);
  // Últimos valores para los manejadores del mapa (se registran una sola vez).
  const latest = useRef({ point, onPick, onFailure, onView });
  useLayoutEffect(() => {
    latest.current = { point, onPick, onFailure, onView };
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
        circleRef.current = new Circle({ ...circleStyle(accentColor(boxRef.current)), map: null });
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
        map.addListener('dragstart', () => setDragging(true));
        map.addListener('dragend', () => {
          setDragging(false);
          const center = map.getCenter();
          if (latest.current.point && center) latest.current.onPick(center.toJSON());
        });
        // Al quedar quieto: lo que se ve sirve de referencia para buscar lugares cercanos.
        map.addListener('idle', () => {
          const center = map.getCenter();
          if (center) latest.current.onView({ center: center.toJSON(), zoom: map.getZoom() ?? DEFAULT_ZOOM });
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
      <div ref={boxRef} className="map-canvas__map" role="application" aria-label={t('location.map.label')} />
      {state === 'ready' && point && (
        <span className={`map-canvas__marker ${dragging ? 'is-lifted' : ''}`}>
          <span className="map-canvas__halo" aria-hidden />
          <PinMark label={t('location.map.pin')} />
        </span>
      )}
      {state === 'loading' && (
        <div className="map-canvas__state">
          <Spinner size={28} />
          <span>{t('location.map.loading')}</span>
        </div>
      )}
      {state === 'failed' && (
        <div className="map-canvas__state map-canvas__state--failed">
          <span>{t('location.map.failed')}</span>
        </div>
      )}
    </div>
  );
}
