import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeviceLocation } from './geolocation';
import { sampleLocation } from './locationSampling';

// El aviso nativo y sus errores se prueban en `geolocation.test.ts`; aquí, cuántas lecturas se toman y cuál decide.
const geo = vi.hoisted(() => ({ read: vi.fn<(options?: { timeoutMs?: number }) => Promise<DeviceLocation>>() }));
vi.mock('./geolocation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  currentLocation: (options?: { timeoutMs?: number }) => geo.read(options),
}));

const at = (accuracy: number): DeviceLocation => ({ latitude: 29.07 + accuracy / 1e5, longitude: -110.95, accuracy });

afterEach(() => {
  geo.read.mockReset();
  vi.useRealTimers();
});

describe('varias lecturas de la ubicación (antifraude 1b)', () => {
  it('toma las que pide la configuración y la más precisa decide', async () => {
    geo.read.mockResolvedValueOnce(at(20)).mockResolvedValueOnce(at(8)).mockResolvedValueOnce(at(12));
    const { best, samples } = await sampleLocation({ samples: 3, windowMs: 3000 });
    expect(samples.map((s) => s.accuracy)).toEqual([20, 8, 12]);
    expect(best.accuracy).toBe(8);
    expect(geo.read.mock.calls[1][0]?.timeoutMs).toBeGreaterThan(0); // las de más con el tiempo que queda
  });

  it('la primera manda: sus errores llegan a quien registra', async () => {
    geo.read.mockRejectedValueOnce(new Error('denegado'));
    await expect(sampleLocation({ samples: 3, windowMs: 3000 })).rejects.toThrow('denegado');
  });

  it('una lectura de más que falla, no llega o se acaba el tiempo no impide registrar con las que hay', async () => {
    geo.read.mockResolvedValueOnce(at(10)).mockRejectedValueOnce(new Error('sin señal'));
    expect((await sampleLocation({ samples: 3, windowMs: 3000 })).samples).toHaveLength(1);

    vi.useFakeTimers();
    geo.read.mockResolvedValueOnce(at(10)).mockReturnValueOnce(new Promise(() => undefined)); // nunca responde
    const pending = sampleLocation({ samples: 3, windowMs: 1500 });
    await vi.advanceTimersByTimeAsync(1600);
    expect((await pending).samples).toHaveLength(1);

    geo.read.mockResolvedValueOnce(at(10));
    expect((await sampleLocation({ samples: 3, windowMs: 0 })).samples).toHaveLength(1); // sin ventana: solo la primera
  });
});
