import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { config } from '../utils/config';

/*
 * Grabación de una respuesta de la verificación por voz (decisión del dueño, 2026-10-06): video con audio, UN clip por
 * pregunta (repetir una pregunta graba solo esa; el servidor valida cada clip por separado). La pista de video es la de la
 * cámara ya abierta (`useCamera().videoTrack()`) y la de audio se pide aquí con el aviso nativo del navegador.
 *
 * `MediaRecorder` graba WebM (VP8/Opus) en Blink y Gecko y MP4 (H.264/AAC) en WebKit: el formato se elige entre los que
 * el navegador declara y el servidor lo reconoce por el contenido. Sin `MediaRecorder` o sin un formato con audio y video
 * (muy pocos navegadores hoy; `docs/rd/compatibilidad-biometria.md` §2) la verificación no puede hacerse aquí y la app
 * lo dice: «usa otro navegador» (nunca se omite la etapa).
 *
 * La grabación termina sola: tras `config.voiceMinSpeechMs` de voz, `config.voiceSilenceStopMs` de silencio la cierran
 * (o el tope `config.voiceMaxAnswerSeconds`, o «Listo»). El nivel del micrófono (RMS 0..1) sale de un `AnalyserNode` y
 * se publica como store externo: solo el medidor se vuelve a dibujar.
 */

export type RecorderStatus = 'idle' | 'requesting' | 'ready' | 'recording' | 'unsupported' | 'denied' | 'error';

/**
 * Formatos con audio y video que puede dar `MediaRecorder`, del preferido al de respaldo: WebM (VP8/Opus, codificador
 * por software fiable en Blink y Gecko) y, donde no existe (WebKit: Safari y todo iOS), MP4 (H.264/AAC). Medido en el
 * arnés (Chromium sin pantalla): pedir primero MP4 arrancaba a veces con `EncodingError`; WebM, nunca.
 */
export const MIME_CANDIDATES = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'];

/** El primer formato que el navegador declara grabar; null sin `MediaRecorder` o sin ninguno. */
export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/** RMS (0..1) de un bloque de muestras del analizador (valores en -1..1). */
export function rmsLevel(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}

/** Nivel 0..1 que se dibuja (el RMS contra la escala que llena el medidor, `config.voiceLevelFullScale`). */
export function meterValue(rms: number): number {
  return Math.min(1, rms / config.voiceLevelFullScale);
}

export interface AnswerRecorder {
  status: RecorderStatus;
  /** El formato elegido (null si el navegador no puede grabar). */
  mimeType: string | null;
  /** Pide el micrófono (aviso nativo) una sola vez; deja el estado en `ready`, `denied`, `unsupported` o `error`. */
  prepare: () => Promise<void>;
  /** Empieza a grabar; se detiene sola (silencio tras la voz o tope) o con `stop`. Resuelve con el clip. */
  start: () => Promise<Blob | null>;
  /** Termina la grabación en curso (la promesa de `start` resuelve con el clip). */
  stop: () => void;
  /** Segundos grabados hasta ahora (0 fuera de una grabación). */
  elapsedSeconds: number;
  /** Nivel del micrófono (0..1) como store externo: `useSyncExternalStore(subscribe, level)`. */
  subscribe: (listener: () => void) => () => void;
  level: () => number;
}

/** Lo que distingue un permiso negado de otra falla al abrir el micrófono. */
export function microphoneStatus(error: unknown): RecorderStatus {
  const name = (error as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError' ? 'denied' : 'error';
}

export function useAnswerRecorder(videoTrack: () => MediaStreamTrack | null): AnswerRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const mimeType = useRef<string | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const listeners = useRef(new Set<() => void>());
  const levelRef = useRef(0);
  const stopRequested = useRef<(() => void) | null>(null);

  const publish = useCallback((rms: number) => {
    const next = meterValue(rms);
    if (Math.abs(next - levelRef.current) < 0.01) return;
    levelRef.current = next;
    listeners.current.forEach((listener) => listener());
  }, []);

  const release = useCallback(() => {
    audioStream.current?.getTracks().forEach((track) => track.stop());
    audioStream.current = null;
    void audioContext.current?.close().catch(() => undefined);
    audioContext.current = null;
  }, []);

  const prepare = useCallback(async () => {
    if (audioStream.current) return; // ya se pidió (los efectos corren dos veces en modo estricto): un solo aviso
    mimeType.current = pickMimeType();
    if (!mimeType.current || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    try {
      audioStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatus('ready');
    } catch (error) {
      setStatus(microphoneStatus(error));
    }
  }, []);

  /** Mide el micrófono mientras graba; decide el final por silencio. Devuelve cómo parar la medición. */
  const meter = useCallback(
    (stream: MediaStream, stop: () => void) => {
      const Context = typeof AudioContext !== 'undefined' ? AudioContext : null;
      if (!Context) return () => undefined;
      const context = new Context();
      audioContext.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const threshold = config.voiceLevelFullScale * 0.12;
      let speechMs = 0;
      let silenceMs = 0;
      let last = performance.now();
      let frame = 0;
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        const delta = now - last;
        last = now;
        analyser.getFloatTimeDomainData(samples);
        const rms = rmsLevel(samples);
        publish(rms);
        if (rms >= threshold) {
          speechMs += delta;
          silenceMs = 0;
        } else if (speechMs >= config.voiceMinSpeechMs) {
          silenceMs += delta;
          if (silenceMs >= config.voiceSilenceStopMs) stop();
        }
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    },
    [publish],
  );

  const stop = useCallback(() => {
    stopRequested.current?.();
  }, []);

  const start = useCallback((): Promise<Blob | null> => {
    const video = videoTrack();
    const audio = audioStream.current?.getAudioTracks() ?? [];
    const type = mimeType.current;
    if (!video || audio.length === 0 || !type) {
      setStatus('error');
      return Promise.resolve(null);
    }
    const stream = new MediaStream([video, ...audio]);
    const chunks: Blob[] = [];
    const media = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: config.voiceVideoBitrateKbps * 1000, audioBitsPerSecond: 32_000 });
    recorder.current = media;
    const startedAt = performance.now();
    setStatus('recording');
    setElapsed(0);
    return new Promise<Blob | null>((resolve) => {
      let finished = false;
      /** La grabadora falló (EncodingError y similares): el `stop` que sigue no la da por lista. */
      let failed = false;
      // El medidor termina la grabación por `stop` (la petición de parar vigente: `finish`, que se registra abajo y
      // solo puede pedirse tras la voz y el silencio que la siguen).
      const stopMeter = meter(stream, stop);
      const timer = window.setInterval(() => setElapsed(Math.round((performance.now() - startedAt) / 1000)), 500);
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearInterval(timer);
        window.clearTimeout(limit);
        stopMeter();
        stopRequested.current = null;
        publish(0);
        // Grabando: `stop` dispara `onstop`, que entrega el clip. Ya detenida (una falla), no hay clip que entregar.
        if (media.state !== 'inactive') media.stop();
        else resolve(null);
      };
      media.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      media.onstop = () => {
        recorder.current = null;
        // Tras una falla, `stop` llega igual: el estado sigue siendo la falla (la pantalla lo explica), no «listo».
        setStatus(failed ? 'error' : 'ready');
        setElapsed(0);
        resolve(chunks.length ? new Blob(chunks, { type }) : null);
      };
      media.onerror = () => {
        failed = true;
        recorder.current = null;
        setStatus('error');
        chunks.length = 0; // lo grabado hasta la falla no sirve
        finish();
      };
      const limit = window.setTimeout(finish, config.voiceMaxAnswerSeconds * 1000);
      stopRequested.current = finish;
      media.start(250);
    });
  }, [meter, publish, stop, videoTrack]);

  useEffect(() => release, [release]);

  const subscribe = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => void listeners.current.delete(listener);
  }, []);
  const level = useCallback(() => levelRef.current, []);

  return { status, mimeType: mimeType.current, prepare, start, stop, elapsedSeconds: elapsed, subscribe, level };
}

/** El nivel del micrófono para dibujar el medidor (solo el componente que lo usa se vuelve a dibujar). */
export function useMicLevel(recorder: Pick<AnswerRecorder, 'subscribe' | 'level'>): number {
  return useSyncExternalStore(recorder.subscribe, recorder.level);
}
