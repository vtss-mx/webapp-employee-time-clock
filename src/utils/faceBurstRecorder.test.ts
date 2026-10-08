import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BurstSpec } from '../types/capture';
import { config } from './config';
import { createSurface, encodeSurface, FaceBurstRecorder } from './faceBurstRecorder';

const SPEC: BurstSpec = { tile: 112, hold: 3, move: 2, fps: 10, quality: 0.85, margin: 1.6, max_bytes: 1000, min_frames: 2 };
const STEP = 1000 / config.faceBurstFps;
/** Lado de cada recorte en espera y lo que la hoja toma de él: el margen del servidor (1.6) del de espera (2). */
const STAGED = config.faceBurstStagingPx;
const INNER = STAGED * (1.6 / 2);

interface FakeSurface {
  width: number;
  height: number;
  ctx: { drawImage: ReturnType<typeof vi.fn> } | null;
  getContext: () => FakeSurface['ctx'];
  convertToBlob: ReturnType<typeof vi.fn>;
}

/** Lienzos simulados: registran lo que se dibuja y codifican lo que diga la prueba. */
function surfaces(blobs: (Blob | null)[] = [new Blob(['hoja'])], context = true) {
  const made: FakeSurface[] = [];
  const factory = (width: number, height: number) => {
    const surface: FakeSurface = {
      width,
      height,
      ctx: context ? { drawImage: vi.fn() } : null,
      getContext: () => surface.ctx,
      convertToBlob: vi.fn(() => Promise.resolve(blobs.shift() ?? null)),
    };
    made.push(surface);
    return surface as unknown as OffscreenCanvas;
  };
  return { made, factory };
}

/** Un video simulado (sin `requestVideoFrameCallback`: el recolector usa su temporizador). */
function video(width = 1280, height = 720) {
  return { videoWidth: width, videoHeight: height } as HTMLVideoElement;
}

const tick = (ms = STEP) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('FaceBurstRecorder', () => {
  it('recorta a su ritmo el tramo quieto y luego el de movimiento, y arma la hoja con lo que pidió el servidor', async () => {
    const { made, factory } = surfaces();
    const recorder = new FaceBurstRecorder(() => video(), factory);
    const seen: number[] = [];
    const stop = recorder.subscribe(() => seen.push(recorder.held()));
    recorder.start({ x: 500, y: 200, width: 200, height: 200 });
    await tick();
    await tick();
    expect(seen).toEqual([0, 1, 2]); // el reinicio y cada recorte del tramo quieto avisan (el anillo los cuenta)
    stop();
    const settled = recorder.settle(SPEC);
    await tick();
    await tick();
    await settled; // ya tiene los 3 del tramo quieto
    recorder.pause();
    await tick(STEP * 3);
    const stage = made[0];
    expect(stage.width).toBe(10 * config.faceBurstStagingPx);
    expect(stage.ctx?.drawImage).toHaveBeenCalledTimes(4);
    // La zona: el rostro con el margen de espera (2), recortada al lado de espera en su lugar del lienzo de espera.
    expect(stage.ctx?.drawImage.mock.calls[1]).toEqual([expect.anything(), 400, 100, 400, 400, STAGED, 0, STAGED, STAGED]);
    expect(recorder.held()).toBe(4);
    recorder.move();
    recorder.move(); // una sola vez por toma
    await tick();
    await tick();
    const burst = await recorder.take(SPEC);
    expect(burst?.image).toBeInstanceOf(Blob);
    const meta = JSON.parse(burst?.meta ?? '{}');
    expect(meta).toMatchObject({ v: 1, tile: 112, cols: 5, s: 'HHHMM' });
    expect(meta.t[0]).toBe(0);
    const sheet = made[1];
    expect([sheet.width, sheet.height]).toEqual([560, 112]);
    // Cada recorte se reduce al margen del servidor (1.6 de 2: el 80 % central) y al lado de la hoja.
    const offset = (STAGED - INNER) / 2;
    expect(sheet.ctx?.drawImage.mock.calls[0]).toEqual([stage, STAGED + offset, offset, INNER, INNER, 0, 0, 112, 112]);
    expect(sheet.convertToBlob).toHaveBeenCalledWith({ type: 'image/jpeg', quality: 0.85 });
  });

  it('sigue los cuadros nuevos del video y deja de pedirlos al pausar', () => {
    const next: { callback: ((now: number) => void) | null } = { callback: null };
    const cancel = vi.fn();
    const source = {
      ...video(),
      requestVideoFrameCallback: vi.fn((fn: (now: number) => void) => {
        next.callback = fn;
        return 7;
      }),
      cancelVideoFrameCallback: cancel,
    } as unknown as HTMLVideoElement;
    const { made, factory } = surfaces();
    const recorder = new FaceBurstRecorder(() => source, factory);
    recorder.start();
    next.callback?.(1000);
    next.callback?.(1030); // muy pronto para el ritmo de la ráfaga: no se recorta
    next.callback?.(1000 + STEP);
    expect(made[0].ctx?.drawImage).toHaveBeenCalledTimes(2);
    recorder.pause();
    expect(cancel).toHaveBeenCalledWith(7);
    next.callback?.(2000); // un cuadro que ya venía en camino no recorta nada
    expect(made[0].ctx?.drawImage).toHaveBeenCalledTimes(2);
  });

  it('sin lo necesario no hay hoja: sin reto, sin video, sin recortes suficientes o sin poder dibujar o codificar', async () => {
    expect(await new FaceBurstRecorder(() => null).take(SPEC)).toBeNull(); // sin video nunca recortó
    const { factory } = surfaces();
    const recorder = new FaceBurstRecorder(() => video(), factory);
    recorder.move(); // sin tramo quieto no hay movimiento
    recorder.start();
    await tick();
    expect(await recorder.take(null)).toBeNull();
    expect(await recorder.take(SPEC)).toBeNull(); // 1 recorte < min_frames
    const noSheet = surfaces([new Blob(['x'])]);
    let made = 0;
    const flaky = new FaceBurstRecorder(
      () => video(),
      (width, height) => (made++ === 0 ? noSheet.factory(width, height) : surfaces([], false).factory(width, height)),
    );
    flaky.start();
    await tick();
    await tick();
    expect(await flaky.take(SPEC)).toBeNull(); // la hoja no tiene contexto 2D
    const empty = surfaces([null]);
    const unencoded = new FaceBurstRecorder(() => video(), empty.factory);
    unencoded.start();
    await tick();
    await tick();
    expect(await unencoded.take(SPEC)).toBeNull();
  });

  it('una hoja muy pesada se codifica una vez con menos calidad; si aún pesa, no se manda', async () => {
    const big = new Blob(['x'.repeat(2000)]);
    const small = new Blob(['ok']);
    const light = surfaces([big, small]);
    const recorder = new FaceBurstRecorder(() => video(), light.factory);
    recorder.start();
    await tick();
    await tick();
    expect((await recorder.take(SPEC))?.image).toBe(small);
    expect(light.made[1].convertToBlob).toHaveBeenLastCalledWith({ type: 'image/jpeg', quality: 0.7 });
    const heavy = surfaces([big, big]);
    const again = new FaceBurstRecorder(() => video(), heavy.factory);
    again.start();
    await tick();
    await tick();
    expect(await again.take({ ...SPEC, quality: 0.55 })).toBeNull();
    expect(heavy.made[1].convertToBlob).toHaveBeenLastCalledWith({ type: 'image/jpeg', quality: 0.5 });
  });

  it('no recorta sin imagen, sin lienzo ni pasado su tope; esperar el tramo quieto tiene tope', async () => {
    const blind = surfaces();
    const dark = new FaceBurstRecorder(() => video(0, 0), blind.factory);
    dark.start();
    await tick();
    expect(blind.made).toHaveLength(0);
    const noContext = surfaces([], false);
    const recorder = new FaceBurstRecorder(() => video(), noContext.factory);
    recorder.start();
    await tick();
    const waited = recorder.settle(SPEC);
    await tick(config.faceBurstHoldWaitMs + STEP);
    await waited; // nunca llegó a 3 recortes: se rinde a tiempo
    await recorder.settle(null);
    recorder.pause();
    await recorder.settle(SPEC); // sin tramo quieto en curso, nada que esperar
    const full = surfaces();
    const capped = new FaceBurstRecorder(() => video(), full.factory);
    capped.start();
    await tick(STEP * (config.faceBurstMaxFrames + 5));
    expect(full.made[0].ctx?.drawImage).toHaveBeenCalledTimes(config.faceBurstMaxFrames);
    capped.reset();
  });
});

describe('lienzos fuera de la pantalla', () => {
  it('usa OffscreenCanvas donde existe y un canvas sin montar donde no', () => {
    class FakeOffscreen {
      constructor(
        public width: number,
        public height: number,
      ) {}
    }
    vi.stubGlobal('OffscreenCanvas', FakeOffscreen);
    expect(createSurface(10, 20)).toMatchObject({ width: 10, height: 20 });
    vi.unstubAllGlobals();
    vi.stubGlobal('OffscreenCanvas', undefined);
    const canvas = createSurface(30, 40);
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect([canvas.width, canvas.height]).toEqual([30, 40]);
  });

  it('con un canvas sin montar (sin OffscreenCanvas) también recorta y arma la hoja con toBlob', async () => {
    const drawn = vi.fn();
    const sheet = new Blob(['hoja']);
    const canvas = () =>
      ({ getContext: () => ({ drawImage: drawn }), toBlob: (done: (value: Blob | null) => void) => done(sheet) }) as unknown as HTMLCanvasElement;
    const recorder = new FaceBurstRecorder(() => video(), canvas);
    recorder.start({ x: 500, y: 200, width: 200, height: 240 });
    await tick();
    await tick();
    const taken = await recorder.take(SPEC);
    expect(taken?.image).toBe(sheet);
    expect(drawn).toHaveBeenCalled();
  });

  it('codifica con convertToBlob o con toBlob; una falla al codificar no se propaga', async () => {
    const offscreen = { convertToBlob: () => Promise.reject(new Error('sin memoria')) } as unknown as OffscreenCanvas;
    expect(await encodeSurface(offscreen, 0.8)).toBeNull();
    const blob = new Blob(['jpeg']);
    const canvas = { toBlob: (done: (value: Blob | null) => void) => done(blob) } as unknown as HTMLCanvasElement;
    expect(await encodeSurface(canvas, 0.8)).toBe(blob);
  });
});
