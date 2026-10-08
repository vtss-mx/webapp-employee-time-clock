import { Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import { ApiError } from '../../services/apiClient';
import { enrollmentService } from '../../services/enrollmentService';
import type { EnrollmentVoice, VoiceAnswer, VoiceClip } from '../../types';
import { formatPercent } from '../../utils/format';
import { Button } from '../ui/Button';
import { VideoPlayer } from '../ui/VideoPlayer';

/** Los bytes del clip (base64 del contrato) como URL local `blob:` (nunca una URL del bucket). */
export function clipUrl(data: string, contentType: string): string {
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: contentType }));
}

type ClipState = { url: string } | { expired: true } | { failed: true };

/**
 * La verificación por voz de un registro en la revisión de la empresa (decisión del dueño, 2026-10-06): cada pregunta
 * con cómo pasó (intentos, lo que se oyó, parecidos) y su video, que se pide por la API solo al tocar «Reproducir» y se
 * reproduce con el reproductor propio desde una URL local (se libera al salir). Los textos de las preguntas salen del
 * catálogo `voice_questions`, en el idioma activo.
 */
export function VoiceReviewSection({ enrollmentId, voice }: { enrollmentId: number; voice: EnrollmentVoice }) {
  const t = useT();
  const { byCode } = useCatalogs();
  const { busy, run } = useAction();
  const [clips, setClips] = useState<Record<number, ClipState>>({});
  const urls = useRef<string[]>([]);

  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  /** El video venció (sale del bucket a los 90 días) o no se pudo leer: la fila lo dice; un 404 no abre popup. */
  const fetchClip = async (answer: VoiceAnswer): Promise<VoiceClip | null> => {
    try {
      return await enrollmentService.voiceClip(enrollmentId, answer.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  };

  const load = (answer: VoiceAnswer) =>
    run(() => fetchClip(answer), {
      errorTitle: () => t('enrollments.review.voice.loadError'),
      onSuccess: (clip) => {
        if (clip === null) {
          setClips((prev) => ({ ...prev, [answer.id]: { expired: true } }));
          return;
        }
        const url = clipUrl(clip.data, clip.content_type);
        urls.current.push(url);
        setClips((prev) => ({ ...prev, [answer.id]: { url } }));
      },
    });

  return (
    <div className="voice-review">
      <p className="muted small">{t('enrollments.review.voice.intro')}</p>
      {voice.failed_attempts > 0 && (
        <p className="small voice-review__failed">{t('enrollments.review.voice.failed', { count: voice.failed_attempts })}</p>
      )}
      {voice.answers.length === 0 ? (
        <p className="muted small">{t('enrollments.review.voice.none')}</p>
      ) : (
        <ol className="voice-review__list">
          {voice.answers.map((answer) => {
            const clip = clips[answer.id];
            const question = byCode('voice_questions', answer.question)?.name ?? answer.question;
            return (
              <li key={answer.id} className="voice-review__item">
                <div className="voice-review__head">
                  <strong>{question}</strong>
                  <span className="small muted">
                    {t('enrollments.review.voice.question', { position: answer.position + 1 })} · {t('enrollments.review.voice.attempts', { count: answer.attempts })} ·{' '}
                    {t('enrollments.review.voice.duration', { seconds: Math.round(answer.duration_ms / 1000) })}
                  </span>
                </div>
                {answer.transcript && <p className="voice-review__heard">{t('enrollments.review.voice.heard', { text: answer.transcript })}</p>}
                <p className="small muted">
                  {answer.similarity !== null && t('enrollments.review.voice.similarity', { value: formatPercent(answer.similarity) })}
                  {answer.similarity !== null && answer.face_similarity !== null && ' · '}
                  {answer.face_similarity !== null && t('enrollments.review.voice.face', { value: formatPercent(answer.face_similarity) })}
                </p>
                {clip && 'url' in clip && (
                  <VideoPlayer src={clip.url} label={question} onError={() => setClips((prev) => ({ ...prev, [answer.id]: { failed: true } }))} />
                )}
                {clip && 'failed' in clip && <p className="small muted">{t('enrollments.review.voice.loadError')}</p>}
                {(!answer.has_clip || (clip && 'expired' in clip)) && <p className="small muted">{t('enrollments.review.voice.expired')}</p>}
                {answer.has_clip && !clip && (
                  <Button variant="secondary" size="sm" icon={<Play size={16} />} loading={busy !== null} onClick={() => void load(answer)}>
                    {t('enrollments.review.voice.play')}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
