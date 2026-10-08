import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapturedFace, EnrollmentFlowStep } from '../../components/LiveFaceFlow';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { setLocale } from '../../i18n/core';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { CAPTURES_DONE, NOTHING_DONE, PHOTO_DONE } from '../../test/enrollment';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders, sampleUser } from '../../test/render';
import type { EnrollmentProgress, User, VoiceChallenge } from '../../types';
import { EnrollmentCapturePage, EnrollmentPhotoPage, EnrollmentVoicePage, refreshWithRetry } from './EnrollmentStepPages';

/*
 * Las pantallas de los tres pasos independientes del registro facial (decisión del dueño del producto, 2026-10-07). La
 * cámara y la grabación se prueban en `LiveFaceFlow.*.test.tsx` y `VoiceVerificationFlow.test.tsx`; aquí, qué hace cada
 * pantalla con el estado del servidor, la confirmación y cada salida del flujo.
 */
const session = vi.hoisted(() => ({ user: null as User | null, refreshUser: vi.fn<() => Promise<void>>(), flowErrors: [] as unknown[], waits: [] as number[] }));
vi.mock('../../utils/waits', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sleep: (ms: number) => {
    session.waits.push(ms);
    return Promise.resolve();
  },
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => session }));

interface FlowProps {
  enrollmentStep?: EnrollmentFlowStep;
  submittingMessage: string;
  onSubmit: (captured: CapturedFace) => Promise<void>;
  onFatal: (error: unknown) => void;
  onCancel: () => void;
  steps?: ReactNode;
}
vi.mock('../../components/LiveFaceFlow', () => ({
  LiveFaceFlow: ({ enrollmentStep, submittingMessage, onSubmit, onFatal, onCancel, steps }: FlowProps) => (
    <div data-testid="flow" data-step={enrollmentStep} data-submitting={submittingMessage}>
      {steps}
      <button onClick={() => void onSubmit({ frontal: [new Blob(['x'])] }).catch((error: unknown) => session.flowErrors.push(error))}>enviar</button>
      <button onClick={() => onFatal(new Error('La cámara dejó de responder'))}>falla de cámara</button>
      <button onClick={onCancel}>salir</button>
    </div>
  ),
}));

interface VoiceProps {
  challenge: VoiceChallenge;
  onDone: () => void;
  onRestart: (error: unknown) => void;
  onFatal: (error: unknown) => void;
  onCancel: () => void;
  steps?: ReactNode;
}
vi.mock('../../components/VoiceVerificationFlow', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  VoiceVerificationFlow: ({ challenge, onDone, onRestart, onFatal, onCancel, steps }: VoiceProps) => (
    <div data-testid="voice" data-token={challenge.token}>
      {steps}
      <button onClick={onDone}>respuestas aceptadas</button>
      <button onClick={() => onRestart(new ApiError({ statusCode: 422, code: 'VOICE_SESSION_EXPIRED', message: 'La verificación por voz venció.' }))}>sesión vencida</button>
      <button onClick={() => onRestart(new ApiError({ statusCode: 422, code: 'VOICE_RETRIES_EXHAUSTED', message: 'Se agotaron los intentos.' }))}>intentos agotados</button>
      <button onClick={() => onRestart(new Error('Algo inesperado'))}>reinicio sin código</button>
      <button onClick={() => onFatal(Object.assign(new Error('MICROPHONE_DENIED'), { lazyText: () => 'El micrófono está bloqueado' }))}>micrófono negado</button>
      <button onClick={onCancel}>salir del video</button>
    </div>
  ),
}));

const voice = (token: string): VoiceChallenge => ({
  token,
  questions: [{ position: 2, question: 'COMPANY_NAME', text: '¿Cómo se llama la empresa donde trabajas?' }],
  total: 3,
  answered: 2,
  min_seconds: 0.6,
  max_seconds: 12,
  retries: 3,
  expires_in: 900,
});

type Responder = (call: MockCall) => Response;
interface Server {
  progress?: EnrollmentProgress;
  photo?: Responder;
  submit?: Responder;
  start?: Responder;
}

function renderStep(path: string, Page: () => ReactNode, server: Server = {}, confirmed = true, strict = false) {
  const { progress = NOTHING_DONE, photo = () => apiOk({ ok: true, message: 'ok', detection_score: 0.9, quality_score: 0.9, yaw_ratio: 0, accessories: [], checked_at: 'a', expires_at: 'b' }), submit, start } = server;
  const { calls } = mockFetch((call) => {
    if (call.url.includes('/enrollment/progress')) return apiOk(progress);
    if (call.url.includes('/enrollment/photo')) return photo(call);
    if (call.url.includes('/enrollment/face') && submit) return submit(call);
    if (call.url.includes('/enrollment/voice/start') && start) return start(call);
    return apiOk(samplePolicy);
  });
  renderWithProviders(
    <Routes>
      <Route path={paths.employee.enroll} element={<p>Índice del registro</p>} />
      <Route path={paths.employee.pending} element={<p>Registro en validación</p>} />
      <Route path={path} element={strict ? <StrictMode><Page /></StrictMode> : <Page />} />
    </Routes>,
    { route: confirmed ? { pathname: path, state: { confirmed: true } } : path },
  );
  return (part: string) => calls.filter((call) => call.url.includes(part));
}

beforeEach(() => {
  session.user = { ...sampleUser, employee: sampleUser.employee && { ...sampleUser.employee, face_status: 'NOT_ENROLLED' } };
  session.refreshUser.mockReset().mockResolvedValue(undefined);
  session.flowErrors = [];
  session.waits = [];
});
afterEach(() => resetPolicyCache());

describe('Paso 1: la foto inicial', () => {
  it('confirmada en el índice, abre la cámara directo; al guardarla regresa al índice (sin avisos)', async () => {
    const sent = renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage);
    const flow = await screen.findByTestId('flow');
    expect(flow).toHaveAttribute('data-step', 'photo');
    expect(flow).toHaveAttribute('data-submitting', 'Guardando tu foto…');
    expect(within(flow).getByRole('list', { name: 'Paso 1 de 4' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
    expect(sent('/enrollment/photo')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('un rechazo del servidor vuelve al flujo facial (que lo explica y reintenta solo)', async () => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, { photo: () => apiFail(422, 'TOO_DARK', 'Hay poca luz') });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    await vi.waitFor(() => expect(session.flowErrors).toHaveLength(1));
    expect(session.flowErrors[0]).toMatchObject({ code: 'TOO_DARK' });
    expect(screen.getByTestId('flow')).toBeInTheDocument();
  });

  it('abierta a mano: pide la confirmación con «Abrir cámara» (cancelar se queda; «Volver al registro» regresa)', async () => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, { progress: PHOTO_DONE }, false);
    expect(await screen.findByRole('heading', { name: 'Foto inicial' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir cámara' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Tomar tu foto inicial?' });
    expect(dialog).toHaveTextContent('Tu foto inicial anterior se reemplazará por esta.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('flow')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir cámara' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abrir cámara' }));
    expect(await screen.findByTestId('flow')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'salir' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
  });

  it('«Volver al registro» desde la confirmación pendiente', async () => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, {}, false);
    await userEvent.click(await screen.findByRole('button', { name: 'Volver al registro' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
  });

  it('ya usada en las capturas: lo dice con su vacío (no se repite) y regresa al índice', async () => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, { progress: CAPTURES_DONE });
    expect(await screen.findByText('Foto inicial lista')).toBeInTheDocument();
    expect(screen.getByText('Ya se usó en tus capturas. Continúa con el siguiente paso.')).toBeInTheDocument();
    expect(screen.queryByTestId('flow')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Volver al registro' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
  });

  it('una falla no corregible se explica en un popup y regresa al índice', async () => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage);
    await userEvent.click(await screen.findByRole('button', { name: 'falla de cámara' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo completar el registro' })).toHaveTextContent('La cámara dejó de responder');
    expect(screen.getByText('Índice del registro')).toBeInTheDocument();
  });
});

describe('Paso 2: las capturas con la prueba de vida', () => {
  it('sin foto inicial o ya enviadas: lo dicen con su vacío', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage);
    expect(await screen.findByText('Falta tu foto inicial')).toBeInTheDocument();
    expect(screen.getByText('Toma tu foto inicial antes de las capturas.')).toBeInTheDocument();
  });

  it('ya enviadas: «Capturas listas»', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { progress: CAPTURES_DONE });
    expect(await screen.findByText('Capturas listas')).toBeInTheDocument();
  });

  it('aceptadas con el video pendiente: regresan al índice (el video ya aparece disponible)', async () => {
    const sent = renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { progress: PHOTO_DONE, submit: () => apiOk({ enrollment_id: 3, face_status: 'NOT_ENROLLED' }) });
    const flow = await screen.findByTestId('flow');
    expect(flow).toHaveAttribute('data-step', 'captures');
    expect(within(flow).getByRole('list', { name: 'Paso 2 de 4' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
    expect(sent('/enrollment/face')).toHaveLength(1);
    expect(session.refreshUser).not.toHaveBeenCalled();
  });

  it('sin video en la política, el registro queda en validación: popup y la pantalla «En validación»', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, {
      progress: { ...PHOTO_DONE, voice: { status: 'not_required', answered: 0, total: 0, attempts_left: null } },
      submit: () => apiOk({ enrollment_id: 3, face_status: 'PENDING_REVIEW' }),
    });
    expect(within(await screen.findByTestId('flow')).getByRole('list', { name: 'Paso 2 de 3' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }));
    expect(await screen.findByText('Registro en validación')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Registro enviado' })).toHaveTextContent('Tu empresa validará tu identidad en breve.');
  });

  it('409 ENROLLMENT_PENDING (un envío anterior ya llegó) cuenta como enviado; otro error sube al flujo facial', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { progress: PHOTO_DONE, submit: () => apiFail(409, 'ENROLLMENT_PENDING', 'Ya enviado') });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    expect(await screen.findByText('Registro en validación')).toBeInTheDocument();
    expect(session.flowErrors).toEqual([]);
  });

  it('un error corregible del envío sube al flujo facial', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { progress: PHOTO_DONE, submit: () => apiFail(422, 'ENROLLMENT_PHOTO_MISMATCH', 'No coinciden') });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    await vi.waitFor(() => expect(session.flowErrors).toHaveLength(1));
    expect(session.flowErrors[0]).toMatchObject({ code: 'ENROLLMENT_PHOTO_MISMATCH' });
  });

  it('si releer el usuario falla tres veces: el aviso lo dice y regresa al índice (no salta a una pantalla que aún no tiene)', async () => {
    session.refreshUser.mockRejectedValue(new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'Sin red' }));
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { progress: PHOTO_DONE, submit: () => apiOk({ enrollment_id: 3, face_status: 'PENDING_REVIEW' }) });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    expect(await screen.findByRole('dialog', { name: 'Registro enviado' })).toHaveTextContent('La pantalla se actualizará al volver la conexión');
    expect(screen.getByText('Índice del registro')).toBeInTheDocument();
    expect(session.waits).toEqual([1000, 2000, 4000]);
  });

  it('una falla de la cámara se explica y regresa al índice', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { progress: PHOTO_DONE });
    await userEvent.click(await screen.findByRole('button', { name: 'falla de cámara' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo completar el registro' })).toBeInTheDocument();
    expect(screen.getByText('Índice del registro')).toBeInTheDocument();
  });
});

describe('Paso 3: el video con preguntas', () => {
  it.each<[string, EnrollmentProgress, string]>([
    ['bloqueado', NOTHING_DONE, 'Faltan tus capturas'],
    ['con los intentos agotados', { ...NOTHING_DONE, voice: { status: 'exhausted', answered: 0, total: 3, attempts_left: 0 } }, 'Intentos agotados'],
    ['sin video en la política', { ...NOTHING_DONE, voice: { status: 'not_required', answered: 0, total: 0, attempts_left: null } }, 'Sin video'],
  ])('%s: lo dice con su vacío', async (_case, progress, title) => {
    renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { progress });
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByTestId('voice')).toBeNull();
  });

  it('pide su sesión UNA vez (también en modo estricto) y la responde; al terminar, el registro queda en validación', async () => {
    const sent = renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { progress: CAPTURES_DONE, start: () => apiOk(voice('tok-1')) }, true, true);
    const flow = await screen.findByTestId('voice');
    expect(flow).toHaveAttribute('data-token', 'tok-1');
    expect(within(flow).getByRole('list', { name: 'Paso 3 de 4' })).toBeInTheDocument();
    expect(sent('/enrollment/voice/start')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'respuestas aceptadas' }));
    expect(await screen.findByText('Registro en validación')).toBeInTheDocument();
  });

  it('una sesión vencida se avisa y se pide otra (las respuestas aceptadas siguen); intentos agotados regresan al índice', async () => {
    let issued = 0;
    const sent = renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { progress: CAPTURES_DONE, start: () => apiOk(voice(`tok-${++issued}`)) });
    await userEvent.click(await screen.findByRole('button', { name: 'sesión vencida' }));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo completar el registro' });
    expect(popup).toHaveTextContent('La verificación por voz venció.');
    expect(await screen.findByTestId('voice')).toHaveAttribute('data-token', 'tok-2');
    expect(sent('/enrollment/voice/start')).toHaveLength(2);
    await userEvent.click(within(popup).getAllByRole('button').at(-1)!);
    await userEvent.click(screen.getByRole('button', { name: 'intentos agotados' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
  });

  it('micrófono negado: el popup con su explicación y regresa al índice; salir también regresa', async () => {
    renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { progress: CAPTURES_DONE, start: () => apiOk(voice('tok-1')) });
    await userEvent.click(await screen.findByRole('button', { name: 'micrófono negado' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo completar el registro' })).toHaveTextContent('El micrófono está bloqueado');
    expect(screen.getByText('Índice del registro')).toBeInTheDocument();
  });

  it('un reinicio sin código del servidor no pide otra sesión: se explica y regresa al índice', async () => {
    const sent = renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { progress: CAPTURES_DONE, start: () => apiOk(voice('tok-1')) });
    await userEvent.click(await screen.findByRole('button', { name: 'reinicio sin código' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
    expect(sent('/enrollment/voice/start')).toHaveLength(1);
  });

  it('salir del video regresa al índice', async () => {
    renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { progress: CAPTURES_DONE, start: () => apiOk(voice('tok-1')) });
    await userEvent.click(await screen.findByRole('button', { name: 'salir del video' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
  });

  it('si la sesión no se puede pedir (409 VOICE_NOT_PENDING): el popup del servidor y regresa al índice', async () => {
    renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { progress: CAPTURES_DONE, start: () => apiFail(409, 'VOICE_NOT_PENDING', 'Este registro no tiene una verificación por voz pendiente') });
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo completar el registro' })).toHaveTextContent('Este registro no tiene una verificación por voz pendiente');
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
  });
});

describe('Pantallas de los pasos: estado, idioma y utilidades', () => {
  it('si el estado no llega: «Reintentar»', async () => {
    let fail = true;
    mockFetch((call) => (call.url.includes('/enrollment/progress') ? (fail ? apiFail(503, 'SERVER_BUSY', 'Ocupado') : apiOk(PHOTO_DONE)) : apiOk(samplePolicy)));
    renderWithProviders(<EnrollmentCapturePage />, { route: { pathname: '/', state: { confirmed: true } } });
    await userEvent.click(within(await screen.findByRole('alertdialog')).getAllByRole('button').at(-1)!);
    fail = false;
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByTestId('flow')).toBeInTheDocument();
  });

  it('el vacío de un paso cambia de idioma en caliente', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage);
    expect(await screen.findByText('Falta tu foto inicial')).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    expect(await screen.findByText('First photo missing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to enrollment' })).toBeInTheDocument();
  });

  it('refreshWithRetry: lo logra al segundo intento o se rinde tras los que se le piden', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('red')).mockResolvedValue(undefined);
    expect(await refreshWithRetry(refresh)).toBe(true);
    expect(await refreshWithRetry(() => Promise.reject(new Error('red')), 1)).toBe(false);
  });
});
