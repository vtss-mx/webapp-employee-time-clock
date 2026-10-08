import { useCallback, useEffect, useRef, useState } from 'react';
import { currentLocale, t } from '../i18n/core';
import type { Phase } from '../components/FaceScan';
import type { FaceChallenge } from '../types';
import { deviceStore } from '../utils/deviceStore';
import { cancelSpeech, speak, speechSupported } from '../utils/speech';
import { useMountedRef } from './useMountedRef';

/** Preferencia de ESTE dispositivo: la guía por voz silenciada (IndexedDB, `deviceStore`). Por omisión, con voz. */
const MUTE_KEY = 'faceVoiceMuted';

/** Lo que se dice al ENTRAR a cada paso del flujo, o `null` si no hay nada que decir en esa fase. */
export interface SpeechCue {
  /**
   * Código ESTABLE de la indicación (no el texto ya traducido): el mismo paso siempre da el mismo `key`, aunque cambie
   * el idioma en caliente. Así el efecto no se vuelve a disparar al traducir y la guía no se repite (regla 16).
   */
  key: string;
  /** El texto a leer, resuelto en el idioma vigente al momento de hablar. */
  text: () => string;
}

/**
 * Qué dice la guía por voz al entrar a cada fase del flujo facial (`liveFaceView`): al colocarse de frente (foto inicial
 * o alineación) se pide la posición una vez; en cada movimiento del reto se lee la instrucción YA LOCALIZADA que mandó
 * el servidor (`challenge.instructions[step]`, derivada igual que en `liveFaceView.ts`); al volver al frente se pide
 * centrar; al enviar, que terminó. En las demás fases (`checking`, `blocked`) no se dice nada. El `key` se arma solo con
 * códigos estables (fase, paso y la instrucción del servidor, que no cambia en memoria con el idioma), nunca con el
 * texto traducido.
 */
export function faceSpeechCue(input: { phase: Phase; step: number; instruction?: string | null }): SpeechCue | null {
  switch (input.phase) {
    case 'frontal':
      return { key: 'position', text: () => t('face.speak.position') };
    case 'challenge':
      return input.instruction ? { key: `move:${input.step}:${input.instruction}`, text: () => input.instruction as string } : null;
    case 'recenter':
      return { key: `recenter:${input.step}`, text: () => t('face.speak.recenter') };
    case 'submitting':
      return { key: 'done', text: () => t('face.speak.done') };
    default:
      return null;
  }
}

/** Lo que el flujo pasa a la guía por voz: si la empresa la encendió, qué voz usar, en qué paso va y el reto vigente. */
export interface FaceSpeechInput {
  /** `policy.voice_guidance_enabled`: la empresa encendió la guía por voz. */
  enabled: boolean;
  /** Código del perfil de voz (`voice_profiles`): fija género, tono y ritmo en `utils/speech.ts`. */
  profile: string;
  phase: Phase;
  step: number;
  /** El reto vigente: de él sale la instrucción del movimiento, ya localizada por el servidor (como en `liveFaceView`). */
  challenge?: FaceChallenge | null;
}

/** Lo que la guía por voz entrega al flujo: si silenciar/activar está disponible, el estado y cómo alternarlo. */
export interface FaceSpeech {
  /** El dispositivo puede leer en voz alta (hay motor de síntesis). */
  supported: boolean;
  /** La guía está silenciada en este dispositivo. */
  muted: boolean;
  /** Alterna silencio y lo recuerda en el dispositivo (IndexedDB). */
  toggleMute: () => void;
}

/**
 * Guía por voz del registro facial (decisión del dueño, 2026-10-08): lee las indicaciones en voz alta con la síntesis
 * del propio dispositivo (`utils/speech.ts`). Montada en `LiveFaceFlow`. Habla solo si la empresa la encendió, no está
 * silenciada y el navegador la soporta; corta la frase anterior para que las indicaciones no se encimen; se calla al
 * desmontarse. El efecto se dispara con el CÓDIGO ESTABLE del paso (`cue.key`), nunca con el texto ya traducido: un
 * cambio de idioma en caliente no repite la indicación (regla 16), y como no cambia estado por cuadro, no provoca
 * redibujos de `LiveFaceFlow` (decisión del dueño sobre el visor «enterprise», AGENTS §2).
 */
export function useFaceSpeech(input: FaceSpeechInput): FaceSpeech {
  const supported = speechSupported();
  const [muted, setMuted] = useState(false);
  // No se habla hasta leer la preferencia del dispositivo: un dispositivo ya silenciado no debe decir nada al montar.
  const [ready, setReady] = useState(false);
  const mounted = useMountedRef();

  // La preferencia de silencio vive en el dispositivo (IndexedDB): se lee al montar y se recuerda al alternarla.
  useEffect(() => {
    void deviceStore.get(MUTE_KEY).then((value) => {
      if (!mounted.current) return;
      if (typeof value === 'boolean') setMuted(value);
      setReady(true);
    });
  }, [mounted]);

  const toggleMute = useCallback(() => {
    setMuted((previous) => {
      const next = !previous;
      void deviceStore.set(MUTE_KEY, next);
      return next;
    });
  }, []);

  const active = ready && input.enabled && !muted && supported;
  // La instrucción del movimiento se deriva igual que el visor (`liveFaceView.ts`): la del paso o, sin ella, la general.
  const instruction = input.challenge?.instructions?.[input.step] ?? input.challenge?.instruction;
  const cue = faceSpeechCue({ phase: input.phase, step: input.step, instruction });
  // El texto y el perfil se leen por referencia al hablar (nunca se guarda el texto traducido en las dependencias).
  const cueRef = useRef(cue);
  cueRef.current = cue;
  const profileRef = useRef(input.profile);
  profileRef.current = input.profile;

  const cueKey = cue?.key ?? null;
  useEffect(() => {
    if (!active) {
      cancelSpeech(); // silenciada, apagada o sin soporte: nada suena
      return;
    }
    const current = cueRef.current;
    if (current) speak(current.text(), { profile: profileRef.current, locale: currentLocale() });
  }, [active, cueKey]);

  // Al salir del flujo no queda una frase sonando.
  useEffect(() => () => cancelSpeech(), []);

  return { supported, muted, toggleMute };
}
