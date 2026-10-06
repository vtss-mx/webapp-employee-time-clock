import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ana, beto, page, pickerServer } from '../../../components/employees/testData';
import { businessTomorrow } from '../../../components/shifts/shiftRules';
import { apiFail, apiOk, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { morning, weekend } from '../../../test/shifts';
import type { Shift } from '../../../types';
import { businessToday, formatDate } from '../../../utils/format';
import { BulkAssignPage } from './BulkAssignPage';
import { ShiftFormPage } from './ShiftFormPage';
import { ShiftsPage } from './ShiftsPage';

const ref = (e: typeof ana) => ({ id: e.id, full_name: e.full_name, employee_number: e.employee_number });
const bodyOf = (call: MockCall | undefined) => JSON.parse(call?.init.body as string) as unknown;
/** Filas de "Detalles" de la confirmación, como texto. */
const rows = (dialog: HTMLElement) => within(within(dialog).getByRole('region', { name: 'Detalles' })).getAllByRole('listitem').map((row) => row.textContent);

/** "YYYY-MM-DD" → lo que se escribe en el campo de fecha (dd/mm/aaaa). */
const typed = (iso: string) => iso.split('-').reverse().join('');
/** Ayer en la zona del negocio (una fecha pasada). */
function yesterday() {
  const [year, month, day] = businessToday().split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/** Pide asignar (con el botón que dice a cuántos) y devuelve la confirmación abierta. */
async function askAssign(button: string, title: string) {
  await userEvent.click(await screen.findByRole('button', { name: button }));
  return screen.findByRole('dialog', { name: title });
}

afterEach(() => vi.unstubAllGlobals());

/** Turnos activos, empleados y el alta masiva (ya no se piden sitios: los dice el turno). */
function server(post: (call: MockCall) => Response, shifts: Shift[] | Response = [morning, weekend]) {
  return pickerServer((call) => {
    if (call.url.startsWith('/api/shifts')) return shifts instanceof Response ? shifts : apiOk(page(shifts));
    return call.url.startsWith('/api/shift-assignments/bulk') ? post(call) : null;
  });
}

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/shifts" element={<p>Lista de turnos</p>} />
      <Route path="/company/shifts/assign" element={<BulkAssignPage />} />
    </Routes>,
    { route },
  );
}

describe('Asignar un turno a varios empleados', () => {
  it('con el turno elegido desde su edición: elige a varios, envía y explica a quién no se le asignó', async () => {
    const { calls } = server(() =>
      apiOk({
        done: 1,
        unchanged: 0,
        skipped: 1,
        results: [
          { employee: ref(ana), result: 'DONE', code: null, message: null },
          { employee: ref(beto), result: 'SKIPPED', code: 'EMPLOYEE_INACTIVE', message: 'El empleado está inactivo' },
        ],
      }),
    );
    renderAt('/company/shifts/assign?shift=5');
    expect(await screen.findByText('08:00 – 16:00 · Lun a vie · 1 × 30 min')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Turno Matutino: cuándo y dónde se checa' })).toHaveTextContent('Planta Norte');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Ana Ruiz/ }));
    expect(screen.getByRole('button', { name: 'Asignar a 1 empleado' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar a los 2' }));
    // Se confirma a quiénes (con sus nombres), qué turno, dónde checan (lo dice el turno) y desde cuándo.
    const confirm = await askAssign('Asignar a 2 empleados', '¿Asignar el turno Matutino a 2 empleados?');
    expect(confirm.querySelector('.msg__eyebrow')).toHaveTextContent('Asignar a varios');
    expect(confirm).toHaveTextContent('a los inactivos no se les asigna. El resultado mostrará a quién sí.');
    expect(rows(confirm)).toEqual([
      'Empleados (2)Ana Ruiz y Beto Díaz',
      'Horario08:00 – 16:00 · Lun a vie',
      'Sitios donde checaPlanta Norte',
      'Días remotosNinguno',
      `Aplica desde${formatDate(businessTomorrow())}`,
    ]);
    expect(confirm.querySelector('.confirm-note')).toHaveTextContent('Quien ya tiene turno cambia desde la fecha elegida; su turno actual termina el día anterior.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Asignar turno' }));

    const result = await screen.findByRole('alertdialog', { name: 'Turno asignado con omisiones' });
    expect(result).toHaveTextContent('Asignado: 1 · No se asignó: 1');
    expect(result).toHaveTextContent('El empleado está inactivo');
    await userEvent.click(within(result).getByRole('button', { name: 'Entendido' }));
    expect(await screen.findByText('Lista de turnos')).toBeInTheDocument();
    expect(bodyOf(calls.find((c) => c.init.method === 'POST'))).toEqual({ shift_id: 5, employee_ids: [7, 8], valid_from: businessTomorrow() });
  });

  it('pide empleados y turno antes de enviar; un error del servidor deja corregir y volver a enviar', async () => {
    let posts = 0;
    server(() => {
      posts += 1;
      return posts === 1 ? apiFail(404, 'EMPLOYEE_NOT_FOUND', 'Algunos empleados ya no existen: actualiza la lista') : apiOk({ done: 1, unchanged: 0, skipped: 0, results: [{ employee: ref(ana), result: 'DONE', code: null, message: null }] });
    });
    renderAt('/company/shifts/assign?shift=99');
    const submit = await screen.findByRole('button', { name: 'Asignar turno' });
    await userEvent.click(submit);
    const missing = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(missing).toHaveTextContent('Elige al menos un empleado');
    await userEvent.click(within(missing).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elige al menos un empleado');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Ana Ruiz/ }));
    expect(screen.queryByText('Elige al menos un empleado')).toBeNull();
    const date = screen.getByLabelText(/Aplica desde/);
    await userEvent.clear(date);
    await userEvent.type(date, typed(yesterday()));

    await userEvent.click(screen.getByRole('button', { name: 'Asignar a 1 empleado' }));
    const noShift = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(noShift).toHaveTextContent('Elige el turno'); // ?shift=99 no es un turno activo: no se elige
    expect(noShift).toHaveTextContent('El turno no puede empezar en una fecha pasada.');
    await userEvent.click(within(noShift).getByRole('button', { name: 'Entendido' }));
    await userEvent.clear(date);
    await userEvent.type(date, typed(businessTomorrow()));
    await userEvent.click(screen.getByRole('button', { name: /^Turno/ }));
    await userEvent.click(screen.getByRole('option', { name: /Fin de semana/ }));
    const title = '¿Asignar el turno Fin de semana a 1 empleado?';
    const confirm = await askAssign('Asignar a 1 empleado', title);
    expect(rows(confirm)).toEqual([
      'EmpleadoAna Ruiz',
      'Horario22:00 – 06:00 (día siguiente) · Sáb y dom',
      'Sitios donde checaNinguno: todos sus días son remotos',
      'Días remotosSáb y dom',
      `Aplica desde${formatDate(businessTomorrow())}`,
    ]);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Asignar turno' }));
    const failed = await screen.findByRole('alertdialog', { name: 'No se pudo asignar el turno' });
    await userEvent.click(within(failed).getByRole('button', { name: 'Entendido' }));
    await userEvent.click(within(await askAssign('Asignar a 1 empleado', title)).getByRole('button', { name: 'Asignar turno' }));
    expect(await screen.findByRole('dialog', { name: 'Turno asignado' })).toHaveTextContent('Asignado: 1');
  });

  it('a muchos: la confirmación nombra a 8 y dice cuántos más (también los elegidos sin nombre conocido); cancelar no envía nada', async () => {
    const people = Array.from({ length: 10 }, (_, i) => ({ ...ana, id: 100 + i, full_name: `Persona ${i + 1}`, employee_number: `EMP-${100 + i}` }));
    // El filtro tiene 2 más que no se han visto en la lista: llegan sin nombre.
    const ids = [...people.map((p) => p.id), 900, 901];
    const { calls } = pickerServer(
      (call) => {
        if (call.url.startsWith('/api/employees/ids')) return apiOk({ ids, total: ids.length, limit: 500 });
        return call.url.startsWith('/api/shifts') ? apiOk(page([morning])) : null;
      },
      { people },
    );
    renderAt('/company/shifts/assign?shift=5');
    await screen.findByRole('checkbox', { name: /Persona 1\b/ });
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar a los 10' }));
    const title = '¿Asignar el turno Matutino a 12 empleados?';
    const confirm = await askAssign('Asignar a 12 empleados', title);
    expect(rows(confirm)[0]).toBe('Empleados (12)Persona 1, Persona 2, Persona 3, Persona 4, Persona 5, Persona 6, Persona 7, Persona 8 y 4 más');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog', { name: title })).toBeNull();
    expect(calls.filter((c) => c.init.method !== 'GET')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Asignar a 12 empleados' })).toBeEnabled(); // la selección sigue igual
    expect(screen.getByRole('checkbox', { name: /Persona 1\b/ })).toBeChecked();
    expect(screen.queryByText('Lista de turnos')).toBeNull();
  });

  it('sin turnos activos no deja enviar; si no carga, ofrece volver a cargar; cancelar regresa', async () => {
    server(() => apiOk(null), []);
    const { unmount } = renderAt('/company/shifts/assign');
    expect(await screen.findByText('Sin turnos activos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Asignar turno' })).toBeDisabled();
    unmount();

    let attempts = 0;
    pickerServer((call) => {
      if (!call.url.startsWith('/api/shifts')) return null;
      attempts += 1;
      return attempts === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada') : apiOk(page([morning]));
    });
    renderAt('/company/shifts/assign');
    await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los turnos' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Lista de turnos')).toBeInTheDocument();
  });
});

describe('Entradas a la asignación masiva', () => {
  it('la lista de turnos la ofrece cuando hay turnos; la edición de un turno activo la abre con ese turno', async () => {
    server(() => apiOk(null));
    const { unmount } = renderWithProviders(<ShiftsPage />);
    expect(await screen.findByRole('link', { name: 'Asignar a varios' })).toHaveAttribute('href', '/company/shifts/assign');
    unmount();

    server(() => apiOk(null), []);
    const empty = renderWithProviders(<ShiftsPage />);
    expect(await screen.findByText('Sin turnos')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Asignar a varios' })).toBeNull();
    empty.unmount();

    pickerServer((call) => {
      if (call.url.startsWith('/api/sites')) return apiOk(page([]));
      return call.url.startsWith('/api/shifts/5') ? apiOk(morning) : null;
    });
    renderWithProviders(
      <Routes>
        <Route path="/company/shifts/:id/edit" element={<ShiftFormPage />} />
      </Routes>,
      { route: '/company/shifts/5/edit' },
    );
    expect(await screen.findByRole('link', { name: 'Asignar este turno a…' })).toHaveAttribute('href', '/company/shifts/assign?shift=5');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Editar turno' })).toBeInTheDocument());
  });
});
