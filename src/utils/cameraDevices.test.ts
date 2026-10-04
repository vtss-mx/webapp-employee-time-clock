import { describe, expect, it } from 'vitest';
import {
  isVirtualCamera,
  activeKind,
  cameraConstraints,
  kindLabel,
  parseRemembered,
  rememberedFor,
  shouldMirror,
  switchTarget,
  toCameraDevices,
} from './cameraDevices';

// Un iPhone: frontal y varias lentes traseras.
const iphone = toCameraDevices([
  { deviceId: 'f', label: 'Front Camera' },
  { deviceId: 'b', label: 'Back Camera' },
  { deviceId: 'uw', label: 'Back Ultra Wide Camera' },
  { deviceId: 't', label: 'Back Telephoto Camera' },
]);
// Una computadora con dos webcams sin lado.
const desktop = toCameraDevices([
  { deviceId: 'w1', label: 'FaceTime HD' },
  { deviceId: 'w2', label: 'Logitech C920' },
]);

describe('cameraDevices: elección de cámara', () => {
  it('nombra cada cámara y su lado', () => {
    expect(iphone.map((d) => d.label)).toEqual(['Cámara frontal', 'Cámara trasera 1', 'Cámara trasera 2', 'Cámara trasera 3']);
    expect(activeKind('user', '')).toBe('front');
    expect(activeKind('environment', 'Front Camera')).toBe('back'); // manda lo que informa el navegador
    expect(activeKind(undefined, 'Back Camera')).toBe('back');
    expect(kindLabel('front')).toBe('Cámara frontal');
    expect(kindLabel('back')).toBe('Cámara trasera');
    expect(kindLabel('unknown')).toBe('Cámara');
  });

  it('en el teléfono, cambiar alterna frontal ↔ trasera (lente principal), no recorre todas las lentes', () => {
    expect(switchTarget(iphone, 'f', 'front')).toEqual({ facing: 'environment' });
    expect(switchTarget(iphone, 'uw', 'back')).toEqual({ facing: 'user' });
    expect(cameraConstraints('user', { facing: 'environment' }).video).toMatchObject({ facingMode: { exact: 'environment' } });
  });

  it('en la computadora, cambiar pasa a la siguiente webcam; con una sola no hay cambio', () => {
    expect(switchTarget(desktop, 'w1', 'unknown')).toEqual({ deviceId: 'w2' });
    expect(switchTarget(desktop, 'w2', 'unknown')).toEqual({ deviceId: 'w1' });
    expect(switchTarget(desktop.slice(0, 1), 'w1', 'unknown')).toBeNull();
    expect(cameraConstraints('user', { deviceId: 'w2' }).video).toMatchObject({ deviceId: { exact: 'w2' } });
    expect(cameraConstraints('user').video).toMatchObject({ facingMode: { ideal: 'user' } });
  });

  it('la cámara recordada solo se reabre si sirve para el propósito (el bug: quedaba la trasera en el rostro)', () => {
    const back = parseRemembered({ deviceId: 'b', kind: 'back' });
    expect(rememberedFor(back, 'user')).toBeUndefined(); // escáner facial: vuelve a la frontal
    expect(rememberedFor(back, 'environment')).toBe('b'); // lector de QR: la trasera sí sirve
    const webcam = parseRemembered({ deviceId: 'w2', kind: 'unknown' });
    expect(rememberedFor(webcam, 'user')).toBe('w2'); // webcam elegida en la computadora
    expect(parseRemembered('b')).toBeNull(); // formato anterior (texto): se ignora
    expect(parseRemembered(null)).toBeNull();
    expect(rememberedFor(null, 'user')).toBeUndefined();
  });

  it('espejo solo para la frontal (o la webcam única de una computadora)', () => {
    expect(shouldMirror('front', 'user', 4)).toBe(true);
    expect(shouldMirror('back', 'user', 4)).toBe(false);
    expect(shouldMirror('unknown', 'user', 1)).toBe(true);
    expect(shouldMirror('unknown', 'user', 2)).toBe(false);
  });
});

describe('cámaras virtuales', () => {
  const blocked = ['virtual', 'manycam', 'camo', 'snap camera'];
  it('se reconocen por palabra completa (sin confundir cámaras reales)', () => {
    for (const label of ['OBS Virtual Camera', 'ManyCam Virtual Webcam', 'Camo', 'Snap Camera']) expect(isVirtualCamera(label, blocked)).toBe(true);
    for (const label of ['FaceTime HD Camera', 'OBSBOT Tiny 2', 'Camouflage cam', 'Back Dual Wide Camera', '']) expect(isVirtualCamera(label, blocked)).toBe(false);
    expect(isVirtualCamera(null, blocked)).toBe(false);
    expect(isVirtualCamera('OBS Virtual Camera', [])).toBe(false); // sin lista, no se bloquea en pantalla
    expect(isVirtualCamera('Cam (v1.2)', ['(v1.2)'])).toBe(true); // los nombres se escapan
  });
});
