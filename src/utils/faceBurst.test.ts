import { describe, expect, it } from 'vitest';
import type { BurstSpec } from '../types/capture';
import { burstMeta, burstRegion, pickFrames, sheetSize, type StagedFrame } from './faceBurst';

const SPEC: BurstSpec = { tile: 112, hold: 3, move: 2, fps: 10, quality: 0.85, margin: 1.6, max_bytes: 400_000, min_frames: 2 };

const frame = (slot: number, segment: 'H' | 'M', t = slot * 100): StagedFrame => ({ slot, t, segment });

describe('ráfaga de recortes del rostro (antifraude 2a)', () => {
  it('recorta un cuadrado alrededor del rostro con su margen, dentro del cuadro; sin rostro, el centro', () => {
    expect(burstRegion({ x: 500, y: 200, width: 200, height: 250 }, 1280, 720, 1.6)).toEqual({ x: 400, y: 125, side: 400 });
    expect(burstRegion({ x: 0, y: 0, width: 200, height: 200 }, 1280, 720, 2)).toEqual({ x: 0, y: 0, side: 400 }); // pegado a la orilla
    expect(burstRegion({ x: 1200, y: 600, width: 200, height: 200 }, 1280, 720, 2)).toEqual({ x: 880, y: 320, side: 400 });
    expect(burstRegion({ x: 0, y: 0, width: 900, height: 900 }, 1280, 720, 2).side).toBe(720); // nunca más que el cuadro
    expect(burstRegion(null, 1280, 720, 1.6)).toEqual({ x: 424, y: 144, side: 432 });
    expect(burstRegion(undefined, 0, 0, 1.6).side).toBe(1);
  });

  it('a la hoja van los últimos recortes quietos (contiguos) y los primeros del movimiento', () => {
    const frames = [frame(0, 'H'), frame(1, 'H'), frame(2, 'H'), frame(3, 'H'), frame(4, 'M'), frame(5, 'M'), frame(6, 'M')];
    expect(pickFrames(frames, SPEC).map((f) => f.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(pickFrames([frame(0, 'H')], SPEC).map((f) => f.slot)).toEqual([0]);
  });

  it('describe la hoja: columnas, tiempos desde el primer recorte y tramos', () => {
    expect(sheetSize(SPEC, 5)).toEqual({ width: 560, height: 112, columns: 5 });
    expect(sheetSize(SPEC, 20)).toEqual({ width: 896, height: 336, columns: 8 });
    expect(sheetSize(SPEC, 0).columns).toBe(1);
    const meta = JSON.parse(burstMeta(SPEC, [frame(1, 'H', 250.4), frame(2, 'H', 351), frame(3, 'M', 900)]));
    expect(meta).toEqual({ v: 1, tile: 112, cols: 3, t: [0, 101, 650], s: 'HHM' });
    expect(JSON.parse(burstMeta(SPEC, [])).t).toEqual([]);
  });
});
