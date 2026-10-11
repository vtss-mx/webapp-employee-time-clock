import { act, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { RecorderStatus } from '../hooks/useAnswerRecorder';
import { setLocale } from '../i18n/core';
import { resolveLazy } from '../i18n/lazy';
import { ApiError } from '../services/apiClient';
import { catalogsWith } from '../test/catalogs';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch } from '../test/http';
import { camera } from '../test/faceFlowMocks';
import { renderWithProviders } from '../test/render';
import type { VoiceChallenge } from '../types';
import { failureText, recorderFailure, VoiceVerificationFlow } from './VoiceVerificationFlow';

/*
 * La verificación por voz con la cámara y la grabadora simuladas: la prueba decide qué entrega la grabadora (el clip, nada,
 * o una promesa que resuelve cuando ella dice) y el servidor responde por fetch como el real. La grabadora real tiene sus
 * propias pruebas (`useAnswerRecorder.test.tsx`).
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
const rec = vi.hoisted(() => {
  const recorder: { status: RecorderStatus; mimeType: string | null; elapsedSeconds: number; prepare: Mock<() => Promise<void>>; start: Mock<() => Promise<Blob | null>>; stop: Mock<() => void>; subscribe: () => () => void; level: () => number } = {
    status: 'ready',
    mimeType: 'video/webm',
    elapsedSeconds: 0,
    prepare: vi.fn<() => Promise<void>>(),
    start: vi.fn<() => Promise<Blob | null>>(),
    stop: vi.fn<() => void>(),
    subscribe: () => () => undefined,
    level: () => 0.5,
  };
  return recorder;
});
vi.mock('../hooks/useAnswerRecorder', () => ({ useAnswerRecorder: () => rec, useMicLevel: (recorder: { level: () => number }) => recorder.level() }));

const challenge: VoiceChallenge = {
  token: 'tok-1',
  questions: [
    { position: 0, question: 'FULL_NAME', text: '¿Cuál es tu nombre completo?' },
    { position: 1, question: 'BIRTH_DATE', text: '¿Cuál es tu fecha de nacimiento?' },
    { position: 2, question: 'COMPANY_NAME', text: '¿Cómo se llama la empresa donde trabajas?' },
  ],
  total: 3,
  answered: 0,
  min_seconds: 0.6,
  max_seconds: 12,
  retries: 3,
  expires_in: 900,
};
const clip = (type = 'video/webm') => new Blob(['video'], { type });
const handlers = { onDone: vi.fn(), onRestart: vi.fn(), onFatal: vi.fn(), onCancel: vi.fn() };
const answered = (position: number, next: number | null) => apiOk({ token: `tok-${position + 2}`, position, done: next === null, next_position: next });
/** Un rechazo del servidor (422 por omisión) con el token renovado y los intentos que quedan en `details`. */
const rejected = (code: string, message: string, details: Record<string, unknown> | null, status = 422) =>
  jsonResponse(envelope(null, { status, code, message, errors: [{ code, message, field: null, details }] }), status);

function renderVoice(catalogs?: Parameters<typeof renderWithProviders>[1], session: VoiceChallenge = challenge) {
  return renderWithProviders(<VoiceVerificationFlow challenge={session} {...handlers} />, catalogs);
}
const question = () => screen.getByRole('heading', { level: 2 });
const message = () => screen.getAllByRole('status')[0];
const answer = () => screen.getByRole('button', { name: 'Responder' });

beforeEach(() => {
  camera.status = 'active';
  rec.status = 'ready';
  rec.elapsedSeconds = 0;
  rec.prepare.mockReset().mockResolvedValue(undefined);
  rec.start.mockReset().mockResolvedValue(clip());
  rec.stop.mockReset();
  Object.values(handlers).forEach((handler) => handler.mockReset());
});
afterEach(() => vi.unstubAllGlobals());

describe('VoiceVerificationFlow: tres preguntas en video, una respuesta a la vez', () => {
  it('pide el micrófono una vez, muestra el texto que manda el servidor y avanza con cada respuesta aceptada hasta terminar', async () => {
    const { calls } = mockFetch(answered(0, 1), answered(1, 2), answered(2, null));
    renderVoice();
    expect(rec.prepare).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { level: 1, name: 'Verificación por voz' })).toBeInTheDocument();
    expect(screen.getByText('Pregunta 1 de 3')).toBeInTheDocument();
    expect(question()).toHaveTextContent('¿Cuál es tu nombre completo?');
    expect(message()).toHaveTextContent('¿Cuál es tu nombre completo?');
    expect(screen.getByText('Responde ahora')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Nivel del micrófono' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('Responde en voz alta a cada pregunta mirando a la cámara. Se graba video y audio.')).toBeInTheDocument();

    await userEvent.click(answer());
    expect(await screen.findByText('Pregunta 2 de 3')).toBeInTheDocument();
    expect(question()).toHaveTextContent('¿Cuál es tu fecha de nacimiento?');
    const form = calls[0].init.body as FormData;
    expect(calls[0].url).toBe('/api/enrollment/voice/answer');
    expect(form.get('token')).toBe('tok-1');
    expect(form.get('position')).toBe('0');
    expect((form.get('clip') as File).name).toBe('answer.webm');

    await userEvent.click(answer());
    expect(await screen.findByText('Pregunta 3 de 3')).toBeInTheDocument();
    expect((calls[1].init.body as FormData).get('token')).toBe('tok-2'); // el token renovado de la respuesta anterior
    expect(question()).toHaveTextContent('¿Cómo se llama la empresa donde trabajas?');

    await userEvent.click(answer());
    await vi.waitFor(() => expect(handlers.onDone).toHaveBeenCalledOnce());
    expect((calls[2].init.body as FormData).get('position')).toBe('2');
    expect(handlers.onRestart).not.toHaveBeenCalled();
  });

  it('una sesión retomada otro día trae solo las preguntas que faltan: la cuenta sigue («Pregunta 2 de 3») y responde su posición', async () => {
    const { calls } = mockFetch(answered(1, 2), answered(2, null));
    renderVoice(undefined, { ...challenge, token: 'tok-r', questions: challenge.questions.slice(1), answered: 1 });
    expect(screen.getByText('Pregunta 2 de 3')).toBeInTheDocument();
    expect(question()).toHaveTextContent('¿Cuál es tu fecha de nacimiento?');
    await userEvent.click(answer());
    expect(await screen.findByText('Pregunta 3 de 3')).toBeInTheDocument();
    expect((calls[0].init.body as FormData).get('position')).toBe('1');
    await userEvent.click(answer());
    await vi.waitFor(() => expect(handlers.onDone).toHaveBeenCalledOnce());
    expect((calls[1].init.body as FormData).get('position')).toBe('2');
  });

  it('mientras graba: indicador fijo, segundos, el anillo con el tope de duración y «Listo» para terminar; un clip vacío pide repetir', async () => {
    let finish: (clip: Blob | null) => void = () => undefined;
    rec.start.mockReturnValue(new Promise<Blob | null>((resolve) => (finish = resolve)));
    rec.elapsedSeconds = 3;
    mockFetch(answered(0, 1));
    renderVoice();
    await userEvent.click(answer());
    expect(rec.start).toHaveBeenCalledOnce();
    expect(document.querySelector('.voice-rec')).toHaveTextContent('Grabando');
    expect(screen.getByText('Grabando · 3 s')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Captura al 25 %' })).toBeInTheDocument(); // 3 s de 12
    expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(rec.stop).toHaveBeenCalledOnce();
    await act(async () => {
      finish(null);
      await Promise.resolve();
    });
    expect(question()).toHaveTextContent('Repite la respuesta');
    expect(message()).toHaveTextContent('La grabación fue muy corta. Di tu respuesta completa.');
    expect(answer()).toBeEnabled();
    expect(screen.queryByText(/intentos? disponibles?/)).toBeNull();
  });

  it('una respuesta rechazada (422) repite la MISMA pregunta con el motivo del servidor, los intentos que quedan y el token renovado', async () => {
    const { calls } = mockFetch(rejected('ANSWER_MISMATCH', 'La respuesta no coincide con tus datos.', { token: 'tok-r', attempts_left: 2 }), rejected('ANSWER_INAUDIBLE', 'No se oyó tu respuesta.', null), answered(0, 1));
    renderVoice();
    await userEvent.click(answer());
    expect(await screen.findByText('Repite la respuesta')).toBeInTheDocument();
    expect(message()).toHaveTextContent('La respuesta no coincide con tus datos.');
    expect(screen.getByText('2 intentos disponibles')).toBeInTheDocument();
    expect(screen.getByText('Pregunta 1 de 3')).toBeInTheDocument();
    await userEvent.click(answer());
    await vi.waitFor(() => expect(message()).toHaveTextContent('No se oyó tu respuesta.'));
    expect((calls[1].init.body as FormData).get('token')).toBe('tok-r'); // el renovado del rechazo
    expect(screen.queryByText(/intentos? disponibles?/)).toBeNull(); // sin el dato, no se inventa
    await userEvent.click(answer());
    expect(await screen.findByText('Pregunta 2 de 3')).toBeInTheDocument();
    expect((calls[2].init.body as FormData).get('token')).toBe('tok-r'); // sin token nuevo en el segundo rechazo, sigue el último
    expect(handlers.onRestart).not.toHaveBeenCalled();
  });

  it('intentos agotados o sesión vencida: el registro vuelve a empezar (onRestart con el error del servidor)', async () => {
    mockFetch(apiFail(422, 'VOICE_RETRIES_EXHAUSTED', 'Se agotaron los intentos'));
    renderVoice();
    await userEvent.click(answer());
    await vi.waitFor(() => expect(handlers.onRestart).toHaveBeenCalledOnce());
    expect(handlers.onRestart.mock.calls[0][0]).toMatchObject({ code: 'VOICE_RETRIES_EXHAUSTED' });
    expect(handlers.onFatal).not.toHaveBeenCalled();
  });

  it.each([
    [503, 'SPEECH_SERVICE_UNAVAILABLE', 'El servicio de voz no está disponible. Intenta de nuevo.'],
    [429, 'RATE_LIMITED', 'Demasiadas respuestas seguidas. Espera un momento.'],
  ])('una falla pasajera (%i) repite la pregunta con el aviso del servidor, sin tirar el registro', async (status, code, text) => {
    mockFetch(apiFail(status, code, text));
    renderVoice();
    await userEvent.click(answer());
    expect(await screen.findByText('Repite la respuesta')).toBeInTheDocument();
    expect(message()).toHaveTextContent(text);
    expect(handlers.onFatal).not.toHaveBeenCalled();
    expect(handlers.onRestart).not.toHaveBeenCalled();
  });

  it('cualquier otro error (permisos, 404 de otra ruta) no se puede corregir aquí: onFatal', async () => {
    mockFetch(apiFail(403, 'FORBIDDEN', 'Sin permiso'));
    renderVoice();
    await userEvent.click(answer());
    await vi.waitFor(() => expect(handlers.onFatal).toHaveBeenCalledOnce());
    expect(handlers.onFatal.mock.calls[0][0]).toBeInstanceOf(ApiError);
  });

  it('un clip demasiado grande (413 VIDEO_TOO_LARGE) repite la MISMA pregunta con el aviso del servidor, sin abortar', async () => {
    mockFetch(apiFail(413, 'VIDEO_TOO_LARGE', 'El video es demasiado grande. Grábalo más corto.'), answered(0, 1));
    renderVoice();
    await userEvent.click(answer());
    expect(await screen.findByText('Repite la respuesta')).toBeInTheDocument();
    expect(message()).toHaveTextContent('El video es demasiado grande. Grábalo más corto.');
    expect(screen.getByText('Pregunta 1 de 3')).toBeInTheDocument(); // la misma pregunta
    expect(handlers.onFatal).not.toHaveBeenCalled();
    await userEvent.click(answer());
    expect(await screen.findByText('Pregunta 2 de 3')).toBeInTheDocument();
  });

  it('una respuesta ya aceptada (409 ANSWER_ALREADY_ACCEPTED) en una pregunta intermedia avanza a la siguiente', async () => {
    mockFetch(apiFail(409, 'ANSWER_ALREADY_ACCEPTED', 'Esa respuesta ya se registró'));
    renderVoice();
    await userEvent.click(answer());
    expect(await screen.findByText('Pregunta 2 de 3')).toBeInTheDocument();
    expect(question()).toHaveTextContent('¿Cuál es tu fecha de nacimiento?');
    expect(handlers.onFatal).not.toHaveBeenCalled();
    expect(handlers.onRestart).not.toHaveBeenCalled();
    expect(handlers.onDone).not.toHaveBeenCalled();
  });

  it('una respuesta ya aceptada (409) que trae el token renovado: la siguiente pregunta se envía con ese token', async () => {
    const { calls } = mockFetch(rejected('ANSWER_ALREADY_ACCEPTED', 'Esa respuesta ya se registró', { token: 'tok-renovado' }, 409), answered(1, 2));
    renderVoice();
    await userEvent.click(answer());
    expect(await screen.findByText('Pregunta 2 de 3')).toBeInTheDocument();
    await userEvent.click(answer());
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect((calls[1].init.body as FormData).get('token')).toBe('tok-renovado'); // no el de la sesión original (tok-1)
    expect((calls[1].init.body as FormData).get('position')).toBe('1');
  });

  it('una respuesta ya aceptada (409) en la última pregunta pendiente da el registro por terminado', async () => {
    mockFetch(apiFail(409, 'ANSWER_ALREADY_ACCEPTED', 'Esa respuesta ya se registró'));
    renderVoice(undefined, { ...challenge, questions: challenge.questions.slice(2), answered: 2 });
    await userEvent.click(answer());
    await vi.waitFor(() => expect(handlers.onDone).toHaveBeenCalledOnce());
    expect(handlers.onFatal).not.toHaveBeenCalled();
  });

  it.each(['denied', 'unsupported', 'error'] as const)('la grabadora en «%s» no deja hacer la verificación aquí: onFatal con su explicación', (status) => {
    rec.status = status;
    renderVoice();
    expect(handlers.onFatal).toHaveBeenCalledOnce();
    const error = handlers.onFatal.mock.calls[0][0] as Error;
    expect(error.message).toBe(status === 'denied' ? 'MICROPHONE_DENIED' : status === 'unsupported' ? 'RECORDER_UNSUPPORTED' : 'RECORDER_ERROR');
    expect(resolveLazy(failureText(error))).toBe(status === 'denied' ? 'El permiso del micrófono está bloqueado. Permítelo en tu navegador para continuar.' : 'Tu navegador no puede grabar video con audio. Abre la aplicación en Chrome, Safari, Edge o Firefox actualizados.');
    expect(answer()).toBeDisabled();
  });

  it('en modo estricto (desarrollo) el micrófono se pide UNA vez; una falla sin texto propio muestra el mensaje del error', () => {
    renderWithProviders(
      <StrictMode>
        <VoiceVerificationFlow challenge={challenge} {...handlers} />
      </StrictMode>,
    );
    expect(rec.prepare).toHaveBeenCalled(); // la grabadora pide el micrófono una sola vez aunque se le llame dos
    expect(resolveLazy(failureText(new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'Sin permiso' })))).toBe('Sin permiso');
  });

  it('mientras la cámara de la tarjeta aún no da imagen, «Responder» espera (la grabación toma su pista de video)', () => {
    camera.status = 'requesting';
    renderVoice();
    expect(answer()).toBeDisabled();
  });

  it('mientras el micrófono se pide, «Responder» espera; cancelar avisa a la pantalla', async () => {
    rec.status = 'requesting';
    renderVoice();
    expect(answer()).toBeDisabled();
    expect(recorderFailure('requesting')).toBeNull();
    expect(recorderFailure('ready')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(handlers.onCancel).toHaveBeenCalledOnce();
  });

  it('muestra el texto YA RENDERIZADO del servidor para la suma (con sus números), sin tocar el catálogo', () => {
    mockFetch();
    renderVoice(undefined, {
      ...challenge,
      questions: [{ position: 0, question: 'ARITHMETIC_SUM', text: '¿Cuánto es 7 más 4?' }],
      total: 1,
    });
    // La app solo muestra el texto del servidor: ni arma la suma ni la busca en el catálogo (el código no es un registro
    // del catálogo de preguntas).
    expect(question()).toHaveTextContent('¿Cuánto es 7 más 4?');
  });

  it('sin texto ni catálogo (servidor muy anterior) se muestra el código; el clip MP4 viaja con su nombre', async () => {
    rec.start.mockResolvedValue(clip('video/mp4'));
    const { calls } = mockFetch(answered(0, 1));
    renderVoice({ catalogs: catalogsWith({ voice_questions: [] }) }, {
      ...challenge,
      questions: challenge.questions.map((q) => ({ ...q, text: '' })),
    });
    expect(question()).toHaveTextContent('FULL_NAME');
    await userEvent.click(answer());
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0].init.body as FormData).get('clip')).toHaveProperty('name', 'answer.mp4');
  });

  it('si la pantalla se cierra a media respuesta nada se envía ni se avisa (antes del clip, con la respuesta en camino o con su rechazo)', async () => {
    // Antes del clip.
    let finish: (clip: Blob | null) => void = () => undefined;
    rec.start.mockReturnValue(new Promise<Blob | null>((resolve) => (finish = resolve)));
    const first = mockFetch(answered(0, 1));
    const view = renderVoice();
    await userEvent.click(answer());
    view.unmount();
    await act(async () => {
      finish(clip());
      await Promise.resolve();
    });
    expect(first.calls).toHaveLength(0);

    // Con la respuesta en camino (aceptada) y con su rechazo.
    for (const response of [answered(0, 1), apiFail(422, 'VOICE_SESSION_EXPIRED', 'Venció')]) {
      let reply: (response: Response) => void = () => undefined;
      rec.start.mockResolvedValue(clip());
      mockFetch(() => new Promise<Response>((resolve) => (reply = resolve)));
      const pending = renderVoice();
      await userEvent.click(answer());
      pending.unmount();
      await act(async () => {
        reply(response);
        await new Promise((done) => setTimeout(done, 0));
      });
    }
    expect(handlers.onDone).not.toHaveBeenCalled();
    expect(handlers.onRestart).not.toHaveBeenCalled();
    expect(handlers.onFatal).not.toHaveBeenCalled();
  });

  it('en inglés', async () => {
    await setLocale('en-US');
    rec.elapsedSeconds = 6;
    rec.start.mockReturnValue(new Promise<Blob | null>(() => undefined));
    renderVoice();
    expect(screen.getByRole('heading', { level: 1, name: 'Voice check' })).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Answer now')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Recording · 6 s')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Done' })).getByText('Done')).toBeInTheDocument();
  });
});
