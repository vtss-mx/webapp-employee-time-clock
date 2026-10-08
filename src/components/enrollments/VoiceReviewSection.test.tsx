import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { catalogsWith } from '../../test/catalogs';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { EnrollmentVoice, VoiceAnswer } from '../../types';
import { clipUrl, VoiceReviewSection } from './VoiceReviewSection';

const answer = (over: Partial<VoiceAnswer> = {}): VoiceAnswer => ({
  id: 11,
  position: 0,
  question: 'FULL_NAME',
  attempts: 1,
  transcript: 'ana ruiz',
  similarity: 0.93,
  face_similarity: 0.88,
  duration_ms: 2100,
  created_at: '2026-10-01T10:04:00Z',
  has_clip: true,
  ...over,
});
const voice = (over: Partial<EnrollmentVoice> = {}): EnrollmentVoice => ({ required: true, passed_at: '2026-10-01T10:05:00Z', failed_attempts: 0, answers: [answer()], ...over });
const CLIP = { content_type: 'video/webm', data: btoa('webm'), byte_size: 4, duration_ms: 2100 };

const urls = { create: vi.fn<(blob: Blob) => string>(() => 'blob:clip-1'), revoke: vi.fn() };
beforeEach(() => {
  urls.create.mockClear();
  urls.revoke.mockClear();
  Object.assign(URL, { createObjectURL: urls.create, revokeObjectURL: urls.revoke });
});
afterEach(() => vi.unstubAllGlobals());

describe('VoiceReviewSection: el video de la verificación por voz que revisa la empresa', () => {
  it('cada respuesta con su pregunta del catálogo, intentos, duración, lo que se oyó y los parecidos; el video se pide solo al tocar «Reproducir»', async () => {
    const { calls } = mockFetch(apiOk(CLIP));
    const view = renderWithProviders(
      <VoiceReviewSection
        enrollmentId={5}
        voice={voice({
          failed_attempts: 2,
          answers: [answer(), answer({ id: 12, position: 1, question: 'BIRTH_DATE', attempts: 2, transcript: null, face_similarity: null, similarity: 0.7 }), answer({ id: 13, position: 2, question: 'COMPANY_NAME', transcript: null, similarity: null, face_similarity: null, has_clip: false })],
        })}
      />,
    );
    expect(screen.getByText('2 respuestas no pasaron')).toBeInTheDocument();
    expect(screen.getByText('¿Cuál es tu nombre completo?')).toBeInTheDocument();
    expect(screen.getByText('Pregunta 1 · 1 intento · 2 s')).toBeInTheDocument();
    expect(screen.getByText('Pregunta 2 · 2 intentos · 2 s')).toBeInTheDocument();
    expect(screen.getByText('Se oyó: “ana ruiz”')).toBeInTheDocument();
    expect(screen.getByText('Coincidencia 93% · Rostro 88%')).toBeInTheDocument();
    expect(screen.getByText('Coincidencia 70%')).toBeInTheDocument();
    // Sin clip (venció en el bucket): la fila lo dice y no ofrece reproducir.
    expect(screen.getByText('El video ya no está disponible.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reproducir video' })).toHaveLength(2);
    expect(calls).toHaveLength(0); // nada se descarga sin pedirlo

    await userEvent.click(screen.getAllByRole('button', { name: 'Reproducir video' })[0]);
    const video = await screen.findByLabelText('¿Cuál es tu nombre completo?');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('src', 'blob:clip-1');
    expect(video).not.toHaveAttribute('controls'); // reproductor propio (regla 12)
    expect(calls[0].url).toBe('/api/enrollments/5/voice/11/clip');
    const blob = urls.create.mock.calls[0][0];
    expect(blob.type).toBe('video/webm');
    expect(blob.size).toBe(4);
    expect(screen.getAllByRole('button', { name: 'Reproducir video' })).toHaveLength(1); // el que ya se ve no se vuelve a pedir
    // El navegador no pudo reproducirlo: se dice en la fila.
    fireEvent.error(video);
    expect(screen.getByText('No se pudo cargar el video')).toBeInTheDocument();
    view.unmount();
    expect(urls.revoke).toHaveBeenCalledWith('blob:clip-1'); // la URL local se libera al salir
  });

  it('un video que ya venció (404) lo dice sin popup; otra falla se avisa y se puede volver a intentar', async () => {
    // Un 409 no se reintenta (un 5xx de un GET sí, con esperas: lo prueba apiClient).
    mockFetch(apiFail(404, 'VOICE_CLIP_NOT_FOUND', 'El video ya no existe'), apiFail(409, 'ENROLLMENT_ALREADY_REVIEWED', 'El registro ya fue revisado'), apiOk(CLIP));
    renderWithProviders(<VoiceReviewSection enrollmentId={5} voice={voice({ answers: [answer(), answer({ id: 12, position: 1, question: 'BIRTH_DATE' })] })} />);
    const buttons = () => screen.getAllByRole('button', { name: 'Reproducir video' });
    await userEvent.click(buttons()[0]);
    expect(await screen.findByText('El video ya no está disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.click(buttons()[0]);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar el video' })).toHaveTextContent('El registro ya fue revisado');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await userEvent.click(buttons()[0]);
    expect(await screen.findByLabelText('¿Cuál es tu fecha de nacimiento?')).toBeInTheDocument();
  });

  it('sin respuestas registradas; sin el catálogo (servidor anterior) se muestra el código', () => {
    renderWithProviders(<VoiceReviewSection enrollmentId={5} voice={voice({ answers: [] })} />);
    expect(screen.getByText('Sin respuestas registradas.')).toBeInTheDocument();
    renderWithProviders(<VoiceReviewSection enrollmentId={5} voice={voice()} />, { catalogs: catalogsWith({ voice_questions: [] }) });
    expect(screen.getByText('FULL_NAME')).toBeInTheDocument();
  });

  it('en inglés', async () => {
    await setLocale('en-US');
    renderWithProviders(<VoiceReviewSection enrollmentId={5} voice={voice({ failed_attempts: 1 })} />);
    expect(screen.getByText('1 answer failed')).toBeInTheDocument();
    expect(screen.getByText('Question 1 · 1 try · 2 s')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
  });

  it('clipUrl: los bytes del contrato (base64) como URL local', () => {
    expect(clipUrl(btoa('abc'), 'video/mp4')).toBe('blob:clip-1');
    const blob = urls.create.mock.calls[0][0];
    expect(blob.type).toBe('video/mp4');
    expect(blob.size).toBe(3);
  });
});
