import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
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
    expect(iphone.map((d) => d.label)).toEqual(['Cámara frontal', 'Cámara trasera', 'Cámara trasera (ultra gran angular)', 'Cámara trasera (teleobjetivo)']);
    expect(iphone.map((d) => d.rawLabel)).toEqual(['Front Camera', 'Back Camera', 'Back Ultra Wide Camera', 'Back Telephoto Camera']); // el original, para las reglas
    expect(desktop.map((d) => d.label)).toEqual(['Cámara frontal', 'Logitech C920']); // un modelo con marca es un nombre propio
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

describe('cameraDevices: los nombres del sistema no mezclan idiomas (regla 16)', () => {
  const labels = (...names: string[]) => toCameraDevices(names.map((label, i) => ({ deviceId: `d${i}`, label }))).map((d) => d.label);

  it('las cámaras del equipo, nombradas por el sistema en cualquier idioma, salen con el texto de la app', () => {
    // iPhone en inglés y en español, Android, Mac, Windows y sistemas en portugués, francés, alemán e italiano.
    expect(labels('Front Camera', 'Front TrueDepth Camera')).toEqual(['Cámara frontal 1', 'Cámara frontal 2']);
    expect(labels('Back Dual Wide Camera', 'Back Triple Camera', 'Cámara trasera ultra gran angular', 'Cámara trasera con teleobjetivo', 'Back Wide Camera')).toEqual([
      'Cámara trasera (dual)',
      'Cámara trasera (triple)',
      'Cámara trasera (ultra gran angular)',
      'Cámara trasera (teleobjetivo)',
      'Cámara trasera (gran angular)',
    ]);
    expect(labels('camera2 1, facing front', 'camera2 0, facing back')).toEqual(['Cámara frontal', 'Cámara trasera']);
    expect(labels('FaceTime HD Camera (Built-in)', 'Integrated Webcam')).toEqual(['Cámara frontal', 'Cámara']);
    expect(labels('Câmera traseira', 'Caméra arrière', 'Rückkamera', 'Fotocamera anteriore')).toEqual(['Cámara trasera 1', 'Cámara trasera 2', 'Cámara trasera 3', 'Cámara frontal']);
    expect(labels('', '')).toEqual(['Cámara 1', 'Cámara 2']); // sin permiso aún no hay nombres
  });

  it('una cámara externa conserva su nombre propio (sin el identificador USB)', () => {
    expect(labels('Logitech BRIO (046d:085e)', 'HP TrueVision HD Camera', 'Logitech BRIO (046d:085e)')).toEqual(['Logitech BRIO 1', 'HP TrueVision HD Camera', 'Logitech BRIO 2']);
  });

  it('en inglés, los mismos nombres con los textos en inglés', async () => {
    await setLocale('en-US');
    expect(labels('Cámara trasera ultra gran angular', 'Front Camera', 'Back Telephoto Camera')).toEqual(['Back camera (ultra wide)', 'Front camera', 'Back camera (telephoto)']);
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

  it('reconoce las cámaras virtuales en los idiomas de los sistemas, con o sin acentos, sin bloquear las cámaras reales (D-C4)', () => {
    const list = ['virtual', 'virtuelle', 'virtuell', 'virtuel', 'virtuale', 'câmera virtual', 'cámara virtual', 'caméra virtuelle', 'virtuelle kamera', 'fotocamera virtuale'];
    for (const label of ['Câmera virtual', 'Camera Virtual', 'Cámara virtual', 'Camara virtual', 'Caméra virtuelle', 'Camera virtuelle', 'Virtuelle Kamera', 'Fotocamera virtuale', 'Périphérique virtuel', 'OBS Virtual Camera', 'OBS-Kamera (virtuell)']) {
      expect(isVirtualCamera(label, list), label).toBe(true);
    }
    for (const label of ['FaceTime HD Camera', 'Integrated Camera', 'Câmera frontal', 'Caméra avant', 'Vordere Kamera', 'Fotocamera anteriore', 'Virtualmente', 'Virtuelles', 'Logitech BRIO']) {
      expect(isVirtualCamera(label, list), label).toBe(false);
    }
    expect(isVirtualCamera('Camera virtual', ['Câmera Virtual'])).toBe(true); // la lista también se compara sin acentos ni mayúsculas
  });
});
