import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import type { FaceChallenge } from '../types';
import { cancelCount, removeSpeechSupport, spokenTexts } from '../test/speechSynthesis';
import { faceSpeechCue, useFaceSpeech, type FaceSpeechInput } from './useFaceSpeech';

/** Un reto mínimo con la instrucción del paso (lo único que la guía por voz mira). */
const challengeWith = (instructions: string[]): FaceChallenge => ({ instructions, instruction: null }) as unknown as FaceChallenge;

// La preferencia de silencio se guarda en el dispositivo; aquí se simula con un mapa en memoria.
const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));
vi.mock('../utils/deviceStore', () => ({
  deviceStore: {
    get: (key: string) => Promise.resolve(store.get(key)),
    set: (key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    },
  },
}));

const base: FaceSpeechInput = { enabled: true, profile: 'FEMALE_WARM', phase: 'frontal', step: 0 };

beforeEach(() => store.clear());

describe('faceSpeechCue: qué se dice al entrar a cada fase', () => {
  it('pide la posición de frente, lee la instrucción del reto, pide centrar y avisa al enviar', () => {
    expect(faceSpeechCue({ phase: 'frontal', step: 0 })).toMatchObject({ key: 'position' });
    expect(faceSpeechCue({ phase: 'frontal', step: 0 })?.text()).toBe('Coloca tu rostro dentro de la guía y mira al frente.');
    const move = faceSpeechCue({ phase: 'challenge', step: 1, instruction: 'Gira la cabeza' });
    expect(move).toMatchObject({ key: 'move:1:Gira la cabeza' });
    expect(move?.text()).toBe('Gira la cabeza');
    expect(faceSpeechCue({ phase: 'challenge', step: 0, instruction: null })).toBeNull();
    // Al llegar (y sostener) el movimiento, un «sostén» corto en lugar de la instrucción.
    const hold = faceSpeechCue({ phase: 'challenge', step: 1, instruction: 'Gira la cabeza', holding: true });
    expect(hold).toMatchObject({ key: 'hold:1' });
    expect(hold?.text()).toBe('Sostén así.');
    expect(faceSpeechCue({ phase: 'recenter', step: 2 })).toMatchObject({ key: 'recenter:2' });
    expect(faceSpeechCue({ phase: 'submitting', step: 0 })).toMatchObject({ key: 'done' });
    expect(faceSpeechCue({ phase: 'checking', step: 0 })).toBeNull();
    expect(faceSpeechCue({ phase: 'blocked', step: 0 })).toBeNull();
  });
});

describe('useFaceSpeech', () => {
  it('lee cada indicación al entrar a su paso', async () => {
    const { rerender } = renderHook((props: FaceSpeechInput) => useFaceSpeech(props), { initialProps: base });
    await waitFor(() => expect(spokenTexts()).toContain('Coloca tu rostro dentro de la guía y mira al frente.'));
    rerender({ ...base, phase: 'challenge', challenge: challengeWith(['Gira la cabeza a tu derecha']) });
    await waitFor(() => expect(spokenTexts()).toContain('Gira la cabeza a tu derecha'));
    // Al sostener el movimiento se dice el «sostén» corto (mismo paso, otro código estable).
    rerender({ ...base, phase: 'challenge', challenge: challengeWith(['Gira la cabeza a tu derecha']), holding: true });
    await waitFor(() => expect(spokenTexts()).toContain('Sostén así.'));
    rerender({ ...base, phase: 'recenter', step: 1 });
    await waitFor(() => expect(spokenTexts()).toContain('Vuelve a mirar al frente.'));
    rerender({ ...base, phase: 'submitting' });
    await waitFor(() => expect(spokenTexts()).toContain('Listo. Procesando.'));
    // Una fase sin indicación (analizando) no agrega nada: el efecto corre pero no hay nada que decir.
    const said = spokenTexts().length;
    rerender({ ...base, phase: 'checking' });
    expect(spokenTexts()).toHaveLength(said);
  });

  it('no dice nada si la empresa no la encendió', async () => {
    const { result } = renderHook(() => useFaceSpeech({ ...base, enabled: false }));
    await waitFor(() => expect(result.current.supported).toBe(true));
    expect(spokenTexts()).toEqual([]);
  });

  it('silencia y lo recuerda en el dispositivo; vuelve a activarlo', async () => {
    const { result } = renderHook(() => useFaceSpeech(base));
    await waitFor(() => expect(spokenTexts()).toHaveLength(1));
    act(() => result.current.toggleMute());
    await waitFor(() => expect(result.current.muted).toBe(true));
    expect(store.get('faceVoiceMuted')).toBe(true);
    expect(cancelCount()).toBeGreaterThan(0); // calla lo que se estuviera diciendo
    act(() => result.current.toggleMute());
    await waitFor(() => expect(result.current.muted).toBe(false));
    expect(store.get('faceVoiceMuted')).toBe(false);
  });

  it('un dispositivo ya silenciado no dice nada al montar', async () => {
    store.set('faceVoiceMuted', true);
    const { result } = renderHook(() => useFaceSpeech(base));
    await waitFor(() => expect(result.current.muted).toBe(true));
    expect(spokenTexts()).toEqual([]);
  });

  it('sin soporte no habla y el control sigue sin fallar', async () => {
    removeSpeechSupport();
    const { result } = renderHook(() => useFaceSpeech(base));
    await waitFor(() => expect(result.current.supported).toBe(false));
    expect(spokenTexts()).toEqual([]);
    expect(() => act(() => result.current.toggleMute())).not.toThrow();
  });

  it('un cambio de idioma en caliente no repite la indicación', async () => {
    const { rerender } = renderHook((props: FaceSpeechInput) => useFaceSpeech(props), { initialProps: base });
    await waitFor(() => expect(spokenTexts()).toHaveLength(1));
    await act(() => setLocale('en-US'));
    rerender(base); // mismas props: el código del paso no cambió con el idioma
    expect(spokenTexts()).toHaveLength(1);
    await act(() => setLocale('es-MX'));
  });
});
