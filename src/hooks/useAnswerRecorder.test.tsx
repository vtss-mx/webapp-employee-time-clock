import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../utils/config';
import { meterValue, microphoneStatus, MIME_CANDIDATES, pickMimeType, rmsLevel, useAnswerRecorder, useMicLevel } from './useAnswerRecorder';

/*
 * Grabadora simulada: `MediaRecorder`, `MediaStream`, el micrófono (`getUserMedia`) y el analizador de audio del navegador
 * no existen en jsdom; la prueba decide qué entrega cada uno y cuándo termina la grabación.
 */

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static supported = new Set(['video/webm;codecs=vp8,opus', 'video/webm']);
  /** La siguiente grabación termina sin datos (un trozo vacío). */
  static emptyNext = false;
  static isTypeSupported(type: string) {
    return FakeRecorder.supported.has(type);
  }
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    public stream: MediaStream,
    public options: MediaRecorderOptions,
  ) {
    FakeRecorder.instances.push(this);
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(FakeRecorder.emptyNext ? [] : ['chunk'], { type: this.options.mimeType }) });
    this.onstop?.();
  }
}

const audioTrack = { kind: 'audio', stop: vi.fn() } as unknown as MediaStreamTrack;
const videoTrack = { kind: 'video' } as unknown as MediaStreamTrack;

function installBrowser({ mic = 'ok', analyser = true }: { mic?: 'ok' | 'denied' | 'error' | 'missing'; analyser?: boolean } = {}) {
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal(
    'MediaStream',
    class {
      constructor(public tracks: MediaStreamTrack[]) {}
      getAudioTracks() {
        return this.tracks.filter((t) => t.kind === 'audio');
      }
      getTracks() {
        return this.tracks;
      }
    },
  );
  const getUserMedia = vi.fn(() => {
    if (mic === 'denied') return Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    if (mic === 'error') return Promise.reject(new Error('busy'));
    return Promise.resolve(new (globalThis as unknown as { MediaStream: new (t: MediaStreamTrack[]) => MediaStream }).MediaStream([audioTrack]));
  });
  Object.defineProperty(navigator, 'mediaDevices', { value: mic === 'missing' ? undefined : { getUserMedia }, configurable: true });
  const samples = { level: 0, closeRejects: false };
  if (analyser) {
    vi.stubGlobal(
      'AudioContext',
      class {
        close = vi.fn(() => (samples.closeRejects ? Promise.reject(new Error('closed')) : Promise.resolve()));
        createAnalyser() {
          return {
            fftSize: 0,
            getFloatTimeDomainData(target: Float32Array) {
              target.fill(samples.level);
            },
          };
        }
        createMediaStreamSource() {
          return { connect: vi.fn() };
        }
      },
    );
  } else {
    vi.stubGlobal('AudioContext', undefined);
  }
  return { getUserMedia, samples };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecorder.instances = [];
  FakeRecorder.emptyNext = false;
  FakeRecorder.supported = new Set(['video/webm;codecs=vp8,opus', 'video/webm']);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAnswerRecorder: una respuesta en video con audio', () => {
  it('pide el micrófono, graba con el formato que el navegador declara y termina con «Listo»', async () => {
    const { getUserMedia } = installBrowser();
    const { result } = renderHook(() => useAnswerRecorder(() => videoTrack));
    expect(result.current.status).toBe('idle');
    await act(() => result.current.prepare());
    await act(() => result.current.prepare()); // el modo estricto corre los efectos dos veces: UN aviso del micrófono
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: true });
    expect(result.current.status).toBe('ready');
    let clip: Promise<Blob | null> | undefined;
    act(() => {
      clip = result.current.start();
    });
    expect(result.current.status).toBe('recording');
    const recorder = FakeRecorder.instances[0];
    expect(recorder.options).toEqual({ mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: config.voiceVideoBitrateKbps * 1000, audioBitsPerSecond: 32_000 });
    expect(recorder.stream.getTracks()).toEqual([videoTrack, audioTrack]);
    await act(() => vi.advanceTimersByTimeAsync(1100));
    expect(result.current.elapsedSeconds).toBe(1);
    act(() => result.current.stop());
    const blob = await clip!;
    expect(blob?.type).toBe('video/webm;codecs=vp8,opus');
    expect(result.current.status).toBe('ready');
    expect(result.current.elapsedSeconds).toBe(0);
    act(() => recorder.onerror?.()); // una falla tardía de una grabación ya terminada no hace nada más
    expect(FakeRecorder.instances).toHaveLength(1);
  });

  it('termina sola tras el silencio que sigue a la voz, y publica el nivel del micrófono', async () => {
    const { samples } = installBrowser();
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      setTimeout(() => cb(performance.now()), 100);
      return 1;
    });
    const { result } = renderHook(() => useAnswerRecorder(() => videoTrack));
    await act(() => result.current.prepare());
    const { result: level } = renderHook(() => useMicLevel(result.current));
    let clip: Promise<Blob | null> | undefined;
    act(() => {
      clip = result.current.start();
    });
    samples.level = config.voiceLevelFullScale; // voz
    await act(() => vi.advanceTimersByTimeAsync(config.voiceMinSpeechMs + 300));
    expect(level.current).toBe(1);
    samples.level = 0; // silencio
    await act(() => vi.advanceTimersByTimeAsync(config.voiceSilenceStopMs + 300));
    const blob = await clip!;
    expect(blob).not.toBeNull();
    expect(level.current).toBe(0);
    raf.mockRestore();
  });

  it('el tope de duración detiene la grabación; sin analizador de audio no mide nada pero graba igual', async () => {
    installBrowser({ analyser: false });
    const { result } = renderHook(() => useAnswerRecorder(() => videoTrack));
    await act(() => result.current.prepare());
    let clip: Promise<Blob | null> | undefined;
    act(() => {
      clip = result.current.start();
    });
    await act(() => vi.advanceTimersByTimeAsync(config.voiceMaxAnswerSeconds * 1000 + 10));
    expect(await clip!).not.toBeNull();
  });

  it('sin MediaRecorder o sin formato con audio y video, no se puede grabar aquí', async () => {
    installBrowser();
    FakeRecorder.supported = new Set();
    const { result } = renderHook(() => useAnswerRecorder(() => videoTrack));
    await act(() => result.current.prepare());
    expect(result.current.status).toBe('unsupported');
    vi.stubGlobal('MediaRecorder', undefined);
    expect(pickMimeType()).toBeNull();
    const { result: without } = renderHook(() => useAnswerRecorder(() => videoTrack));
    await act(() => without.current.prepare());
    expect(without.current.status).toBe('unsupported');
  });

  it('el micrófono negado y otras fallas tienen su estado; sin pista de video no se graba', async () => {
    installBrowser({ mic: 'denied' });
    const { result } = renderHook(() => useAnswerRecorder(() => videoTrack));
    await act(() => result.current.prepare());
    expect(result.current.status).toBe('denied');
    installBrowser({ mic: 'error' });
    const { result: failing } = renderHook(() => useAnswerRecorder(() => videoTrack));
    await act(() => failing.current.prepare());
    expect(failing.current.status).toBe('error');
    installBrowser({ mic: 'missing' });
    const { result: none } = renderHook(() => useAnswerRecorder(() => videoTrack));
    await act(() => none.current.prepare());
    expect(none.current.status).toBe('unsupported');
    installBrowser();
    const { result: noVideo } = renderHook(() => useAnswerRecorder(() => null));
    await act(() => noVideo.current.prepare());
    let clip: Promise<Blob | null> | undefined;
    act(() => {
      clip = noVideo.current.start();
    });
    expect(await clip!).toBeNull();
    expect(noVideo.current.status).toBe('error');
  });

  it('una falla de la grabadora a medio camino resuelve sin clip y libera el micrófono al desmontar (aunque el audio no cierre bien)', async () => {
    const { samples } = installBrowser();
    samples.closeRejects = true;
    const { result, unmount } = renderHook(() => useAnswerRecorder(() => videoTrack));
    await act(() => result.current.prepare());
    let clip: Promise<Blob | null> | undefined;
    act(() => {
      clip = result.current.start();
    });
    const recorder = FakeRecorder.instances[0];
    recorder.ondataavailable?.({ data: new Blob(['parte'], { type: 'video/webm' }) }); // lo grabado hasta la falla se descarta
    FakeRecorder.emptyNext = true; // tras la falla el navegador entrega un trozo vacío y luego `stop`
    act(() => recorder.onerror?.()); // aún grababa: la falla la detiene y su `stop` llega después
    expect(await clip!).toBeNull();
    expect(result.current.status).toBe('error'); // sigue siendo una falla, no «listo»
    // Una falla con la grabadora ya detenida resuelve igual sin clip.
    act(() => {
      clip = result.current.start();
    });
    const second = FakeRecorder.instances[1];
    second.state = 'inactive';
    act(() => second.onerror?.());
    expect(await clip!).toBeNull();
    expect(result.current.status).toBe('error');
    unmount();
    expect(audioTrack.stop).toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('una grabación que termina sin datos (trozos vacíos) resuelve sin clip; grabar sin haber pedido el micrófono es una falla', async () => {
    installBrowser();
    FakeRecorder.emptyNext = true;
    const { result } = renderHook(() => useAnswerRecorder(() => videoTrack));
    let clip: Promise<Blob | null> | undefined;
    act(() => {
      clip = result.current.start(); // sin `prepare`: no hay pista de audio ni formato
    });
    expect(await clip!).toBeNull();
    expect(result.current.status).toBe('error');
    await act(() => result.current.prepare());
    act(() => {
      clip = result.current.start();
    });
    act(() => result.current.stop());
    expect(await clip!).toBeNull();
    expect(result.current.status).toBe('ready');
  });

  it('reglas puras: formatos preferidos, RMS, medidor y motivo del micrófono', () => {
    expect(MIME_CANDIDATES[0]).toContain('video/webm'); // MP4 solo donde no hay WebM (WebKit)
    expect(MIME_CANDIDATES.at(-1)).toBe('video/mp4');
    expect(rmsLevel(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rmsLevel(new Float32Array(0))).toBe(0);
    expect(meterValue(config.voiceLevelFullScale * 2)).toBe(1);
    expect(meterValue(0)).toBe(0);
    expect(microphoneStatus({ name: 'NotAllowedError' })).toBe('denied');
    expect(microphoneStatus({ name: 'SecurityError' })).toBe('denied');
    expect(microphoneStatus(new Error('x'))).toBe('error');
    expect(microphoneStatus(null)).toBe('error');
  });
});
