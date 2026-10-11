import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapturedFace, EnrollmentFlowStep } from '../../components/LiveFaceFlow';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { setLocale } from '../../i18n/core';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { ADDRESS_TYPES, CAPTURES_DONE, CUSTOM_FIVE, NOTHING_DONE, OFFICIAL_ID_TYPES, PHOTO_DONE, progress, SENT, step, UPLOADED } from '../../test/enrollment';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders, sampleUser } from '../../test/render';
import { spokenTexts } from '../../test/speechSynthesis';
import type { EnrollmentProgress, User, VoiceChallenge } from '../../types';
import { formatDateTime } from '../../utils/format';
import { documentsPage, employeeDocument } from '../../test/documents';
import { EnrollmentCapturePage, EnrollmentDocumentPage, EnrollmentDocumentUploadPage, EnrollmentPhotoPage, EnrollmentVoicePage, refreshWithRetry } from './EnrollmentStepPages';

/*
 * Las pantallas de CADA paso del registro de identidad (decisión del dueño del producto, 2026-10-08: el flujo es
 * dinámico y los documentos de identidad son pasos). La cámara y la grabación se prueban en `LiveFaceFlow.*.test.tsx`
 * y `VoiceVerificationFlow.test.tsx`; aquí, qué hace cada pantalla con el estado del servidor, el candado del paso, la
 * confirmación y cada salida del flujo.
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
  flow?: EnrollmentProgress;
  photo?: Responder;
  submit?: Responder;
  start?: Responder;
  documents?: Responder;
}

/** La pantalla del consentimiento: dice a qué paso del registro hay que volver al otorgarlo (`state.from`). */
function ConsentProbe() {
  const { state } = useLocation();
  return <p>{`Consentimiento desde ${String((state as { from?: string } | null)?.from)}`}</p>;
}

function renderStep(path: string, Page: () => ReactNode, server: Server = {}, confirmed = true, strict = false) {
  const { flow = NOTHING_DONE, photo = () => apiOk({ ok: true, message: 'ok', detection_score: 0.9, quality_score: 0.9, yaw_ratio: 0, accessories: [], checked_at: 'a', expires_at: 'b' }), submit, start, documents = () => apiOk(documentsPage([])) } = server;
  const { calls } = mockFetch((call) => {
    if (call.url.includes('/enrollment/progress')) return apiOk(flow);
    if (call.url.includes('/enrollment/photo')) return photo(call);
    if (call.url.includes('/enrollment/face') && submit) return submit(call);
    if (call.url.includes('/enrollment/voice/start') && start) return start(call);
    if (call.url.includes('/me/documents')) return documents(call);
    return apiOk(samplePolicy);
  });
  renderWithProviders(
    <Routes>
      <Route path={paths.employee.enroll} element={<p>Índice del registro</p>} />
      <Route path={paths.employee.pending} element={<p>Registro en validación</p>} />
      <Route path={paths.profileConsents} element={<ConsentProbe />} />
      {/* La ruta de un paso de documentos lleva su CÓDIGO en la URL: el <Route> necesita el patrón (`:step`). */}
      <Route path={path.replace(/\/document\/[A-Z_]+/, '/document/:step')} element={strict ? <StrictMode><Page /></StrictMode> : <Page />} />
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
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, { flow: PHOTO_DONE }, false);
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

  it('al abrir la cámara a mano desbloquea la síntesis de voz dentro del gesto (para que suene en móviles)', async () => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, { flow: PHOTO_DONE }, false);
    expect(spokenTexts()).toEqual([]); // nada hasta el toque
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir cámara' }));
    expect(spokenTexts()).toContain(' '); // el enunciado inaudible de `primeSpeech` corrió en el gesto, antes de la confirmación
  });

  it('«Volver al registro» desde la confirmación pendiente', async () => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, {}, false);
    await userEvent.click(await screen.findByRole('button', { name: 'Volver al registro' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
  });

  it('ya usada en las capturas: lo dice con su vacío (no se repite) y regresa al índice', async () => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, { flow: CAPTURES_DONE });
    expect(await screen.findByText('Paso completado')).toBeInTheDocument();
    expect(screen.getByText('Ya quedó listo. Continúa con el siguiente paso.')).toBeInTheDocument();
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
  it('bloqueadas por el paso que falta: lo dicen con su vacío, nombrando ese paso con el catálogo', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage);
    expect(await screen.findByText('Falta un paso antes')).toBeInTheDocument();
    expect(screen.getByText('Completa «Foto inicial» para continuar con este paso.')).toBeInTheDocument();
  });

  it('ya enviadas: «Paso completado»', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { flow: CAPTURES_DONE });
    expect(await screen.findByText('Paso completado')).toBeInTheDocument();
  });

  it('aceptadas con el video pendiente: regresan al índice (el video ya aparece disponible)', async () => {
    const sent = renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { flow: PHOTO_DONE, submit: () => apiOk({ enrollment_id: 3, face_status: 'NOT_ENROLLED' }) });
    const flow = await screen.findByTestId('flow');
    expect(flow).toHaveAttribute('data-step', 'captures');
    expect(within(flow).getByRole('list', { name: 'Paso 2 de 4' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
    expect(sent('/enrollment/face')).toHaveLength(1);
    expect(session.refreshUser).not.toHaveBeenCalled();
  });

  it('sin video en el flujo, el registro queda en validación: popup y la pantalla «En validación»', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, {
      flow: progress([step('INITIAL_PHOTO', 'done', { done_at: SENT }), step('FACE_CAPTURES', 'pending')]),
      submit: () => apiOk({ enrollment_id: 3, face_status: 'PENDING_REVIEW' }),
    });
    expect(within(await screen.findByTestId('flow')).getByRole('list', { name: 'Paso 2 de 3' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }));
    expect(await screen.findByText('Registro en validación')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Registro enviado' })).toHaveTextContent('Tu empresa validará tu identidad en breve.');
  });

  it('409 ENROLLMENT_PENDING (un envío anterior ya llegó) cuenta como enviado; otro error sube al flujo facial', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { flow: PHOTO_DONE, submit: () => apiFail(409, 'ENROLLMENT_PENDING', 'Ya enviado') });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    expect(await screen.findByText('Registro en validación')).toBeInTheDocument();
    expect(session.flowErrors).toEqual([]);
  });

  it('un error corregible del envío sube al flujo facial', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { flow: PHOTO_DONE, submit: () => apiFail(422, 'ENROLLMENT_PHOTO_MISMATCH', 'No coinciden') });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    await vi.waitFor(() => expect(session.flowErrors).toHaveLength(1));
    expect(session.flowErrors[0]).toMatchObject({ code: 'ENROLLMENT_PHOTO_MISMATCH' });
  });

  it('si releer el usuario falla tres veces: el aviso lo dice y regresa al índice (no salta a una pantalla que aún no tiene)', async () => {
    session.refreshUser.mockRejectedValue(new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'Sin red' }));
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { flow: PHOTO_DONE, submit: () => apiOk({ enrollment_id: 3, face_status: 'PENDING_REVIEW' }) });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    expect(await screen.findByRole('dialog', { name: 'Registro enviado' })).toHaveTextContent('La pantalla se actualizará al volver la conexión');
    expect(screen.getByText('Índice del registro')).toBeInTheDocument();
    expect(session.waits).toEqual([1000, 2000, 4000]);
  });

  it('una falla de la cámara se explica y regresa al índice', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { flow: PHOTO_DONE });
    await userEvent.click(await screen.findByRole('button', { name: 'falla de cámara' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo completar el registro' })).toBeInTheDocument();
    expect(screen.getByText('Índice del registro')).toBeInTheDocument();
  });
});

describe('Paso 3: el video con preguntas', () => {
  it.each<[string, EnrollmentProgress, string]>([
    ['bloqueado por las capturas', NOTHING_DONE, 'Falta un paso antes'],
    [
      'con los intentos agotados',
      progress([step('INITIAL_PHOTO', 'pending'), step('FACE_CAPTURES', 'blocked', { blocked_by: 'INITIAL_PHOTO' }), step('VOICE_VIDEO', 'exhausted', { answered: 0, total: 3, attempts_left: 0 })]),
      'Intentos agotados',
    ],
    ['que la empresa dejó de pedir', progress([step('FACE_CAPTURES', 'pending')]), 'Paso no solicitado'],
  ])('%s: lo dice con su vacío', async (_case, flow, title) => {
    renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { flow });
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByTestId('voice')).toBeNull();
  });

  it('pide su sesión UNA vez (también en modo estricto) y la responde; al terminar, el registro queda en validación', async () => {
    const sent = renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { flow: CAPTURES_DONE, start: () => apiOk(voice('tok-1')) }, true, true);
    const flow = await screen.findByTestId('voice');
    expect(flow).toHaveAttribute('data-token', 'tok-1');
    expect(within(flow).getByRole('list', { name: 'Paso 3 de 4' })).toBeInTheDocument();
    expect(sent('/enrollment/voice/start')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'respuestas aceptadas' }));
    expect(await screen.findByText('Registro en validación')).toBeInTheDocument();
  });

  it('una sesión vencida se avisa y se pide otra (las respuestas aceptadas siguen); intentos agotados regresan al índice', async () => {
    let issued = 0;
    const sent = renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { flow: CAPTURES_DONE, start: () => apiOk(voice(`tok-${++issued}`)) });
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
    renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { flow: CAPTURES_DONE, start: () => apiOk(voice('tok-1')) });
    await userEvent.click(await screen.findByRole('button', { name: 'micrófono negado' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo completar el registro' })).toHaveTextContent('El micrófono está bloqueado');
    expect(screen.getByText('Índice del registro')).toBeInTheDocument();
  });

  it('un reinicio sin código del servidor no pide otra sesión: se explica y regresa al índice', async () => {
    const sent = renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { flow: CAPTURES_DONE, start: () => apiOk(voice('tok-1')) });
    await userEvent.click(await screen.findByRole('button', { name: 'reinicio sin código' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
    expect(sent('/enrollment/voice/start')).toHaveLength(1);
  });

  it('salir del video regresa al índice', async () => {
    renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { flow: CAPTURES_DONE, start: () => apiOk(voice('tok-1')) });
    await userEvent.click(await screen.findByRole('button', { name: 'salir del video' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
  });

  it('si la sesión no se puede pedir (409 VOICE_NOT_PENDING): el popup del servidor y regresa al índice', async () => {
    renderStep(paths.employee.enrollVoice, EnrollmentVoicePage, { flow: CAPTURES_DONE, start: () => apiFail(409, 'VOICE_NOT_PENDING', 'Este registro no tiene una verificación por voz pendiente') });
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
    expect(await screen.findByText('Falta un paso antes')).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    expect(await screen.findByText('A step comes first')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to enrollment' })).toBeInTheDocument();
  });

  it('refreshWithRetry: lo logra al segundo intento o se rinde tras los que se le piden', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('red')).mockResolvedValue(undefined);
    expect(await refreshWithRetry(refresh)).toBe(true);
    expect(await refreshWithRetry(() => Promise.reject(new Error('red')), 1)).toBe(false);
  });
});

describe('Resiliencia: falta el consentimiento biométrico (403)', () => {
  const missing = () => apiFail(403, 'BIOMETRIC_CONSENT_REQUIRED', 'Falta tu consentimiento para tratar datos biométricos. Otórgalo para continuar.');

  it('al guardar la foto: lo explica y lleva al consentimiento, que sabe a qué paso volver', async () => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, { photo: missing });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    expect(await screen.findByRole('alertdialog', { name: 'Falta tu consentimiento' })).toHaveTextContent('Otórgalo para continuar');
    expect(await screen.findByText(`Consentimiento desde ${paths.employee.enrollPhoto}`)).toBeInTheDocument();
    expect(session.flowErrors).toEqual([]); // no vuelve al flujo facial: reintentar ahí no serviría
  });

  it('al enviar las capturas: igual, con el paso de las capturas para reanudarlo', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, { flow: PHOTO_DONE, submit: missing });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    expect(await screen.findByRole('alertdialog', { name: 'Falta tu consentimiento' })).toBeInTheDocument();
    expect(await screen.findByText(`Consentimiento desde ${paths.employee.enrollCapture}`)).toBeInTheDocument();
    expect(session.flowErrors).toEqual([]);
  });

  it('otro 403 del servidor no es esto: vuelve al flujo facial, que lo explica', async () => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, { photo: () => apiFail(403, 'FACE_NOT_APPROVED', 'Tu registro facial no está aprobado') });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    await vi.waitFor(() => expect(session.flowErrors).toHaveLength(1));
    expect(session.flowErrors[0]).toMatchObject({ code: 'FACE_NOT_APPROVED' });
    expect(screen.getByTestId('flow')).toBeInTheDocument();
  });
});

describe('Resiliencia: el servidor dice que el paso ya no toca (409)', () => {
  it.each([
    ['ENROLLMENT_STEP_BLOCKED', 'Antes de este paso completa «Comprobante de domicilio»'],
    ['ENROLLMENT_STEP_DISABLED', 'Tu empresa no pide este paso de tu registro'],
  ])('%s al guardar la foto: se explica con el mensaje del servidor y regresa al índice (nunca un reintento inútil)', async (code, message) => {
    renderStep(paths.employee.enrollPhoto, EnrollmentPhotoPage, { photo: () => apiFail(409, code, message) });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    expect(await screen.findByRole('alertdialog', { name: 'Este paso ya no está disponible' })).toHaveTextContent(message);
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
    expect(session.flowErrors).toEqual([]); // no vuelve al flujo facial: reintentar ahí no serviría
  });

  it('ENROLLMENT_STEP_BLOCKED al enviar las capturas: igual, de vuelta al índice', async () => {
    renderStep(paths.employee.enrollCapture, EnrollmentCapturePage, {
      flow: PHOTO_DONE,
      submit: () => apiFail(409, 'ENROLLMENT_STEP_BLOCKED', 'Antes de este paso completa «Identificación oficial»'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'enviar' }));
    expect(await screen.findByRole('alertdialog', { name: 'Este paso ya no está disponible' })).toBeInTheDocument();
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
    expect(session.flowErrors).toEqual([]);
  });

  it('un paso que esta versión de la app no conoce: su vacío pide actualizar y regresa al índice', async () => {
    renderStep(paths.employee.enrollDocument('FUTURE_STEP'), EnrollmentDocumentPage, { flow: progress([step('FUTURE_STEP', 'pending')]) });
    expect(await screen.findByText('Paso no disponible')).toBeInTheDocument();
    expect(screen.getByText('Actualiza la aplicación para continuar con este paso.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver al registro' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
  });
});

describe('Pasos de documentos: la pantalla del paso y su formulario', () => {
  it('la pantalla del paso: nombre y descripción del catálogo, cómo va y la lista de lo subido', async () => {
    renderStep(paths.employee.enrollDocument('OFFICIAL_ID'), EnrollmentDocumentPage, { flow: CUSTOM_FIVE, documents: () => apiOk(documentsPage([employeeDocument()])) });
    expect(await screen.findByRole('heading', { name: 'Identificación oficial' })).toBeInTheDocument();
    expect(screen.getByText('Pasaporte, credencial para votar u otra identificación con fotografía.')).toBeInTheDocument();
    expect(screen.getByText(`Documento recibido · ${formatDateTime(UPLOADED)}`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reemplazar documento' })).toHaveAttribute('href', '/employee/enroll/document/OFFICIAL_ID/new');
    expect(await screen.findByText('pasaporte.jpg')).toBeInTheDocument();
  });

  it('un documento hecho sin fecha de recepción dice solo «Documento recibido.»', async () => {
    renderStep(paths.employee.enrollDocument('OFFICIAL_ID'), EnrollmentDocumentPage, { flow: progress([step('OFFICIAL_ID', 'done', { document_types: OFFICIAL_ID_TYPES })]) });
    expect(await screen.findByRole('heading', { name: 'Identificación oficial' })).toBeInTheDocument();
    expect(screen.getByText('Documento recibido.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reemplazar documento' })).toBeInTheDocument();
  });

  it('una ruta de documentos sin el código del paso (un enlace incompleto) cae en «Paso no disponible», sin abrir nada', async () => {
    const sent = renderStep('/employee/enroll/document', EnrollmentDocumentPage, { flow: CUSTOM_FIVE });
    expect(await screen.findByText('Paso no disponible')).toBeInTheDocument();
    expect(screen.getByText('Actualiza la aplicación para continuar con este paso.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Subir documento' })).toBeNull();
    expect(sent('/me/documents')).toHaveLength(0); // ni siquiera pide la lista de documentos
    await userEvent.click(screen.getByRole('button', { name: 'Volver al registro' }));
    expect(await screen.findByText('Índice del registro')).toBeInTheDocument();
  });

  it('un paso pendiente dice que falta el documento y ofrece subirlo', async () => {
    renderStep(paths.employee.enrollDocument('PROOF_OF_ADDRESS'), EnrollmentDocumentPage, { flow: CUSTOM_FIVE });
    expect(await screen.findByRole('heading', { name: 'Comprobante de domicilio' })).toBeInTheDocument();
    expect(screen.getByText('Falta subir tu documento.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Subir documento' })).toHaveAttribute('href', '/employee/enroll/document/PROOF_OF_ADDRESS/new');
  });

  it('el formulario ofrece SOLO los tipos que acepta ese paso y vuelve a la pantalla del paso', async () => {
    renderStep(paths.employee.newEnrollmentDocument('OFFICIAL_ID'), EnrollmentDocumentUploadPage, { flow: CUSTOM_FIVE });
    expect(await screen.findByRole('heading', { name: 'Subir documento' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Identificación oficial' })).toHaveAttribute('href', '/employee/enroll/document/OFFICIAL_ID');
    await userEvent.click(screen.getByRole('button', { name: /Tipo de documento/ }));
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toHaveLength(OFFICIAL_ID_TYPES.length);
    expect(options.join(' ')).not.toContain('Comprobante de domicilio');
  });

  it('el formulario del comprobante solo ofrece su tipo', async () => {
    renderStep(paths.employee.newEnrollmentDocument('PROOF_OF_ADDRESS'), EnrollmentDocumentUploadPage, { flow: CUSTOM_FIVE });
    await userEvent.click(await screen.findByRole('button', { name: /Tipo de documento/ }));
    expect(screen.getAllByRole('option')).toHaveLength(ADDRESS_TYPES.length);
  });

  it('un paso de documentos que la empresa no pide: su vacío, sin formulario', async () => {
    renderStep(paths.employee.enrollDocument('OFFICIAL_ID'), EnrollmentDocumentPage, { flow: NOTHING_DONE });
    expect(await screen.findByText('Paso no solicitado')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Subir documento' })).toBeNull();
  });
});
