import { describe, expect, it } from 'vitest';
import { locationFormFields, locationJson, locationReading } from './locationPayload';

const best = { latitude: 29.1, longitude: -110.9, accuracy: 12 };

describe('ubicación como la recibe el backend', () => {
  it('multipart: la que decide y, si hay, todas las lecturas en JSON; la precisión con tope', () => {
    expect(locationFormFields(best)).toEqual({ latitude: '29.1', longitude: '-110.9', accuracy: '12' });
    expect(locationFormFields({ ...best, samples: [] })).not.toHaveProperty('location_samples');
    const fields = locationFormFields({ ...best, accuracy: 250_000, samples: [best, { ...best, accuracy: 900_000, extra: 1 } as typeof best] });
    expect(fields.accuracy).toBe('100000');
    expect(JSON.parse(fields.location_samples)).toEqual([best, { ...best, accuracy: 100_000 }]);
  });

  it('JSON: `location` y `location_samples` (vacío si no hay lecturas)', () => {
    expect(locationJson(best)).toEqual({ location: best, location_samples: [] });
    expect(locationJson({ ...best, samples: [best] })).toEqual({ location: best, location_samples: [best] });
    expect(locationReading({ ...best, accuracy: 100_001 })).toEqual({ ...best, accuracy: 100_000 });
  });
});
