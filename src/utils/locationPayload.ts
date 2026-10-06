/**
 * La ubicación como la recibe el backend (única implementación): el registro de asistencia y cada identificación de
 * un validador que requiere ubicación (antifraude 2b) envían la lectura que decide y todas las de la toma (el servidor
 * detecta una ubicación congelada o simulada).
 */
import type { DeviceLocation } from './geolocation';

/** Una toma: la lectura que decide (la más precisa) y todas, en orden. */
export interface LocationTake extends DeviceLocation {
  samples?: DeviceLocation[];
}

/** La precisión que acepta el backend (los navegadores pueden informar más en una red sin GPS). */
const accuracyOf = (location: DeviceLocation) => Math.min(location.accuracy, 100_000);

/** Una lectura con solo lo que se envía (sin la hora ni otros datos del navegador). */
export const locationReading = (location: DeviceLocation): DeviceLocation => ({ latitude: location.latitude, longitude: location.longitude, accuracy: accuracyOf(location) });

/** Campos de un formulario multipart: `latitude`, `longitude`, `accuracy` y, si hay, `location_samples` (JSON). */
export function locationFormFields(location: LocationTake): Record<string, string> {
  const fields: Record<string, string> = { latitude: String(location.latitude), longitude: String(location.longitude), accuracy: String(accuracyOf(location)) };
  if (location.samples?.length) fields.location_samples = JSON.stringify(location.samples.map(locationReading));
  return fields;
}

/** Cuerpo JSON: `location` (la que decide) y `location_samples` (todas). */
export function locationJson(location: LocationTake): { location: DeviceLocation; location_samples: DeviceLocation[] } {
  return { location: locationReading(location), location_samples: (location.samples ?? []).map(locationReading) };
}
