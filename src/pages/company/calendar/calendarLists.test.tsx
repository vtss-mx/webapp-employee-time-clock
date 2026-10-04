import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { longDate } from '../../../components/calendar/calendarRules';
import { ABSENCES_CHANGED, calendarServer, first, request, third, vacation, workday } from '../../../components/calendar/testData';
import { page } from '../../../components/employees/testData';
import { apiFail, apiOk, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { formatDate } from '../../../utils/format';
import { CalendarPage } from './CalendarPage';

/** Avisos al contador del menú (`notifyAbsenceRequestsChanged`). */
const changes = vi.fn();
beforeEach(() => {
  changes.mockReset();
  window.addEventListener(ABSENCES_CHANGED, changes);
});
afterEach(() => {
  window.removeEventListener(ABSENCES_CHANGED, changes);
  vi.unstubAllGlobals();
});

const renderAt = (tab: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/company/calendar" element={<CalendarPage />} />
    </Routes>,
    { route: `/company/calendar?tab=${tab}` },
  );

/** Una respuesta que tarda un poco (para ver la lista atenuada mientras se recarga). */
const later = (response: Response) => new Promise<Response>((resolve) => window.setTimeout(() => resolve(response), 60));
const count = (calls: MockCall[], prefix: string) => calls.filter((call) => call.url.startsWith(prefix)).length;
const lastUrl = (calls: MockCall[]) => calls.filter((call) => call.url.startsWith('/api/calendar/absences?')).at(-1)?.url;
const close = async (name: string, role: 'dialog' | 'alertdialog' = 'alertdialog') => userEvent.click(within(await screen.findByRole(role, { name })).getByRole('button', { name: 'Entendido' }));
const actionsSent = (calls: MockCall[]) => calls.filter((call) => call.init.method === 'POST' || call.init.method === 'DELETE').length;
/** Pulsa el botón de la fila y responde la pregunta con `answer` (confirmar o cancelar). */
async function ask(button: string, question: { name: string; role: 'dialog' | 'alertdialog' }, answer: string) {
  await userEvent.click(screen.getByRole('button', { name: button }));
  await userEvent.click(within(await screen.findByRole(question.role, { name: question.name })).getByRole('button', { name: answer }));
}
const CANCEL_ABSENCE = { name: '¿Cancelar la ausencia de Ana Ruiz?', role: 'alertdialog' } as const;
const APPROVE = { name: '¿Aprobar permiso de Ana Ruiz?', role: 'dialog' } as const;
const REMOVE_WORKDAY = { name: '¿Eliminar el día laborable de Ana Ruiz?', role: 'alertdialog' } as const;

/** Responde las acciones (POST/DELETE) en orden: la primera bien, la segunda "ya cambió" y la tercera con una falla. */
function actions(ok: Response, stale: Response) {
  let calls = 0;
  return (call: MockCall) => {
    if (call.init.method !== 'POST' && call.init.method !== 'DELETE') return null;
    calls += 1;
    if (calls === 1) return ok;
    return calls === 2 ? stale : apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada');
  };
}

describe('Calendario: ausencias', () => {
  it('lista con tipo, rango, estado, quién la registró y notas; filtra por tipo, estado y fechas', async () => {
    const rejected = { ...request, id: 12, note: 'Cita médica', status: 'REJECTED' as const, decision_note: 'Temporada alta' };
    const legacy = { ...vacation, id: 13, type: 'LEGACY', note: null, status: 'CANCELLED' as const };
    const { calls } = calendarServer((call) => (call.url.startsWith('/api/calendar/absences?page') ? apiOk(page([vacation, request, rejected, legacy])) : null));
    renderAt('absences');
    const item = (await screen.findByText('“Viaje familiar”')).closest('li') as HTMLElement;
    expect(lastUrl(calls)).toBe('/api/calendar/absences?page=1&size=10');
    expect(item).toHaveTextContent('Ana Ruiz · EMP-7');
    expect(item).toHaveTextContent(`${formatDate(first)} al ${formatDate(third)} · 3 días`);
    expect(item).toHaveTextContent('Registrada por la empresa');
    expect(within(item).getByText('Vacaciones')).toHaveClass('badge--info');
    expect(within(item).getByText('Aprobada')).toBeInTheDocument();
    const asked = (await screen.findByText('“Trámite”')).closest('li') as HTMLElement;
    expect(asked).toHaveTextContent(`${formatDate(first)} · 1 día`);
    expect(asked).toHaveTextContent('La pidió el empleado hace 3 horas');
    expect(within(asked).getByText('Permiso')).toBeInTheDocument();
    const decided = screen.getByText('Nota de la empresa: “Temporada alta”').closest('li') as HTMLElement;
    expect(within(decided).queryByRole('button', { name: /Cancelar/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Cancelar la ausencia de Ana Ruiz' })).toHaveLength(2);
    // Un tipo que ya no está en el catálogo se muestra con su código y en gris.
    expect(screen.getByText('LEGACY')).toHaveClass('badge--muted');

    await userEvent.click(screen.getByRole('button', { name: /^Tipo/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Vacaciones' }));
    await waitFor(() => expect(lastUrl(calls)).toBe('/api/calendar/absences?page=1&size=10&type=VACATION'));
    await userEvent.click(screen.getByRole('button', { name: /^Estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Aprobada' }));
    await waitFor(() => expect(lastUrl(calls)).toBe('/api/calendar/absences?page=1&size=10&type=VACATION&status=APPROVED'));
    await userEvent.type(screen.getByLabelText('Desde'), '01102026');
    await userEvent.type(screen.getByLabelText('Hasta'), '31022026');
    expect(screen.getByText('Escribe una fecha válida')).toBeInTheDocument();
    await waitFor(() => expect(lastUrl(calls)).toBe('/api/calendar/absences?page=1&size=10&type=VACATION&status=APPROVED&start=2026-10-01'));
    await userEvent.clear(screen.getByLabelText('Hasta'));
    await userEvent.type(screen.getByLabelText('Hasta'), '31102026');
    await waitFor(() => expect(lastUrl(calls)).toBe('/api/calendar/absences?page=1&size=10&type=VACATION&status=APPROVED&start=2026-10-01&end=2026-10-31'));

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await waitFor(() => expect(lastUrl(calls)).toBe('/api/calendar/absences?page=1&size=10'));
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull();
    expect(screen.getByLabelText('Desde')).toHaveValue('');
  });

  it('sin ausencias invita a registrar; con filtros dice que nada coincide', async () => {
    calendarServer((call) => (call.url.startsWith('/api/calendar/absences?') ? apiOk(page([])) : null));
    renderAt('absences');
    expect(await screen.findByText('Aún no hay ausencias')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Registrar ausencia' })[1]).toHaveAttribute('href', '/company/calendar/absences/new');
    await userEvent.click(screen.getByRole('button', { name: /^Estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Cancelada' }));
    expect(await screen.findByText('Ninguna ausencia coincide con los filtros')).toBeInTheDocument();
  });

  it('cancela una vigente (recarga la lista y los contadores); si ya no estaba vigente también recarga', async () => {
    const { calls } = calendarServer(actions(apiOk({ ...vacation, status: 'CANCELLED' }), apiFail(409, 'ABSENCE_CLOSED', 'La ausencia ya no está vigente')));
    renderAt('absences');
    const cancel = await screen.findByRole('button', { name: 'Cancelar la ausencia de Ana Ruiz' });
    expect(count(calls, '/api/calendar/absences/summary')).toBe(1);

    // Pregunta con quién, el tipo, las fechas con sus días y la nota; "Conservarla" no envía nada.
    await userEvent.click(cancel);
    const confirm = await screen.findByRole('alertdialog', { name: CANCEL_ABSENCE.name });
    expect(within(confirm).getByText('Cancelar ausencia', { selector: '.msg__eyebrow' })).toBeInTheDocument();
    expect(confirm).toHaveTextContent('Sus días vuelven a ser laborables: tendrá que checar en ellos.');
    expect(within(confirm).getByRole('region', { name: 'Detalles' })).toHaveTextContent(
      `EmpleadoAna Ruiz · EMP-7TipoVacacionesFechas${formatDate(first)} al ${formatDate(third)} · 3 díasNotaViaje familiar`,
    );
    expect(within(confirm).getByRole('button', { name: 'Conservarla' })).toHaveFocus(); // lo seguro primero
    await userEvent.click(within(confirm).getByRole('button', { name: 'Conservarla' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(actionsSent(calls)).toBe(0);
    expect(count(calls, '/api/calendar/absences?')).toBe(1);
    expect(changes).not.toHaveBeenCalled();
    expect(cancel).toBeEnabled();
    expect(cancel).not.toHaveAttribute('aria-busy');

    await ask('Cancelar la ausencia de Ana Ruiz', CANCEL_ABSENCE, 'Cancelar ausencia');
    expect(await screen.findByRole('dialog', { name: 'Ausencia cancelada' })).toHaveTextContent('Los días de Ana Ruiz vuelven a ser laborables.');
    expect(calls.find((call) => call.init.method === 'POST')?.url).toBe('/api/calendar/absences/10/cancel');
    await waitFor(() => expect(count(calls, '/api/calendar/absences/summary')).toBe(2));
    expect(count(calls, '/api/calendar/absences?')).toBe(2);
    expect(changes).toHaveBeenCalledTimes(1);
    await close('Ausencia cancelada', 'dialog');

    await ask('Cancelar la ausencia de Ana Ruiz', CANCEL_ABSENCE, 'Cancelar ausencia');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cancelar la ausencia' })).toHaveTextContent('La ausencia ya no está vigente');
    await waitFor(() => expect(count(calls, '/api/calendar/absences?')).toBe(3));
    await close('No se pudo cancelar la ausencia');

    await ask('Cancelar la ausencia de Ana Ruiz', CANCEL_ABSENCE, 'Cancelar ausencia');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cancelar la ausencia' })).toHaveTextContent('Falla inesperada');
    expect(count(calls, '/api/calendar/absences?')).toBe(3);
    expect(changes).toHaveBeenCalledTimes(2);
  });
});

describe('Calendario: solicitudes', () => {
  it('pendientes con aprobar y rechazar; aprobar avisa al menú, recarga y actualiza el contador', async () => {
    let approved = false;
    const { calls } = calendarServer((call) => {
      if (call.init.method === 'POST') {
        approved = true;
        return apiOk({ ...request, status: 'APPROVED' });
      }
      return approved && call.url.includes('status=PENDING') ? apiOk(page([])) : null;
    });
    renderAt('requests');
    const item = (await screen.findByText('“Trámite”')).closest('li') as HTMLElement;
    expect(calls.find((call) => call.url.includes('status=PENDING'))?.url).toBe('/api/calendar/absences?page=1&size=10&status=PENDING');
    expect(within(item).getByText('Pendiente')).toBeInTheDocument();
    expect(within(item).getByRole('link', { name: 'Rechazar la solicitud de Ana Ruiz' })).toHaveAttribute('href', '/company/calendar/absences/11/reject');
    expect(await screen.findByRole('tab', { name: 'Solicitudes, 1 por decidir' })).toBeInTheDocument();

    // Pregunta con el tipo en la pregunta y lo que pidió; cancelar no envía nada ni avisa al menú.
    const approve = within(item).getByRole('button', { name: 'Aprobar la solicitud de Ana Ruiz' });
    await userEvent.click(approve);
    const confirm = await screen.findByRole('dialog', { name: APPROVE.name });
    expect(within(confirm).getByText('Aprobar solicitud')).toBeInTheDocument();
    expect(confirm).toHaveTextContent('Esos días no tendrá que checar.');
    expect(within(confirm).getByRole('region', { name: 'Detalles' })).toHaveTextContent(`EmpleadoAna Ruiz · EMP-7TipoPermisoFechas${formatDate(first)} · 1 díaNotaTrámite`);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(actionsSent(calls)).toBe(0);
    expect(changes).not.toHaveBeenCalled();
    expect(approve).toBeEnabled();
    expect(approve).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('tab', { name: 'Solicitudes, 1 por decidir' })).toBeInTheDocument();

    await ask('Aprobar la solicitud de Ana Ruiz', APPROVE, 'Aprobar');
    expect(await screen.findByRole('dialog', { name: 'Solicitud aprobada' })).toHaveTextContent(`Ana Ruiz no tiene que checar: ${formatDate(first)}.`);
    expect(calls.find((call) => call.init.method === 'POST')?.url).toBe('/api/calendar/absences/11/approve');
    expect(changes).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Nada pendiente')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Solicitudes' })).toBeInTheDocument();
  });

  it('si otra persona ya la decidió recarga; otra falla solo se explica', async () => {
    const act = actions(apiFail(409, 'ABSENCE_CLOSED', 'La solicitud ya fue atendida'), apiFail(409, 'ABSENCE_OVERLAP', 'Se encima con otra ausencia'));
    let lists = 0;
    const { calls } = calendarServer((call) => {
      if (!call.url.includes('status=PENDING')) return act(call);
      lists += 1;
      // La recarga tarda: mientras tanto la lista se atenúa.
      return lists === 2 ? later(apiOk(page([request]))) : null;
    });
    renderAt('requests');
    await screen.findByRole('button', { name: 'Aprobar la solicitud de Ana Ruiz' });
    await ask('Aprobar la solicitud de Ana Ruiz', APPROVE, 'Aprobar');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo aprobar la solicitud' })).toHaveTextContent('La solicitud ya fue atendida');
    await waitFor(() => expect(count(calls, '/api/calendar/absences?')).toBe(2));
    expect(document.querySelector('.people-list.is-loading')).not.toBeNull();
    await waitFor(() => expect(document.querySelector('.people-list.is-loading')).toBeNull());
    expect(changes).toHaveBeenCalledTimes(1);
    await close('No se pudo aprobar la solicitud');
    await ask('Aprobar la solicitud de Ana Ruiz', APPROVE, 'Aprobar');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo aprobar la solicitud' })).toHaveTextContent('Se encima con otra ausencia');
    expect(count(calls, '/api/calendar/absences?')).toBe(2);
  });
});

describe('Calendario: días laborables', () => {
  it('lista quién trabaja qué día y por qué; eliminar uno recarga la lista', async () => {
    const plain = { ...workday, id: 21, note: null, employee: { id: 8, full_name: 'Beto Díaz', employee_number: 'EMP-8' } };
    const { calls } = calendarServer((call) => (call.url.startsWith('/api/calendar/workdays?') ? apiOk(page([workday, plain])) : null));
    renderAt('workdays');
    const item = (await screen.findByText('“Cubre la guardia”')).closest('li') as HTMLElement;
    expect(calls.find((call) => call.url.startsWith('/api/calendar/workdays'))?.url).toBe('/api/calendar/workdays?page=1&size=10');
    expect(item).toHaveTextContent(longDate(workday.work_date));
    expect(within(item).getByText('Trabaja')).toBeInTheDocument();
    expect((screen.getByText('Beto Díaz', { exact: false }).closest('li') as HTMLElement).querySelector('.shift-item__quote')).toBeNull();

    // Pregunta con quién y qué día; cancelar no envía nada ni recarga.
    const remove = within(item).getByRole('button', { name: 'Eliminar el día laborable de Ana Ruiz' });
    await userEvent.click(remove);
    const confirm = await screen.findByRole('alertdialog', { name: REMOVE_WORKDAY.name });
    expect(confirm).toHaveTextContent('Ese día vuelve a ser libre para la persona: ya no tendrá que checar.');
    expect(within(confirm).getByRole('region', { name: 'Detalles' })).toHaveTextContent(`EmpleadoAna Ruiz · EMP-7Día${longDate(workday.work_date)}`);
    expect(within(confirm).getByRole('button', { name: 'Cancelar' })).toHaveFocus(); // lo seguro primero
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(actionsSent(calls)).toBe(0);
    expect(count(calls, '/api/calendar/workdays?')).toBe(1);
    expect(remove).toBeEnabled();
    expect(remove).not.toHaveAttribute('aria-busy');

    await ask('Eliminar el día laborable de Ana Ruiz', REMOVE_WORKDAY, 'Eliminar');
    expect(await screen.findByRole('dialog', { name: 'Día laborable eliminado' })).toHaveTextContent(`El ${formatDate(workday.work_date)} vuelve a ser un día libre para Ana Ruiz.`);
    expect(calls.find((call) => call.init.method === 'DELETE')?.url).toBe('/api/calendar/workdays/20');
    await waitFor(() => expect(count(calls, '/api/calendar/workdays?')).toBe(2));
  });

  it('eliminar uno que ya no existía recarga; otra falla solo se explica; sin días, invita a agregar', async () => {
    let deletes = 0;
    let lists = 0;
    let empty = false;
    const { calls } = calendarServer((call) => {
      if (call.init.method === 'DELETE') {
        deletes += 1;
        return deletes === 1 ? apiFail(404, 'WORKDAY_NOT_FOUND', 'Día laborable no encontrado') : apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada');
      }
      if (!call.url.startsWith('/api/calendar/workdays')) return null;
      lists += 1;
      if (empty) return apiOk(page([]));
      return lists === 2 ? later(apiOk(page([workday]))) : null;
    });
    renderAt('workdays');
    await screen.findByRole('button', { name: 'Eliminar el día laborable de Ana Ruiz' });
    await ask('Eliminar el día laborable de Ana Ruiz', REMOVE_WORKDAY, 'Eliminar');
    await close('No se pudo eliminar el día laborable');
    await waitFor(() => expect(count(calls, '/api/calendar/workdays?')).toBe(2));
    expect(document.querySelector('.people-list.is-loading')).not.toBeNull();
    await waitFor(() => expect(document.querySelector('.people-list.is-loading')).toBeNull());
    await ask('Eliminar el día laborable de Ana Ruiz', REMOVE_WORKDAY, 'Eliminar');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar el día laborable' })).toHaveTextContent('Falla inesperada');
    expect(count(calls, '/api/calendar/workdays?')).toBe(2);
    await close('No se pudo eliminar el día laborable');

    empty = true;
    await userEvent.click(screen.getByRole('tab', { name: 'Días festivos' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Días laborables' }));
    expect(await screen.findByText('Sin días laborables especiales')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Agregar día laborable' })[1]).toHaveAttribute('href', '/company/calendar/workdays/new');
  });
});
