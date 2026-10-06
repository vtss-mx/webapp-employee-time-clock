import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { morning, page, plant } from '../../../test/shifts';
import type { Employee, Shift } from '../../../types';
import { businessToday, formatDate } from '../../../utils/format';
import { AssignShiftPage } from './AssignShiftPage';
import { ShiftFormPage } from './ShiftFormPage';
import { ShiftsPage } from './ShiftsPage';

/**
 * Turnos en inglés (en-US): el listado, el formulario (alta y edición con "antes → después"), su estado
 * y la confirmación de asignar. También el cambio de idioma en caliente con un popup abierto.
 */

const night: Shift = { ...morning, id: 6, name: 'Nocturno', start_time: '22:00:00', end_time: '06:00:00', overnight: true, weekdays: [0, 1, 2, 3, 4, 5, 6], remote_weekdays: [6], breaks_count: 0, break_minutes: 0, late_tolerance_minutes: 0, active: false, employees: 1200 };
const employee = { id: 7, full_name: 'Ana Ruiz', first_name: 'Ana', last_name: 'Ruiz', employee_number: 'EMP-7', active: true } as Employee;

/** Filas de una sección de la confirmación ("Changes", "Details"), como texto. */
const rows = (dialog: HTMLElement, region: string) => within(within(dialog).getByRole('region', { name: region })).getAllByRole('listitem').map((row) => row.textContent);
const field = (label: RegExp | string) => screen.getByLabelText(label);
const isWrite = (call: MockCall) => call.init.method !== 'GET';

/** El formulario pide los sitios activos (la Planta Norte); lo demás lo responde `answer`. */
function renderForm(route: string, answer: (call: MockCall) => Response) {
  const server = mockFetch((call) => (call.url.startsWith('/api/sites') ? apiOk(page([plant], 1, 50)) : answer(call)));
  renderWithProviders(
    <Routes>
      <Route path="/company/shifts" element={<p>Shift list</p>} />
      <Route path="/company/shifts/new" element={<ShiftFormPage />} />
      <Route path="/company/shifts/:id/edit" element={<ShiftFormPage />} />
    </Routes>,
    { route },
  );
  return server;
}

afterEach(() => vi.unstubAllGlobals());

describe('Turnos en inglés (en-US)', () => {
  it('listado: horario de 12 h, días, dónde se checa, descansos y tolerancia; si no carga lo dice y se reintenta', async () => {
    await setLocale('en-US');
    let attempts = 0;
    mockFetch(() => (++attempts === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Unexpected failure') : apiOk(page([morning, night]))));
    renderWithProviders(<ShiftsPage />, { route: '/company/shifts' });
    const failed = await screen.findByRole('alertdialog', { name: "Couldn't load the shifts" });
    await userEvent.click(within(failed).getByRole('button', { name: 'Retry' }));

    const day = (await screen.findByText('Matutino')).closest('tr') as HTMLElement;
    expect(screen.getByText('2 shifts · when and where to check in')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Shift', 'Days', 'Where to check in', 'Breaks', 'Tolerance', 'Employees today', 'Status']);
    expect(within(day).getByText('8:00 AM – 4:00 PM · 8 h')).toBeInTheDocument();
    expect(within(day).getByText('Mon–Fri')).toBeInTheDocument();
    expect(within(day).getByText('On site only: Planta Norte')).toBeInTheDocument();
    expect(within(day).getByText('10 min late tolerance')).toBeInTheDocument();
    const late = screen.getByText('Nocturno').closest('tr') as HTMLElement;
    expect(within(late).getByText('10:00 PM – 6:00 AM (next day) · 8 h')).toBeInTheDocument();
    expect(within(late).getByText('Every day')).toBeInTheDocument();
    expect(within(late).getByText('Remote: Sun · On site: Planta Norte')).toBeInTheDocument();
    expect(within(late).getByText('No breaks')).toBeInTheDocument();
    expect(within(late).getByText('No late tolerance')).toBeInTheDocument();
    expect(within(late).getByText('1,200')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change requests' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Assign to multiple' })).toBeInTheDocument();
  });

  it('alta: campos, días y vista previa en inglés; lo que falta se resume y el popup abierto cambia de idioma', async () => {
    await setLocale('en-US');
    const { calls } = renderForm('/company/shifts/new', () => apiOk(morning));
    expect(screen.getByRole('heading', { name: 'New shift' })).toBeInTheDocument();
    expect(field('Start time')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon–Fri' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mon–Sat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByText('Can check in from 7:45 AM; after 8:10 AM it counts as late.')).toBeInTheDocument();
    expect(field(/Early check-in/)).toHaveAccessibleDescription('Minutes before the start time when check-in opens (0 to 240)');
    await userEvent.click(screen.getByRole('button', { name: /Breaks per workday/ }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['No breaks', '1 break', '2 breaks', '3 breaks', '4 breaks', '5 breaks', '6 breaks']);
    await userEvent.click(screen.getByRole('option', { name: '2 breaks' }));
    expect(screen.getByRole('button', { name: '45 min' })).toBeInTheDocument();
    expect(field(/Minutes per break/)).toHaveAccessibleDescription('Between 5 and 240 min');

    await userEvent.click(await screen.findByRole('button', { name: 'Create shift' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Check the details' });
    expect(popup).toHaveTextContent('Enter a name (e.g., "Morning")');
    expect(popup).toHaveTextContent("Choose at least one site for non-remote days");
    await act(() => setLocale('es-MX'));
    const spanish = screen.getByRole('alertdialog', { name: 'Revisa los datos' });
    expect(spanish).toHaveTextContent('Escribe un nombre (p. ej. "Matutino")');
    expect(spanish).toHaveTextContent('Elige al menos un sitio para los días no remotos');
    expect(calls.filter(isWrite)).toHaveLength(0);
  });

  it('edición: confirma "antes → después" en inglés y la confirmación abierta cambia de idioma', async () => {
    await setLocale('en-US');
    const { calls } = renderForm('/company/shifts/5/edit', () => apiOk(morning));
    expect(await screen.findByText("Affects 8 assigned employees. Changes apply to workdays that haven't started.")).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: /Planta Norte/ })).toBeChecked();
    await userEvent.clear(field(/Shift name/));
    await userEvent.type(field(/Shift name/), 'Vespertino');
    await userEvent.click(within(screen.getByRole('group', { name: 'Remote check-in days' })).getByRole('button', { name: 'Monday' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const confirm = await screen.findByRole('dialog', { name: 'Save changes to shift Matutino?' });
    expect(confirm).toHaveTextContent('Affects 8 assigned employees: from now on they check in with this schedule and at these places.');
    expect(rows(confirm, 'Changes')).toEqual(['Shift nameBefore: MatutinoAfter: Vespertino', 'Remote check-in daysBefore: NoneAfter: Mon']);
    await act(() => setLocale('es-MX'));
    const spanish = screen.getByRole('dialog', { name: '¿Guardar los cambios del turno Matutino?' });
    expect(rows(spanish, 'Cambios')).toEqual(['Nombre del turnoAntes: MatutinoDespués: Vespertino', 'Días en que se checa remotoAntes: NingunoDespués: Lun']);
    await act(() => setLocale('en-US'));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Save changes to shift Matutino?' })).getByRole('button', { name: 'Cancel' }));
    expect(calls.filter(isWrite)).toHaveLength(0);
  });

  it('estado: desactivar se confirma en inglés; su error y su aviso también', async () => {
    await setLocale('en-US');
    let patches = 0;
    renderForm('/company/shifts/5/edit', (call) => {
      if (call.init.method !== 'PATCH') return apiOk(morning);
      patches += 1;
      return patches === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Unexpected failure') : apiOk({ ...morning, active: false });
    });
    const section = (await screen.findByRole('heading', { name: /Shift status/ })).closest('section') as HTMLElement;
    const deactivate = async () => {
      await userEvent.click(within(section).getByRole('button', { name: 'Deactivate' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate shift Matutino?' });
      expect(rows(dialog, 'Changes')).toEqual(['StatusBefore: ActiveAfter: Inactive']);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    };
    await deactivate();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: "Couldn't deactivate Matutino" })).getByRole('button', { name: 'Got it' }));
    await deactivate();
    expect(await screen.findByRole('dialog', { name: 'Shift deactivated' })).toHaveTextContent("It can't be assigned");
  });

  it('asignar: la confirmación dice el turno, su horario, dónde checa y desde cuándo, y el aviso al terminar', async () => {
    await setLocale('en-US');
    const today = businessToday();
    const { calls } = mockFetch((call) => {
      if (call.url.startsWith('/api/shifts')) return apiOk(page([morning]));
      if (call.url.includes('/shift-assignments')) return call.init.method === 'POST' ? apiOk({ id: 20, shift: morning, valid_from: today, valid_to: null, state: 'CURRENT', created_at: today }, { status: 201 }) : apiOk(page([]));
      return apiOk(employee);
    });
    renderWithProviders(
      <Routes>
        <Route path="/company/shifts/employees/:id" element={<p>Employee shifts</p>} />
        <Route path="/company/shifts/employees/:id/assign" element={<AssignShiftPage />} />
      </Routes>,
      { route: '/company/shifts/employees/7/assign' },
    );
    expect(await screen.findByText('Their first shift can start today.')).toBeInTheDocument();
    expect(screen.getByText('Only active shifts are listed.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Shift/ }));
    expect(screen.getByRole('option', { name: /Matutino/ })).toHaveTextContent('8:00 AM – 4:00 PM · Mon–Fri · On site only: Planta Norte');
    await userEvent.click(screen.getByRole('option', { name: /Matutino/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Assign shift' }));

    const confirm = await screen.findByRole('dialog', { name: 'Assign shift Matutino to Ana Ruiz?' });
    expect(rows(confirm, 'Details')).toEqual(['Schedule8:00 AM – 4:00 PM · Mon–Fri', 'Check-in sitesPlanta Norte', 'Remote daysNone', `Effective from${formatDate(today)}`]);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Assign shift' }));
    expect(await screen.findByRole('dialog', { name: 'Shift assigned' })).toHaveTextContent(`Ana Ruiz will have the Matutino shift from ${formatDate(today)}.`);
    expect(calls.some((c) => c.init.method === 'POST')).toBe(true);
  });
});
