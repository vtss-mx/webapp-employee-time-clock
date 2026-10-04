import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, jsonResponse, envelope, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { Shift } from '../../../types';
import { ShiftFormPage } from './ShiftFormPage';
import { ShiftsPage } from './ShiftsPage';

const morning: Shift = {
  id: 5,
  name: 'Matutino',
  start_time: '08:00:00',
  end_time: '16:00:00',
  overnight: false,
  weekdays: [0, 1, 2, 3, 4],
  breaks_count: 1,
  break_minutes: 30,
  early_check_in_minutes: 15,
  late_tolerance_minutes: 10,
  early_check_out_minutes: 0,
  late_check_out_minutes: 60,
  duration_minutes: 480,
  active: true,
  employees: 8,
  created_at: '2026-10-01T00:00:00Z',
};
const night: Shift = { ...morning, id: 6, name: 'Nocturno', start_time: '22:00:00', end_time: '06:00:00', overnight: true, weekdays: [0, 1, 2, 3, 4, 5, 6], breaks_count: 0, break_minutes: 0, late_tolerance_minutes: 0, active: false, employees: 0 };

const page = (items: Shift[]) => ({ items, total: items.length, page: 1, size: 10 });
const bodyOf = (call: MockCall | undefined) => JSON.parse(call?.init.body as string) as unknown;
const field = (label: RegExp | string) => screen.getByLabelText(label);
const setTime = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
/** Filas de una sección de la confirmación ("Se creará", "Cambios"), como texto. */
const rows = (dialog: HTMLElement, region: string) => within(within(dialog).getByRole('region', { name: region })).getAllByRole('listitem').map((row) => row.textContent);
/** Petición que crea, cambia o borra (POST, PUT, PATCH o DELETE). */
const isWrite = (call: MockCall) => call.init.method !== 'GET';

function renderForm(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/shifts" element={<p>Lista de turnos</p>} />
      <Route path="/company/shifts/new" element={<ShiftFormPage />} />
      <Route path="/company/shifts/:id/edit" element={<ShiftFormPage />} />
    </Routes>,
    { route },
  );
}

/** Cierra el popup (de error o de aviso) con ese título. */
async function closeAlert(title: string) {
  await userEvent.click(within(await screen.findByRole('alertdialog', { name: title })).getByRole('button', { name: 'Entendido' }));
}

afterEach(() => vi.unstubAllGlobals());

describe('Turnos: listado', () => {
  it('muestra horario, días, descansos, tolerancia, empleados y estado; busca, filtra y abre la edición', async () => {
    const { calls } = mockFetch(apiOk(page([morning, night])));
    renderWithProviders(
      <Routes>
        <Route path="/company/shifts" element={<ShiftsPage />} />
        <Route path="/company/shifts/:id/edit" element={<p>Editar turno</p>} />
      </Routes>,
      { route: '/company/shifts' },
    );
    const day = (await screen.findByText('Matutino')).closest('tr') as HTMLElement;
    expect(within(day).getByText('08:00 – 16:00 · 8 h')).toBeInTheDocument();
    expect(within(day).getByText('Lun a vie')).toBeInTheDocument();
    expect(within(day).getByText('1 × 30 min')).toBeInTheDocument();
    expect(within(day).getByText('10 min de retardo')).toBeInTheDocument();
    expect(within(day).getByText('8')).toBeInTheDocument();
    expect(within(day).getByText('Activo')).toBeInTheDocument();
    const late = screen.getByText('Nocturno').closest('tr') as HTMLElement;
    expect(within(late).getByText('22:00 – 06:00 (día siguiente) · 8 h')).toBeInTheDocument();
    expect(within(late).getByText('Todos los días')).toBeInTheDocument();
    expect(within(late).getByText('Sin descansos')).toBeInTheDocument();
    expect(within(late).getByText('Sin retardo tolerado')).toBeInTheDocument();
    expect(within(late).getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Solicitudes de cambio' })).toHaveAttribute('href', '/company/shifts/requests');
    expect(screen.getByRole('link', { name: 'Nuevo turno' })).toHaveAttribute('href', '/company/shifts/new');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar turnos' }), 'noc');
    await waitFor(() => expect(calls.at(-1)?.url).toContain('search=noc'));
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Activos' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain('active=true'));
    await userEvent.click(screen.getByText('Matutino'));
    expect(await screen.findByText('Editar turno')).toBeInTheDocument();
  });

  it('sin turnos invita a crear el primero; con búsqueda dice que nada coincide; uno se cuenta en singular', async () => {
    mockFetch(apiOk(page([])));
    const { unmount } = renderWithProviders(<ShiftsPage />, { route: '/company/shifts' });
    expect(await screen.findByText('Aún no hay turnos')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nuevo turno' })).toHaveLength(2);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar turnos' }), 'zzz');
    expect(await screen.findByText('Ningún turno coincide con la búsqueda')).toBeInTheDocument();
    unmount();
    mockFetch(apiOk(page([morning])));
    renderWithProviders(<ShiftsPage />, { route: '/company/shifts' });
    expect(await screen.findByText(/1 turno ·/)).toBeInTheDocument();
  });
});

describe('Turnos: alta', () => {
  it('horario nocturno, días, descansos y tolerancias con el resumen en vivo; crea y vuelve al listado', async () => {
    const { calls } = mockFetch(apiOk(night, { status: 201 }));
    renderForm('/company/shifts/new');
    // Valores iniciales: 08:00 a 16:00, de lunes a viernes, tolerancias por omisión.
    expect(field('Hora de entrada')).toHaveValue('08:00');
    expect(screen.getByRole('button', { name: 'Lun a vie' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Puede checar desde las 07:45; después de las 08:10 es retardo.')).toBeInTheDocument();
    expect(screen.getByText('Desde las 16:00 y a más tardar a las 17:00.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Minutos de cada descanso/)).toBeNull();

    await userEvent.type(field(/Nombre del turno/), 'Nocturno');
    setTime('Hora de entrada', '22:00');
    setTime('Hora de salida', '06:00');
    expect(screen.getByText('Termina al día siguiente')).toBeInTheDocument();
    expect(screen.getByText('Desde las 06:00 del día siguiente y a más tardar a las 07:00 del día siguiente.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(screen.getByText('Todos los días')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'domingo' }));
    expect(screen.getByRole('button', { name: 'Lun a sáb' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: /Descansos por jornada/ }));
    await userEvent.click(screen.getByRole('option', { name: '2 descansos' }));
    expect(field(/Minutos de cada descanso/)).toHaveValue('30');
    await userEvent.clear(field(/Minutos de cada descanso/));
    await userEvent.type(field(/Minutos de cada descanso/), '20');
    expect(screen.getByText('2 × 20 min')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '15 min' }));
    expect(screen.getByText('2 × 15 min')).toBeInTheDocument();
    await userEvent.clear(field(/Retardo tolerado/));
    await userEvent.type(field(/Retardo tolerado/), '5');
    expect(screen.getByText('Puede checar desde las 21:45; después de las 22:05 es retardo.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear turno' }));

    // Antes de enviar se confirma lo que se creará (con los minutos de cada descanso: sí tiene descansos).
    const confirm = await screen.findByRole('dialog', { name: '¿Crear el turno Nocturno?' });
    expect(rows(confirm, 'Se creará')).toEqual([
      'Nombre del turnoNocturno',
      'Hora de entrada22:00',
      'Hora de salida06:00',
      'Días en que empiezaLun a sáb',
      'Descansos por jornada2',
      'Minutos de cada descanso15 min',
      'Checar antes de la entrada15 min',
      'Retardo tolerado5 min',
      'Salida anticipada tolerada0 min',
      'Límite para checar la salida1 h',
    ]);
    expect(calls).toHaveLength(0);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Crear turno' }));

    expect(await screen.findByText('Lista de turnos')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Turno creado' })).toHaveTextContent('Nocturno ya se puede asignar a tus empleados.');
    expect(bodyOf(calls.find((c) => c.init.method === 'POST'))).toEqual({
      name: 'Nocturno',
      start_time: '22:00',
      end_time: '06:00',
      weekdays: [0, 1, 2, 3, 4, 5],
      breaks_count: 2,
      break_minutes: 15,
      early_check_in_minutes: 15,
      late_tolerance_minutes: 5,
      early_check_out_minutes: 0,
      late_check_out_minutes: 60,
    });
  });

  it('sin descansos la confirmación lo dice (sin sus minutos); cancelar no envía nada y deja el formulario', async () => {
    const { calls } = mockFetch(apiOk(morning, { status: 201 }));
    renderForm('/company/shifts/new');
    await userEvent.type(field(/Nombre del turno/), 'Matutino');
    await userEvent.click(screen.getByRole('button', { name: 'Crear turno' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Crear el turno Matutino?' });
    expect(confirm).toHaveTextContent('Se podrá asignar a tus empleados y elegir en las solicitudes de cambio.');
    expect(rows(confirm, 'Se creará')).toEqual([
      'Nombre del turnoMatutino',
      'Hora de entrada08:00',
      'Hora de salida16:00',
      'Días en que empiezaLun a vie',
      'Descansos por jornadaSin descansos',
      'Checar antes de la entrada15 min',
      'Retardo tolerado10 min',
      'Salida anticipada tolerada0 min',
      'Límite para checar la salida1 h',
    ]);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog', { name: '¿Crear el turno Matutino?' })).toBeNull();
    expect(calls.filter(isWrite)).toHaveLength(0);
    expect(field(/Nombre del turno/)).toHaveValue('Matutino');
    expect(screen.getByRole('button', { name: 'Crear turno' })).toBeEnabled(); // no quedó "Guardando…"
    expect(screen.queryByText('Lista de turnos')).toBeNull();
  });

  it('lo que falta o no cabe no se envía: se explica en un popup y en cada campo', async () => {
    const { calls } = mockFetch(apiOk(morning));
    renderForm('/company/shifts/new');
    for (const day of ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']) await userEvent.click(screen.getByRole('button', { name: day })); // sin días
    expect(screen.getByText('Elige al menos un día en que empieza el turno')).toBeInTheDocument();
    setTime('Hora de salida', '08:00');
    expect(screen.getByText(/Elige la hora de entrada y la de salida/)).toBeInTheDocument();
    await userEvent.click(field('Hora de entrada'));
    await userEvent.click(field('Hora de salida'));
    await userEvent.tab(); // al salir de los campos se ve su error
    expect(screen.getByText('La salida debe ser distinta de la entrada')).toBeInTheDocument();
    await userEvent.clear(field(/Límite para checar la salida/));
    await userEvent.click(screen.getByRole('button', { name: 'Crear turno' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa la información' });
    expect(popup).toHaveTextContent('Escribe un nombre');
    expect(popup).toHaveTextContent('La salida debe ser distinta de la entrada');
    expect(popup).toHaveTextContent('Elige al menos un día en que empieza el turno');
    expect(popup).toHaveTextContent('Indica los minutos');
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Indica los minutos')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('horas y minutos con controles propios: horas sugeridas en el selector y botones − / + con su paso', async () => {
    mockFetch(apiOk(morning));
    renderForm('/company/shifts/new');
    expect(field('Hora de entrada')).toHaveAttribute('type', 'text'); // nunca el control de hora del sistema
    await userEvent.click(within(field('Hora de entrada').closest('.field') as HTMLElement).getByRole('button', { name: 'Elegir hora' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Horas sugeridas' })).getByRole('button', { name: '07:00' }));
    expect(field('Hora de entrada')).toHaveValue('07:00');
    expect(screen.getByText('Puede checar desde las 06:45; después de las 07:10 es retardo.')).toBeInTheDocument();
    const late = field(/Retardo tolerado/);
    expect(late).toHaveAttribute('role', 'spinbutton');
    await userEvent.click(within(late.closest('.field') as HTMLElement).getByRole('button', { name: 'Aumentar' }));
    expect(late).toHaveValue('15'); // de 5 en 5
    expect(screen.getByText('Puede checar desde las 06:45; después de las 07:15 es retardo.')).toBeInTheDocument();
  });

  it('cancelar regresa al listado', async () => {
    mockFetch(apiOk(morning));
    renderForm('/company/shifts/new');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Lista de turnos')).toBeInTheDocument();
  });
});

describe('Turnos: edición', () => {
  it('aplica a las jornadas por empezar; sin cambios no envía; confirma "antes → después"; nombre ocupado en su campo, regla del backend en popup y guardado', async () => {
    let puts = 0;
    const { calls } = mockFetch((call) => {
      if (call.init.method !== 'PUT') return apiOk(morning);
      puts += 1;
      if (puts === 1) return apiFail(409, 'SHIFT_NAME_TAKEN', 'Ya existe un turno con ese nombre');
      if (puts === 2) return jsonResponse(envelope(null, { status: 422, code: 'VALIDATION_ERROR', message: 'Los descansos no pueden sumar todo el turno', errors: [{ code: 'VALUE_ERROR', message: 'Los descansos no pueden sumar todo el turno', field: null, details: null }] }), 422);
      return apiOk({ ...morning, name: 'Matutino A' });
    });
    renderForm('/company/shifts/5/edit');
    expect(await screen.findByText(/Los cambios aplican a las jornadas que aún no empiezan/)).toBeInTheDocument();
    expect(field(/Nombre del turno/)).toHaveValue('Matutino');
    expect(field('Hora de salida')).toHaveValue('16:00');
    expect(field(/Minutos de cada descanso/)).toHaveValue('30');

    // Sin cambios: se avisa y no se envía nada.
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('dialog', { name: 'Sin cambios' })).toHaveTextContent('No modificaste ningún dato');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(calls.filter(isWrite)).toHaveLength(0);

    // Con cambios se confirma solo lo que cambia; cancelar no envía y deja lo escrito.
    await userEvent.clear(field(/Nombre del turno/));
    await userEvent.type(field(/Nombre del turno/), 'Vespertino');
    setTime('Hora de salida', '17:00');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Guardar los cambios del turno Matutino?' });
    expect(within(confirm).getByRole('region', { name: 'Cambios' })).toHaveTextContent('2 cambios');
    expect(rows(confirm, 'Cambios')).toEqual(['Nombre del turnoAntes: MatutinoDespués: Vespertino', 'Hora de salidaAntes: 16:00Después: 17:00']);
    expect(confirm.querySelector('.confirm-note')).toHaveTextContent('Los cambios aplican a las jornadas que aún no empiezan: lo ya registrado conserva su horario.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(calls.filter(isWrite)).toHaveLength(0);
    expect(field(/Nombre del turno/)).toHaveValue('Vespertino');
    expect(field('Hora de salida')).toHaveValue('17:00');

    const save = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Guardar los cambios del turno Matutino?' })).getByRole('button', { name: 'Guardar cambios' }));
    };
    await save();
    await closeAlert('No se pudo guardar el turno');
    expect(screen.getByText('Ya existe un turno con ese nombre')).toBeInTheDocument();
    await userEvent.clear(field(/Nombre del turno/));
    await userEvent.type(field(/Nombre del turno/), 'Matutino A');
    expect(screen.queryByText('Ya existe un turno con ese nombre')).toBeNull();
    await save();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo guardar el turno' })).toHaveTextContent('Los descansos no pueden sumar todo el turno');
    await closeAlert('No se pudo guardar el turno');
    await save();
    expect(await screen.findByText('Lista de turnos')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Turno actualizado' })).toHaveTextContent('Matutino A quedó actualizado: aplica a las jornadas que aún no empiezan.');
    expect(calls.filter((c) => c.init.method === 'PUT').map((c) => c.url)).toEqual(['/api/shifts/5', '/api/shifts/5', '/api/shifts/5']);
  });

  it('un turno sin descansos propone 30 min al agregarlos; activar y eliminar se confirman (o se cancelan); eliminar en uso y eliminar', async () => {
    let deletes = 0;
    const { calls } = mockFetch((call) => {
      if (call.init.method === 'PATCH') return apiOk({ ...night, active: true });
      if (call.init.method !== 'DELETE') return apiOk(night);
      deletes += 1;
      return deletes === 1 ? apiFail(409, 'SHIFT_IN_USE', 'El turno está asignado a empleados: desactívalo en lugar de eliminarlo') : apiOk(null);
    });
    renderForm('/company/shifts/6/edit');
    expect(await screen.findByText('Termina al día siguiente')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Minutos de cada descanso/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Descansos por jornada/ }));
    await userEvent.click(screen.getByRole('option', { name: '1 descanso' }));
    expect(field(/Minutos de cada descanso/)).toHaveValue('30');

    const section = screen.getByRole('heading', { name: /Estado del turno/ }).closest('section') as HTMLElement;
    expect(section).toHaveTextContent('quienes lo tienen no tienen jornadas programadas');

    // Activar también se confirma (qué cambia y qué implica); cancelar no envía nada y deja el estado.
    await userEvent.click(within(section).getByRole('button', { name: 'Activar' }));
    const activate = await screen.findByRole('dialog', { name: '¿Activar el turno Nocturno?' });
    expect(activate).toHaveTextContent('Se puede asignar a tus empleados y elegir en las solicitudes de cambio.');
    expect(rows(activate, 'Cambios')).toEqual(['EstadoAntes: InactivoDespués: Activo']);
    await userEvent.click(within(activate).getByRole('button', { name: 'Cancelar' }));
    expect(calls.filter(isWrite)).toHaveLength(0);
    expect(within(section).getByText('Inactivo')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Activar' })).toBeEnabled();

    await userEvent.click(within(section).getByRole('button', { name: 'Activar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Activar el turno Nocturno?' })).getByRole('button', { name: 'Activar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'El turno quedó activo' })).getByRole('button', { name: 'Entendido' }));
    expect(within(section).getByText('Activo')).toBeInTheDocument();

    // Eliminar: el foco empieza en "Cancelar" (un Enter de más no borra nada); cancelar no envía nada.
    await userEvent.click(within(section).getByRole('button', { name: 'Eliminar' }));
    const remove = await screen.findByRole('alertdialog', { name: '¿Eliminar el turno Nocturno?' });
    expect(remove).toHaveTextContent('Solo se puede eliminar un turno que nadie tiene ni tuvo asignado');
    expect(remove.querySelector('.confirm-note')).toHaveTextContent('Esta acción no se puede deshacer.');
    await waitFor(() => expect(within(remove).getByRole('button', { name: 'Cancelar' })).toHaveFocus());
    await userEvent.click(within(remove).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Editar turno' })).toBeInTheDocument();

    const confirmRemove = async () => {
      await userEvent.click(within(section).getByRole('button', { name: 'Eliminar' }));
      await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Eliminar el turno Nocturno?' })).getByRole('button', { name: 'Eliminar' }));
    };
    await confirmRemove();
    await closeAlert('El turno está en uso: desactívalo');
    await confirmRemove();
    expect(await screen.findByText('Lista de turnos')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'DELETE').map((c) => c.url)).toEqual(['/api/shifts/6', '/api/shifts/6']);
  });

  it('si no carga ofrece volver a cargar', async () => {
    let attempts = 0;
    mockFetch(() => {
      attempts += 1;
      return attempts === 1 ? apiFail(404, 'SHIFT_NOT_FOUND', 'Turno no encontrado') : apiOk(morning);
    });
    renderForm('/company/shifts/5/edit');
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar el turno' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByLabelText(/Nombre del turno/)).toHaveValue('Matutino');
  });
});
