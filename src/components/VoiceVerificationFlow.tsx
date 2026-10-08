import { Mic, Square } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAnswerRecorder, useMicLevel, type AnswerRecorder } from '../hooks/useAnswerRecorder';
import { useCamera } from '../hooks/useCamera';
import { useCatalogs } from '../hooks/useCatalogs';
import { useMountedRef } from '../hooks/useMountedRef';
import { t, useLocale, useT } from '../i18n';
import { resolveLazy, type LazyText } from '../i18n/lazy';
import { localizeServerText } from '../i18n/serverTexts';
import { ApiError, errorMessage } from '../services/apiClient';
import { enrollmentService } from '../services/enrollmentService';
import type { VoiceChallenge } from '../types';
import { config } from '../utils/config';
import { CameraCapture } from './CameraCapture';
import { FaceGuide } from './FaceGuide';
import { ScanHeader } from './FaceScan';
import { Button } from './ui/Button';

/*
 * Verificación por voz y video del registro facial (decisión del dueño del producto, 2026-10-06), después de las 32 fotos
 * válidas y los movimientos: tres preguntas al azar sobre los propios datos del empleado y una suma como prueba cognitiva
 * (las elige el servidor, que además manda el TEXTO de cada una YA RENDERIZADO en el idioma de la petición —la suma, con
 * sus números: «¿Cuánto es 7 más 4?»—; aquí solo se muestra). Por cada pregunta se graba UN clip
 * de video con audio (`useAnswerRecorder`) y el servidor lo valida: si no pasa, la MISMA pregunta se repite con el motivo
 * del servidor y los intentos que quedan; si se agotan o la sesión vence, la pantalla decide (`onRestart`: otra sesión, o
 * volver a los pasos anteriores). Al pasar la última, `onDone`. Desde el 2026-10-07 (pasos independientes) la sesión puede
 * retomarse otro día: trae solo las preguntas que FALTAN y la cuenta sigue («Pregunta 2 de 3»: `answered` + la actual de
 * `total`). Visual sobrio: la cámara en su círculo, la pregunta grande, «Responde ahora», el medidor del
 * micrófono y un indicador de grabación fijo; sin animaciones.
 */

/** Códigos del servidor con los que la sesión ya no sirve: el registro vuelve a empezar desde las fotos. */
const RESTART_CODES: ReadonlySet<string> = new Set(['VOICE_RETRIES_EXHAUSTED', 'VOICE_SESSION_EXPIRED', 'VOICE_SESSION_INVALID', 'VOICE_NOT_PENDING', 'ENROLLMENT_NOT_FOUND']);

/** Fallas pasajeras (además de cualquier 5xx): sin red, tiempo agotado del cliente o servicio saturado; se repite la pregunta. */
const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([0, 408, 429]);

type Status = 'preparing' | 'ready' | 'recording' | 'sending' | 'rejected';

interface VoiceVerificationFlowProps {
  challenge: VoiceChallenge;
  /** La última respuesta pasó: el registro quedó en validación. */
  onDone: () => void;
  /** La sesión ya no sirve (venció, intentos agotados, el registro se reemplazó): la pantalla decide cómo seguir. */
  onRestart: (error: unknown) => void;
  /** Micrófono negado, navegador sin grabación, cámara caída o una falla no corregible. */
  onFatal: (error: unknown) => void;
  onCancel: () => void;
  /** El indicador de los pasos del registro, dentro de la tarjeta (bajo el título). */
  steps?: ReactNode;
}

/** Lo que le pasa al estado de una grabación que no pudo abrirse. */
export function recorderFailure(status: AnswerRecorder['status']): Error | null {
  if (status === 'unsupported') return Object.assign(new Error('RECORDER_UNSUPPORTED'), { lazyText: () => t('voice.unsupported') });
  if (status === 'denied') return Object.assign(new Error('MICROPHONE_DENIED'), { lazyText: () => t('voice.micDenied') });
  if (status === 'error') return Object.assign(new Error('RECORDER_ERROR'), { lazyText: () => t('voice.unsupported') });
  return null;
}

/** El mensaje que ve la persona de una falla de la grabación (el texto se escribe al dibujarse). */
export function failureText(error: unknown): LazyText {
  const lazy = (error as { lazyText?: LazyText } | null)?.lazyText;
  return lazy ?? (() => errorMessage(error));
}

/** Medidor del micrófono: una barra que se llena con el nivel (solo este componente se vuelve a dibujar). */
function MicLevel({ recorder }: { recorder: Pick<AnswerRecorder, 'subscribe' | 'level'> }) {
  const t = useT();
  const level = useMicLevel(recorder);
  return (
    <div className="mic-level" role="meter" aria-label={t('voice.micLevel')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
      <span className="mic-level__fill" style={{ transform: `scaleX(${level})` }} />
    </div>
  );
}

export function VoiceVerificationFlow({ challenge, onDone, onRestart, onFatal, onCancel, steps }: VoiceVerificationFlowProps) {
  useLocale();
  const camera = useCamera({ facing: 'user' });
  const { byCode } = useCatalogs();
  const recorder = useAnswerRecorder(camera.videoTrack);
  const [status, setStatus] = useState<Status>('preparing');
  /** La pregunta en curso entre las que faltan (en su orden: se responden una tras otra). */
  const [index, setIndex] = useState(0);
  const [token, setToken] = useState(challenge.token);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  /** Por qué no pasó la última respuesta (se escribe al dibujarse: sigue al idioma). */
  const [rejection, setRejection] = useState<LazyText | null>(null);
  const mounted = useMountedRef();

  // El micrófono se pide al entrar (aviso nativo del navegador; `prepare` lo pide una sola vez aunque el efecto corra dos
  // veces en modo estricto); sin él, la verificación no puede hacerse aquí.
  useEffect(() => {
    void recorder.prepare();
  }, [recorder]);
  useEffect(() => {
    const failure = recorderFailure(recorder.status);
    if (failure) onFatal(failure);
    else if (recorder.status === 'ready' && status === 'preparing') setStatus('ready');
  }, [recorder.status, status, onFatal]);

  const question = challenge.questions[index];
  const current = challenge.answered + index + 1;

  const send = useCallback(
    async (clip: Blob | null) => {
      if (!mounted.current) return;
      if (!clip) {
        setRejection(() => t('voice.tooShort'));
        setStatus('rejected');
        return;
      }
      setStatus('sending');
      try {
        const result = await enrollmentService.answerVoice(token, question.position, clip);
        if (!mounted.current) return;
        setToken(result.token);
        setRejection(null);
        setAttemptsLeft(null);
        if (result.done || result.next_position === null) {
          onDone();
          return;
        }
        setIndex((i) => i + 1);
        setStatus('ready');
      } catch (error) {
        if (!mounted.current) return;
        if (error instanceof ApiError && RESTART_CODES.has(error.code)) {
          onRestart(error);
          return;
        }
        if (error instanceof ApiError && error.status === 422) {
          const details = (error.details ?? {}) as { token?: string; attempts_left?: number };
          if (details.token) setToken(details.token);
          setAttemptsLeft(typeof details.attempts_left === 'number' ? details.attempts_left : null);
          setRejection(() => localizeServerText(errorMessage(error)));
          setStatus('rejected');
          return;
        }
        if (error instanceof ApiError && (error.status >= 500 || TRANSIENT_STATUSES.has(error.status))) {
          // Pasajero (servicio ocupado, red): se repite la misma pregunta con el aviso del servidor.
          setRejection(() => localizeServerText(errorMessage(error)));
          setStatus('rejected');
          return;
        }
        onFatal(error);
      }
    },
    [mounted, onDone, onFatal, onRestart, question, token],
  );

  const record = useCallback(async () => {
    setStatus('recording');
    const clip = await recorder.start();
    await send(clip);
  }, [recorder, send]);

  // El servidor manda el texto YA RENDERIZADO en el idioma de la petición (la suma, con sus números): la app solo lo
  // muestra. Se conserva el respaldo del catálogo por su código para una respuesta muy vieja sin `text`.
  const questionText = () => question.text || (byCode('voice_questions', question.question)?.name ?? question.question);
  const message: LazyText = () => (status === 'rejected' && rejection ? resolveLazy(rejection) : questionText());
  const detail = status === 'recording' ? `${t('voice.recording')} · ${t('voice.seconds', { seconds: recorder.elapsedSeconds })}` : status === 'sending' ? t('voice.sending') : status === 'ready' || status === 'rejected' ? t('voice.answerNow') : null;
  const tone = status === 'rejected' ? 'warn' : status === 'recording' ? 'busy' : 'idle';
  const ring = status === 'recording' ? Math.min(1, recorder.elapsedSeconds / config.voiceMaxAnswerSeconds) : 0;
  // Se responde con el micrófono listo Y la cámara ya dando imagen: la grabación toma la pista de video de la cámara y, sin
  // ella, fallaría (al abrir esta tarjeta la cámara se vuelve a encender).
  const canAnswer = (status === 'ready' || status === 'rejected') && camera.status === 'active';

  return (
    <section className="faceid faceid--voice" aria-labelledby="voice-title">
      <ScanHeader titleId="voice-title" title={t('voice.title')} steps={steps} onCancel={onCancel} />
      <div className="faceid__intro">
        <p className="faceid__eyebrow">{t('voice.stage', { current, total: challenge.total })}</p>
        <h2>{status === 'rejected' ? t('voice.retry') : questionText()}</h2>
        <p>{t('voice.intro')}</p>
      </div>
      <div className="faceid__viewport">
        <CameraCapture camera={camera} className="camera--fill">
          <span className="faceid__label">{camera.activeLabel}</span>
          <FaceGuide tone={tone} message={message} detail={detail} progress={ring} stage="voice" />
          {status === 'recording' && (
            <span className="voice-rec" role="status">
              <span className="voice-rec__dot" aria-hidden /> {t('voice.recording')}
            </span>
          )}
        </CameraCapture>
      </div>
      <div className="faceid__actions">
        <MicLevel recorder={recorder} />
        {status === 'recording' ? (
          <Button variant="primary" size="lg" icon={<Square size={18} />} onClick={recorder.stop}>
            {t('voice.stop')}
          </Button>
        ) : (
          <Button variant="primary" size="lg" icon={<Mic size={18} />} disabled={!canAnswer} loading={status === 'sending'} onClick={() => void record()}>
            {t('voice.start')}
          </Button>
        )}
        {attemptsLeft !== null && status === 'rejected' && <p className="small muted">{t('voice.attemptsLeft', { count: attemptsLeft })}</p>}
      </div>
    </section>
  );
}
