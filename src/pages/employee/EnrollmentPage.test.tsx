import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { setLocale } from '../../i18n/core';
import { paths } from '../../routes/paths';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders, sampleUser } from '../../test/render';
import { CAPTURES_DONE, CHECKED, EXPIRES, NOTHING_DONE, PHOTO_DONE, SENT } from '../../test/enrollment';
import type { EnrollmentProgress, User, UserEmployeeInfo } from '../../types';
import { formatDateTime } from '../../utils/format';
import { EnrollmentPage, resetEnrollmentNotices } from './EnrollmentPage';

/*
 * El ÍNDICE del registro facial (decisión del dueño del producto, 2026-10-07): una opción por paso con su estado desde el
 * servidor y su botón, que confirma ANTES de abrir la cámara y lleva a la pantalla del paso. Las pantallas de cada paso
 * se prueban en `EnrollmentStepPages.test.tsx`.
 */
const session = vi.hoisted(() => ({ user: null as User | null, refreshUser: vi.fn<() => Promise<void>>() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => session }));

/** Dónde quedó la navegación (y con qué `state`). */
function Landed({ name }: { name: string }) {
  const state = useLocation().state as { confirmed?: boolean } | null;
  return <p>{`${name}${state?.confirmed ? ' (confirmado)' : ''}`}</p>;
}

function renderIndex(progress: EnrollmentProgress | (() => Response) = NOTHING_DONE) {
  const respond = typeof progress === 'function' ? progress : () => apiOk(progress);
  const { calls } = mockFetch((call) => (call.url.includes('/enrollment/progress') ? respond() : apiOk(samplePolicy)));
  const view = renderWithProviders(
    <Routes>
      <Route path="/" element={<EnrollmentPage />} />
      <Route path={paths.employee.enrollPhoto} element={<Landed name="Pantalla de la foto" />} />
      <Route path={paths.employee.enrollCapture} element={<Landed name="Pantalla de las capturas" />} />
      <Route path={paths.employee.enrollVoice} element={<Landed name="Pantalla del video" />} />
    </Routes>,
  );
  return Object.assign(view, { calls });
}

const steps = () => within(screen.getByRole('list', { name: 'Pasos del registro facial' })).getAllByRole('listitem');
const withEmployee = (changes: Partial<UserEmployeeInfo>) => {
  session.user = { ...sampleUser, employee: sampleUser.employee && { ...sampleUser.employee, ...changes } };
};

beforeEach(() => {
  withEmployee({ face_status: 'NOT_ENROLLED', face_rejection_reason: null });
  session.refreshUser.mockReset().mockResolvedValue(undefined);
  resetEnrollmentNotices(); // el aviso se abre una vez por sesión; cada prueba arranca sin esa marca
});
afterEach(() => resetPolicyCache());

describe('EnrollmentPage: el índice de los pasos independientes', () => {
  it('nada hecho: tres pasos en orden; la foto por tomar y los demás bloqueados con lo que falta', async () => {
    renderIndex();
    expect(await screen.findByText('3 pasos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bienvenido, Ana' })).toBeInTheDocument();
    expect(screen.getByText(/Puedes salir después de cualquiera y continuar otro día/)).toBeInTheDocument();
    const [photo, captures, video] = steps();
    expect(photo).toHaveTextContent('Foto inicial');
    expect(photo).toHaveTextContent('Pendiente');
    expect(within(photo).getByRole('button', { name: 'Tomar foto' })).toBeInTheDocument();
    expect(captures).toHaveTextContent('Capturas y prueba de vida');
    expect(captures).toHaveTextContent('32 capturas de tu rostro y cuatro movimientos de la cabeza.');
    expect(captures).toHaveTextContent('Bloqueado');
    expect(captures).toHaveTextContent('Primero toma tu foto inicial.');
    expect(within(captures).queryByRole('button')).toBeNull();
    expect(video).toHaveTextContent('Video con preguntas');
    expect(video).toHaveTextContent('Primero completa las capturas.');
    expect(captures.className).toContain('enroll-index__step--locked');
    expect(screen.queryByRole('dialog')).toBeNull(); // un resultado normal no avisa nada
  });

  it('cada botón confirma ANTES de abrir la cámara: cancelar se queda; confirmar lleva a su pantalla (ya confirmada)', async () => {
    renderIndex();
    await userEvent.click(await screen.findByRole('button', { name: 'Tomar foto' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Tomar tu foto inicial?' });
    expect(dialog).toHaveTextContent('Se abrirá la cámara para tomar una foto de tu rostro de frente.');
    expect(dialog).not.toHaveTextContent('se reemplazará');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tomar foto' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Tomar tu foto inicial?' })).getByRole('button', { name: 'Abrir cámara' }));
    expect(await screen.findByText('Pantalla de la foto (confirmado)')).toBeInTheDocument();
  });

  it('foto hecha: «Completado» con su fecha y hasta cuándo sirve; «Repetir foto» avisa que reemplaza la anterior; las capturas, disponibles', async () => {
    renderIndex(PHOTO_DONE);
    const [photo, captures] = await screen.findAllByRole('listitem');
    expect(photo).toHaveTextContent(`Completado · ${formatDateTime(CHECKED)}`);
    expect(photo).toHaveTextContent(`Sirve hasta el ${formatDateTime(EXPIRES)}`);
    // Hecho según el servidor: la tarjeta completa en verde (clase `--done`) y la palomita en lugar del número.
    expect(photo.className).toContain('enroll-index__step--done');
    expect(photo.querySelector('.enroll-index__number svg')).not.toBeNull();
    expect(captures.querySelector('.enroll-index__number')).toHaveTextContent('2');
    await userEvent.click(within(photo).getByRole('button', { name: 'Repetir foto' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Tomar tu foto inicial?' });
    expect(dialog).toHaveTextContent('Tu foto inicial anterior se reemplazará por esta.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(within(captures).getByRole('button', { name: 'Iniciar capturas' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Iniciar las capturas?' });
    expect(confirm).toHaveTextContent('Se abrirá la cámara para tomar 32 capturas de tu rostro y hacer la prueba de vida.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Abrir cámara' }));
    expect(await screen.findByText('Pantalla de las capturas (confirmado)')).toBeInTheDocument();
  });

  it('capturas hechas y el video a medias: «2 de 3 respondidas» y «Continuar video» (la confirmación dice cuántas faltan)', async () => {
    renderIndex(CAPTURES_DONE);
    const [photo, captures, video] = await screen.findAllByRole('listitem');
    expect(within(photo).queryByRole('button')).toBeNull(); // ya se usó en las capturas
    expect(captures).toHaveTextContent(`Completado · ${formatDateTime(SENT)}`);
    expect(video).toHaveTextContent('2 de 3 respondidas');
    await userEvent.click(within(video).getByRole('button', { name: 'Continuar video' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Grabar el video?' });
    expect(dialog).toHaveTextContent('Se abrirán la cámara y el micrófono para responder 1 pregunta en video.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Abrir cámara' }));
    expect(await screen.findByText('Pantalla del video (confirmado)')).toBeInTheDocument();
  });

  it('el video sin empezar dice «Grabar video» y cuántas preguntas son', async () => {
    renderIndex({ ...CAPTURES_DONE, voice: { status: 'pending', answered: 0, total: 3, attempts_left: 9 } });
    await userEvent.click(await screen.findByRole('button', { name: 'Grabar video' }));
    expect(await screen.findByRole('dialog', { name: '¿Grabar el video?' })).toHaveTextContent('responder 3 preguntas en video');
  });

  it('foto vencida e intentos agotados: avisos que dicen qué repetir', async () => {
    renderIndex({ ...NOTHING_DONE, photo: { status: 'expired', checked_at: CHECKED, expires_at: EXPIRES }, voice: { status: 'exhausted', answered: 1, total: 3, attempts_left: 0 } });
    const [photo, , video] = await screen.findAllByRole('listitem');
    expect(photo).toHaveTextContent('Vencido');
    expect(photo).toHaveTextContent('Tu foto venció. Tómala de nuevo.');
    expect(within(photo).getByRole('button', { name: 'Tomar foto' })).toBeInTheDocument();
    expect(video).toHaveTextContent('Intentos agotados');
    expect(video).toHaveTextContent('Se agotaron los intentos. Repite la foto inicial y las capturas.');
    expect(video.className).toContain('enroll-index__step--warn');
  });

  it('todo enviado (la sesión aún no se actualizaba al terminar sin red): los tres pasos completados y sin botones', async () => {
    renderIndex({ ...CAPTURES_DONE, face_status: 'PENDING_REVIEW', voice: { status: 'done', answered: 3, total: 3, attempts_left: null } });
    const [, , video] = await screen.findAllByRole('listitem');
    expect(video).toHaveTextContent('Completado');
    expect(screen.queryByRole('button', { name: /foto|capturas|video/i })).toBeNull();
  });

  it('sin el video en la política: dos pasos', async () => {
    renderIndex({ ...NOTHING_DONE, voice: { status: 'not_required', answered: 0, total: 0, attempts_left: null } });
    expect(await screen.findByText('2 pasos')).toBeInTheDocument();
    expect(steps()).toHaveLength(2);
  });

  it('si el estado no llega: el popup de la falla y «Reintentar» lo vuelve a pedir', async () => {
    let fail = true;
    renderIndex(() => (fail ? apiFail(409, 'CONFLICT', 'Algo pasó') : apiOk(NOTHING_DONE)));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar tu registro' });
    expect(popup).toHaveTextContent('Algo pasó');
    expect(screen.getAllByRole('button', { name: 'Reintentar' }).length).toBeGreaterThan(0);
    fail = false;
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('3 pasos')).toBeInTheDocument();
  });
});

describe('EnrollmentPage: avisos al entrar', () => {
  it.each([
    ['con el motivo de la empresa', 'La foto está borrosa', 'Motivo: “La foto está borrosa”.'],
    ['sin motivo', null, 'Tu empresa no pudo validar tu identidad con las capturas enviadas.'],
  ])('registro rechazado %s: lo explica en un popup y la foto dice que reemplaza el registro anterior', async (_case, reason, text) => {
    withEmployee({ face_status: 'REJECTED', face_rejection_reason: reason });
    renderIndex();
    const popup = await screen.findByRole('alertdialog', { name: 'Tu registro anterior fue rechazado' });
    expect(popup).toHaveTextContent(text);
    expect(popup).toHaveTextContent('Ubícate en un lugar bien iluminado.');
    expect(screen.getByRole('heading', { name: 'Registra tu rostro de nuevo' })).toBeInTheDocument();
    await userEvent.click(within(popup).getAllByRole('button').at(-1)!);
    await userEvent.click(screen.getByRole('button', { name: 'Tomar foto' }));
    expect(await screen.findByRole('dialog', { name: '¿Tomar tu foto inicial?' })).toHaveTextContent('Tu registro anterior se reemplazará por este.');
  });

  it('la empresa pidió verificar de nuevo la identidad: popup con su motivo', async () => {
    withEmployee({ face_status: 'NOT_ENROLLED', face_rejection_reason: 'Cambio importante de apariencia' });
    renderIndex();
    const popup = await screen.findByRole('dialog', { name: 'Verifica de nuevo tu identidad' });
    expect(popup).toHaveTextContent('Solicitud de tu empresa');
    expect(popup).toHaveTextContent('Cambio importante de apariencia');
    expect(screen.getByRole('heading', { name: 'Registra tu rostro de nuevo' })).toBeInTheDocument();
  });

  it('el aviso se abre una sola vez por sesión: al volver al índice con el mismo motivo ya no reaparece', async () => {
    withEmployee({ face_status: 'REJECTED', face_rejection_reason: 'La foto está borrosa' });
    const first = renderIndex();
    await screen.findByRole('alertdialog', { name: 'Tu registro anterior fue rechazado' });
    first.unmount(); // se sale del índice (el popup se va con su árbol), pero la marca queda en memoria de la sesión
    renderIndex(); // se vuelve a entrar: `notifiedEnrollment.has(mark)` es verdadero y no se reabre
    await screen.findByRole('heading', { name: 'Registra tu rostro de nuevo' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('sin datos de empleado aún: saludo sin nombre', async () => {
    session.user = { ...sampleUser, employee: null };
    renderIndex();
    expect(await screen.findByRole('heading', { name: 'Bienvenido,' })).toBeInTheDocument();
  });
});

describe('EnrollmentPage en inglés y con cambio de idioma en caliente', () => {
  it('el índice y la confirmación abierta cambian de idioma sin cerrarse', async () => {
    renderIndex(PHOTO_DONE);
    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar capturas' }));
    expect(await screen.findByRole('dialog', { name: '¿Iniciar las capturas?' })).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('dialog', { name: 'Start the captures?' })).toHaveTextContent('The camera will open to take 32 captures of your face');
    expect(await screen.findByText('3 steps')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Face enrollment steps' })).toHaveTextContent('Captures and liveness check');
    expect(screen.getByText(`Completed · ${formatDateTime(CHECKED)}`)).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Open camera' }));
    expect(await screen.findByText('Pantalla de las capturas (confirmado)')).toBeInTheDocument();
  });
});
