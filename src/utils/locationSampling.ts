/**
 * Varias lecturas de la ubicación en una ventana corta (antifraude 1b, `docs/rd/antifraude-identidad.md` §2.7): un GPS
 * real tiembla y su precisión cambia; un simulador repite la misma lectura. Las viaja cada verificación para que
 * el SERVIDOR lo mida (la que decide la geocerca es la más precisa).
 */
import { config } from './config';
import { currentLocation, type DeviceLocation } from './geolocation';
import { sleep } from './waits';

/** Una toma: la lectura más precisa y todas, en orden. */
export interface LocationSampling {
  best: DeviceLocation;
  samples: DeviceLocation[];
}

/**
 * La primera lectura es la de siempre (aviso nativo, sus errores y su tiempo límite); las demás son de mejor esfuerzo
 * dentro de `windowMs` (una que falla, no llega o tarda no impide registrar: se registra con las que hay).
 */
export async function sampleLocation({ samples = config.locationSamples, windowMs = config.locationSampleWindowMs } = {}): Promise<LocationSampling> {
  const readings = [await currentLocation()];
  const deadline = Date.now() + windowMs;
  while (readings.length < samples && Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const next = await Promise.race([currentLocation({ timeoutMs: remaining }).catch(() => null), sleep(remaining).then(() => null)]);
    if (!next) break;
    readings.push(next);
  }
  const best = readings.reduce((winner, reading) => (reading.accuracy < winner.accuracy ? reading : winner));
  return { best, samples: readings };
}
