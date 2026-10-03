import { LocateOff, MapPinOff, SearchX } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import type { MapsApiError } from '../../services/maps/googleMaps';
import { LOCATION_MESSAGES, LocationError, type LocationProblem } from '../../utils/geolocation';
import type { MessageInput } from '../MessageDialog';

/** Ubicación del dispositivo bloqueada o no disponible (inicio de sesión o "Mi ubicación"). */
export function locationProblemMessage(problem: LocationProblem): MessageInput {
  const { title, text, steps } = LOCATION_MESSAGES[problem];
  return {
    variant: problem === 'denied' || problem === 'insecure' ? 'warning' : 'error',
    icon: <LocateOff size={30} />,
    eyebrow: 'Ubicación',
    title,
    text,
    details: steps,
    detailsStyle: 'steps',
    key: `location-${problem}`,
  };
}

const LOGIN_LOCATION_TITLES: Record<string, string> = {
  LOCATION_OUT_OF_RANGE: 'Estás fuera del lugar permitido',
  LOCATION_INACCURATE: 'Tu ubicación no es precisa',
  LOCATION_REQUIRED: 'Se necesita tu ubicación',
};

/**
 * Aviso del inicio de sesión cuando el validador requiere ubicación: permiso o GPS del dispositivo
 * (LocationError) o la respuesta del backend (fuera del radio, ubicación imprecisa). null: otro error.
 */
export function loginLocationMessage(error: unknown): MessageInput | null {
  if (error instanceof LocationError) return locationProblemMessage(error.problem);
  if (!(error instanceof ApiError) || !(error.code in LOGIN_LOCATION_TITLES)) return null;
  return {
    variant: 'warning',
    icon: <LocateOff size={30} />,
    eyebrow: 'Ubicación',
    title: LOGIN_LOCATION_TITLES[error.code],
    text: error.message,
    details:
      error.code === 'LOCATION_OUT_OF_RANGE'
        ? ['Acércate al acceso donde opera este validador.', 'Activa la ubicación precisa (GPS) del dispositivo.', 'Vuelve a iniciar sesión.']
        : undefined,
    detailsStyle: 'steps',
    key: `login-${error.code}`,
  };
}

const API_NAMES = { maps: 'Maps JavaScript API', places: 'Places API (New)', geocoding: 'Geocoding API', geolocation: 'Geolocation API' };

const DENIED: Record<MapsApiError['api'], { title: string; text: string }> = {
  maps: { title: 'El mapa no está disponible', text: 'Google rechazó la clave del mapa. Escribe el domicilio a mano.' },
  places: {
    title: 'La búsqueda de lugares no está disponible',
    text: 'Marca el punto directamente en el mapa y escribe el domicilio.',
  },
  geocoding: {
    title: 'El autollenado del domicilio no está disponible',
    text: 'El punto del mapa sí quedó marcado; escribe el domicilio a mano.',
  },
  geolocation: { title: 'No se pudo estimar tu ubicación', text: 'Marca el punto directamente en el mapa.' },
};

/** Google no respondió o la clave no tiene la API habilitada (se explica qué falta y cómo seguir). */
export function mapsProblemMessage(error: MapsApiError): MessageInput {
  if (error.problem === 'failed') {
    return {
      variant: 'error',
      icon: <MapPinOff size={30} />,
      eyebrow: 'Google Maps',
      title: 'No se pudo consultar Google Maps',
      text: 'Revisa tu conexión e inténtalo de nuevo. Mientras tanto puedes escribir el domicilio a mano.',
      key: `maps-${error.api}-failed`,
    };
  }
  const copy = DENIED[error.api];
  return {
    variant: 'warning',
    icon: error.api === 'places' ? <SearchX size={30} /> : <MapPinOff size={30} />,
    eyebrow: 'Google Maps',
    title: copy.title,
    text: copy.text,
    footnote: `La clave de Google Maps no tiene habilitada «${API_NAMES[error.api]}». Quien administra la cuenta de Google Cloud puede habilitarla; después funcionará sin cambiar nada aquí.`,
    key: `maps-${error.api}-denied`,
  };
}
