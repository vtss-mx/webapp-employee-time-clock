import { describe, expect, it } from 'vitest';
import { face, videoElement } from '../test/faces';
import { config } from './config';
import { actionMeasure, actionProgress, actionTarget, averageSample, faceSample, moveProgress, pitchRatio, rollDegrees, yawRatio, type ActionMode } from './facePose';

/** Las mismas métricas que el servidor (app/facial_recognition/pose.py), con los puntos de MediaPipe. */
const video = videoElement();
const baseline = { pitch: 0.5, width: 200 };
const mode = (action: ActionMode['action'], minimum: number, base: ActionMode['baseline'] = baseline): ActionMode => ({ kind: 'action', action, minimum, baseline: base });

describe('pose de la cabeza (misma métrica que el backend)', () => {
  it('giro respecto a la distancia entre ojos; sin puntos suficientes o con ojos encimados no se mide', () => {
    expect(yawRatio(face(), video)).toBe(0);
    expect(yawRatio(face({ nose: 0.03 }), video)).toBeCloseTo(0.3);
    expect(yawRatio({ ...face(), keypoints: face().keypoints.slice(0, 2) }, video)).toBeNull();
    expect(yawRatio({ ...face(), keypoints: undefined } as never, video)).toBeNull();
    expect(yawRatio(face({ eyeGap: 0 }), video)).toBeNull();
  });

  it('inclinación lateral: el ángulo de la línea de los ojos en grados; sin dos ojos separados no se mide', () => {
    expect(rollDegrees(face(), video)).toBe(0);
    // `tilt` baja el ojo izquierdo de la imagen: la línea de los ojos sube hacia la derecha (ángulo negativo).
    expect(rollDegrees(face({ tilt: 0.02 }), video)).toBeCloseTo(-(Math.atan2(0.02 * 480, 0.1 * 640) * 180) / Math.PI);
    expect(rollDegrees(face({ tilt: -0.02 }), video)).toBeGreaterThan(0);
    expect(rollDegrees(face({ eyeGap: 0 }), video)).toBeNull();
    expect(rollDegrees({ ...face(), keypoints: face().keypoints.slice(0, 1) }, video)).toBeNull();
    expect(rollDegrees({ ...face(), keypoints: undefined } as never, video)).toBeNull();
  });

  it('altura de la nariz entre ojos (0) y boca (1); sin boca o con ojos y boca encimados no se mide', () => {
    expect(pitchRatio(face(), video)).toBeCloseTo(0.5);
    expect(pitchRatio(face({ pitch: 0.3 }), video)).toBeCloseTo(0.3); // mira arriba: baja
    expect(pitchRatio(face({ noMouth: true }), video)).toBeNull();
    expect(pitchRatio({ ...face(), keypoints: undefined } as never, video)).toBeNull();
    const flat = face();
    flat.keypoints[3] = { x: 0.5, y: 0.451 }; // la boca casi a la altura de los ojos
    expect(pitchRatio(flat, video)).toBeNull();
  });

  it('rostro en reposo: pitch y ancho de cada cuadro estable, y su promedio', () => {
    const box = { originX: 10, originY: 20, width: 180, height: 200 };
    expect(faceSample(face({ pitch: 0.4 }), box, video)).toEqual({ pitch: expect.closeTo(0.4) as number, width: 180, box: { x: 10, y: 20, width: 180, height: 200 } });
    expect(averageSample([])).toBeUndefined();
    expect(averageSample([{ pitch: 0.4, width: 180 }, { pitch: null, width: 220 }, { pitch: 0.6, width: 200 }])).toEqual({ pitch: expect.closeTo(0.5) as number, width: 200 });
    expect(averageSample([{ pitch: null, width: 200 }])).toEqual({ pitch: null, width: 200 });
    // La caja del rostro en reposo (la zona de la ráfaga): el promedio de las que se midieron.
    const boxed = averageSample([
      { pitch: 0.5, width: 100, box: { x: 10, y: 10, width: 100, height: 120 } },
      { pitch: 0.5, width: 120, box: { x: 30, y: 20, width: 120, height: 140 } },
      { pitch: 0.5, width: 110 },
    ]);
    expect(boxed?.box).toEqual({ x: 20, y: 15, width: 110, height: 130 });
  });
});

describe('movimientos del reto: medida, objetivo con margen y avance', () => {
  it('girar: hacia el lado pedido (positivo = su izquierda)', () => {
    expect(actionMeasure(face({ nose: 0.03 }), video, mode('TURN_LEFT', 0.2))).toBeCloseTo(0.3);
    expect(actionMeasure(face({ nose: 0.03 }), video, mode('TURN_RIGHT', 0.2))).toBeCloseTo(-0.3);
    expect(actionMeasure(face({ eyeGap: 0 }), video, mode('TURN_RIGHT', 0.2))).toBeNull();
    expect(actionTarget(mode('TURN_LEFT', 0.2))).toBeCloseTo(0.2 + config.faceTurnMargin);
  });

  it('mirar arriba o abajo: cambio del pitch contra el de frente', () => {
    expect(actionMeasure(face({ pitch: 0.38 }), video, mode('LOOK_UP', 0.08))).toBeCloseTo(0.12);
    expect(actionMeasure(face({ pitch: 0.38 }), video, mode('LOOK_DOWN', 0.08))).toBeCloseTo(-0.12);
    expect(actionMeasure(face({ pitch: 0.38 }), video, mode('LOOK_UP', 0.08, null))).toBeNull();
    expect(actionMeasure(face({ pitch: 0.38 }), video, mode('LOOK_UP', 0.08, { pitch: null, width: 200 }))).toBeNull();
    expect(actionMeasure(face({ noMouth: true }), video, mode('LOOK_DOWN', 0.08))).toBeNull();
    expect(actionTarget(mode('LOOK_DOWN', 0.08))).toBeCloseTo(0.08 + config.facePitchMargin);
  });

  it('acercarse: veces que crece el ancho del rostro', () => {
    expect(actionMeasure(face({ size: 300 }), video, mode('MOVE_CLOSER', 1.25))).toBeCloseTo(1.5);
    expect(actionMeasure(face({ box: false }), video, mode('MOVE_CLOSER', 1.25))).toBeNull();
    expect(actionMeasure(face({ size: 300 }), video, mode('MOVE_CLOSER', 1.25, null))).toBeNull();
    expect(actionTarget(mode('MOVE_CLOSER', 1.25))).toBeCloseTo(1.25 + config.faceCloserMargin);
  });

  it('avance 0..1 hacia el objetivo (acercarse: lo que crece sobre el tamaño de frente)', () => {
    const closer = mode('MOVE_CLOSER', 1.25);
    const target = actionTarget(closer);
    expect(actionProgress(1, closer)).toBe(0);
    expect(actionProgress(1 + (target - 1) / 2, closer)).toBeCloseTo(0.5);
    expect(actionProgress(2, closer)).toBe(1);
    expect(actionProgress(0.9, closer)).toBe(0); // se alejó
    const left = mode('TURN_LEFT', 0.2);
    expect(actionProgress(actionTarget(left) / 4, left)).toBeCloseTo(0.25);
    expect(actionProgress(-0.1, left)).toBe(0);
  });

  it('avance con lo que ve el detector: null sin un único rostro seguro o sin medida', () => {
    const left = mode('TURN_LEFT', 0.2);
    const target = actionTarget(left);
    expect(moveProgress([face({ nose: 0.01 })], video, left)).toBeCloseTo(0.1 / target);
    expect(moveProgress([face({ nose: 0.05 })], video, left)).toBe(1);
    expect(moveProgress([face({ nose: -0.01 })], video, mode('TURN_RIGHT', 0.2))).toBeCloseTo(0.1 / target);
    expect(moveProgress([face(), face()], video, left)).toBeNull();
    expect(moveProgress([face({ score: 0.2 })], video, left)).toBeNull();
    expect(moveProgress([{ ...face(), categories: [] }], video, left)).toBeNull();
    expect(moveProgress([face({ eyeGap: 0 })], video, left)).toBeNull();
  });
});
