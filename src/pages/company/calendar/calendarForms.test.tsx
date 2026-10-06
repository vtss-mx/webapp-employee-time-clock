import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { longDate } from '../../../components/calendar/calendarRules';
import { ABSENCES_CHANGED, last, today, workday } from '../../../components/calendar/testData';
import { ana, beto, pickerServer } from '../../../components/employees/testData';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../../test/http';
import { testCatalogs } from '../../../test/catalogs';
import { renderWithProviders } from '../../../test/render';
import { createCatalogApi } from '../../../utils/catalogs';
import { formatDate } from '../../../utils/format';
import { AbsenceFormPage, absenceErrors } from './AbsenceFormPage';
import { HolidayFormPage, holidayErrors } from './HolidayFormPage';
import { WorkdayFormPage, workdayErrors } from './WorkdayFormPage';

const changes = vi.fn();
beforeEach(() => {
  changes.mockReset();
  window.addEventListener(ABSENCES_CHANGED, changes);
});
afterEach(() => {
  window.removeEventListener(ABSENCES_CHANGED, changes);
  vi.unstubAllGlobals();
});

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderAt(route: string, catalogs = testCatalogs) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/company/calendar" element={<p>Calendario</p>} />
        <Route path="/company/calendar/holidays/new" element={<HolidayFormPage />} />
        <Route path="/company/calendar/absences/new" element={<AbsenceFormPage />} />
        <Route path="/company/calendar/workdays/new" element={<WorkdayFormPage />} />
      </Routes>
      <Where />
    </>,
    { route, catalogs },
  );
}

const display = (iso: string) => iso.split('-').reverse().join('/');
const posted = (calls: MockCall[]) => calls.find((call) => call.init.method === 'POST');
const bodyOf = (call: MockCall | undefined) => JSON.parse(call?.init.body as string) as unknown;
const fieldFail = (status: number, code: string, message: string, field: string) => jsonResponse(envelope(null, { status, code, message, errors: [{ code, message, field, details: null }] }), status);
/** Con errores no se pregunta nada: solo el popup "Revisa los datos" (se cierra). */
const reviewed = async () => {
  const popup = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
  expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
};
const failed = async (name: string) => userEvent.click(within(await screen.findByRole('alertdialog', { name })).getByRole('button', { name: 'Entendido' }));
/** La confirmación abierta (lo que se creará). */
const question = (name: string) => screen.findByRole('dialog', { name });
/** Envía el formulario con su botón y confirma la pregunta con el botón del popup (pueden llamarse igual). */
async function submitAndConfirm(submit: string, title: string, confirm = submit) {
  await userEvent.click(screen.getByRole('button', { name: submit }));
  await userEvent.click(within(await question(title)).getByRole('button', { name: confirm }));
}
/** Cancela la confirmación abierta: no se envía nada y el popup se cierra. */
async function cancelQuestion(title: string, calls: MockCall[]) {
  await userEvent.click(within(await question(title)).getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(posted(calls)).toBeUndefined();
}

describe('Agregar día festivo', () => {
  it('reglas', () => {
    expect(holidayErrors({ holiday_date: '', name: ' a ' })).toEqual({ holiday_date: 'Elige el día festivo', name: 'Escribe el nombre del festivo (al menos 2 letras)' });
    expect(holidayErrors({ holiday_date: '2026-12-12', name: 'Día de la Virgen' })).toEqual({ holiday_date: undefined, name: undefined });
  });

  it('con la fecha elegida en el calendario; marca lo que falta, pregunta, el día ocupado y agrega', async () => {
    let posts = 0;
    const { calls } = mockFetch(() => {
      posts += 1;
      return posts === 1 ? fieldFail(409, 'HOLIDAY_DATE_TAKEN', 'Ya hay un día festivo en esa fecha', 'holiday_date') : apiOk({ id: 9, holiday_date: last, name: 'Aniversario', official: false, created_at: 'x' }, { status: 201 });
    });
    renderAt(`/company/calendar/holidays/new?date=${last}`);
    expect(screen.getByLabelText('Fecha')).toHaveValue(display(last));
    await userEvent.click(screen.getByRole('button', { name: 'Agregar festivo' }));
    await reviewed();
    expect(screen.getByText('Escribe el nombre del festivo (al menos 2 letras)')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nombre'), '  Aniversario ');

    // Pregunta con la fecha y el nombre limpio; cancelar no envía nada y deja el formulario como estaba.
    await userEvent.click(screen.getByRole('button', { name: 'Agregar festivo' }));
    const confirm = await question('¿Agregar Aniversario como día festivo?');
    expect(within(confirm).getByText('Día festivo')).toBeInTheDocument();
    expect(confirm).toHaveTextContent('Es un día de descanso para toda la empresa');
    expect(within(confirm).getByRole('region', { name: 'Detalles' })).toHaveTextContent(`Fecha${longDate(last)}NombreAniversario`);
    await cancelQuestion('¿Agregar Aniversario como día festivo?', calls);
    expect(posts).toBe(0);
    expect(screen.getByLabelText('Nombre')).toHaveValue('  Aniversario ');
    expect(screen.getByLabelText('Fecha')).toHaveValue(display(last));
    expect(screen.getByRole('button', { name: 'Agregar festivo' })).toBeEnabled();
    expect(screen.getByTestId('where')).toHaveTextContent(`/company/calendar/holidays/new?date=${last}`);

    await submitAndConfirm('Agregar festivo', '¿Agregar Aniversario como día festivo?');
    await failed('No se pudo agregar el día festivo');
    expect(screen.getByText('Ya hay un día festivo en esa fecha')).toBeInTheDocument();
    expect(bodyOf(posted(calls))).toEqual({ holiday_date: last, name: 'Aniversario' });
    expect(posted(calls)?.url).toBe('/api/calendar/holidays');

    await submitAndConfirm('Agregar festivo', '¿Agregar Aniversario como día festivo?');
    expect(await screen.findByRole('dialog', { name: 'Día festivo agregado' })).toHaveTextContent(`Aniversario: ${longDate(last)}. Ese día nadie tiene que checar.`);
    // El calendario regresa con el festivo nuevo elegido.
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(`/company/calendar?date=${last}`));
  });

  it('abierto desde un día del calendario, "Cancelar" y el regreso vuelven a ese día; una fecha inválida no se usa', async () => {
    mockFetch();
    const { unmount } = renderAt(`/company/calendar/holidays/new?date=${last}`);
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('href', `/company/calendar?date=${last}`);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByTestId('where')).toHaveTextContent(`/company/calendar?date=${last}`);
    unmount();
    renderAt('/company/calendar/holidays/new?date=2026-02-31');
    expect(screen.getByLabelText('Fecha')).toHaveValue('');
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('href', '/company/calendar');
  });

  it('sin fecha en la URL empieza vacío; Cancelar regresa al calendario', async () => {
    mockFetch();
    renderAt('/company/calendar/holidays/new');
    expect(screen.getByLabelText('Fecha')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar festivo' }));
    await reviewed();
    expect(screen.getByText('Elige el día festivo')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Fecha'), '12122026');
    expect(screen.queryByText('Elige el día festivo')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/company\/calendar$/);
  });
});

describe('Registrar ausencia', () => {
  it('reglas', () => {
    expect(absenceErrors({ type: '', starts_on: '', ends_on: '', note: '' }, 0)).toEqual({
      employee_ids: 'Elige al menos un empleado',
      type: 'Elige el tipo de ausencia',
      starts_on: 'Elige el primer día',
      ends_on: 'Elige el último día',
    });
    expect(absenceErrors({ type: 'VACATION', starts_on: '2026-10-05', ends_on: '2026-10-01', note: '' }, 2).ends_on).toMatch(/anterior a la inicial/);
  });

  it('para varios empleados: tipo, rango con sus días y nota; el resultado por empleado y de vuelta a Ausencias', async () => {
    const result = {
      done: 1,
      unchanged: 0,
      skipped: 1,
      results: [
        { employee: ana, result: 'DONE', code: null, message: null },
        { employee: beto, result: 'SKIPPED', code: 'EMPLOYEE_INACTIVE', message: 'El empleado está inactivo' },
      ],
    };
    const { calls } = pickerServer((call) => (call.init.method === 'POST' ? apiOk(result) : null));
    renderAt('/company/calendar/absences/new');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar ausencia' }));
    await reviewed();
    expect(screen.getByText('Elige al menos un empleado')).toBeInTheDocument();
    expect(screen.getByText('Elige el tipo de ausencia')).toBeInTheDocument();
    expect(screen.getByText('Elige el primer día')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('checkbox', { name: /Ana Ruiz/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Beto Díaz/ }));
    expect(screen.queryByText('Elige al menos un empleado')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^Tipo/ }));
    await userEvent.click(screen.getByRole('option', { name: /Incapacidad/ }));
    expect(screen.getByText('Incapacidad médica (la registra la empresa).')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Primer día'), '05102026');
    await userEvent.type(screen.getByLabelText('Último día'), '01102026');
    expect(screen.getByText('La fecha final no puede ser anterior a la inicial')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Último día'));
    await userEvent.type(screen.getByLabelText('Último día'), '09102026');
    expect(screen.getByText('5 días, ambos incluidos')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Nota/), '  Folio 123 ');

    // Varios: ausencia colectiva, a quiénes (con sus nombres), el tipo, el rango con sus días y la nota.
    await userEvent.click(screen.getByRole('button', { name: 'Registrar ausencia' }));
    const confirm = await question('¿Registrar incapacidad a 2 empleados?');
    expect(within(confirm).getByText('Ausencia colectiva')).toBeInTheDocument();
    expect(within(confirm).getByRole('region', { name: 'Detalles' })).toHaveTextContent(
      `Empleados (2)Ana Ruiz y Beto DíazTipoIncapacidadFechas${formatDate('2026-10-05')} al ${formatDate('2026-10-09')} · 5 díasNotaFolio 123`,
    );
    expect(posted(calls)).toBeUndefined();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Registrar ausencia' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Ausencia registrada con omisiones' });
    expect(popup).toHaveTextContent('Registrada: 1 · No se registró: 1');
    expect(popup).toHaveTextContent('El empleado está inactivo');
    expect(bodyOf(posted(calls))).toEqual({ type: 'SICK_LEAVE', starts_on: '2026-10-05', ends_on: '2026-10-09', note: 'Folio 123', employee_ids: [7, 8] });
    expect(posted(calls)?.url).toBe('/api/calendar/absences');
    expect(changes).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/company/calendar?tab=absences'));
  });

  it('para uno pregunta sin nota (cancelar no envía nada); marca un tipo que el servidor no acepta; Cancelar regresa a Ausencias', async () => {
    const { calls } = pickerServer((call) => (call.init.method === 'POST' ? fieldFail(422, 'DAY_OFF_TYPE_INVALID', 'Elige un tipo de ausencia válido', 'type') : null));
    // Un tipo sin descripción en el catálogo se ofrece solo con su nombre.
    const catalogs = createCatalogApi({ ...testCatalogs, day_off_types: testCatalogs.day_off_types.map((item) => ({ ...item, description: null })) });
    renderAt('/company/calendar/absences/new', catalogs);
    await userEvent.click(await screen.findByRole('checkbox', { name: /Ana Ruiz/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Tipo/ }));
    await userEvent.click(screen.getByRole('option', { name: /Vacaciones/ }));
    await userEvent.type(screen.getByLabelText('Primer día'), '05102026');
    expect(screen.getByText('Ambos días se incluyen.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Último día'), '05102026');
    expect(screen.getByText('1 día, ambos incluidos')).toBeInTheDocument();

    // Una persona: ausencia (no colectiva), su nombre, un solo día y sin la fila de la nota.
    await userEvent.click(screen.getByRole('button', { name: 'Registrar ausencia' }));
    const confirm = await question('¿Registrar vacaciones?');
    expect(within(confirm).getByText('Ausencia')).toBeInTheDocument();
    const details = within(confirm).getByRole('region', { name: 'Detalles' });
    expect(details).toHaveTextContent(`EmpleadoAna RuizTipoVacacionesFechas${formatDate('2026-10-05')} · 1 día`);
    expect(details).not.toHaveTextContent('Nota');
    await cancelQuestion('¿Registrar vacaciones?', calls);
    expect(screen.getByRole('checkbox', { name: /Ana Ruiz/ })).toBeChecked();
    expect(screen.getByLabelText('Primer día')).toHaveValue('05/10/2026');
    expect(screen.getByLabelText('Último día')).toHaveValue('05/10/2026');
    expect(screen.getByRole('button', { name: 'Registrar ausencia' })).toBeEnabled();
    expect(changes).not.toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/company/calendar/absences/new');

    await submitAndConfirm('Registrar ausencia', '¿Registrar vacaciones?');
    await failed('No se pudo registrar la ausencia');
    expect(screen.getByText('Elige un tipo de ausencia válido')).toBeInTheDocument();
    expect(changes).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/company/calendar?tab=absences');
  });

  it('abierta desde un día del calendario: empieza y termina ese día, y regresa a él', async () => {
    pickerServer();
    renderAt(`/company/calendar/absences/new?date=${last}`);
    expect(screen.getByLabelText('Primer día')).toHaveValue(display(last));
    expect(screen.getByLabelText('Último día')).toHaveValue(display(last));
    expect(screen.getByText('1 día, ambos incluidos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('href', `/company/calendar?date=${last}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(screen.getByTestId('where')).toHaveTextContent(`/company/calendar?date=${last}`);
  });
});

describe('Agregar día laborable', () => {
  it('reglas', () => {
    expect(workdayErrors({ employee_id: '', work_date: '', note: '' }, '2026-10-04')).toEqual({ employee_id: 'Elige al empleado', work_date: 'Elige el día que trabaja' });
    expect(workdayErrors({ employee_id: '7', work_date: '2026-10-03', note: '' }, '2026-10-04').work_date).toMatch(/ya pasó/);
    expect(workdayErrors({ employee_id: '7', work_date: '2026-10-04', note: '' }, '2026-10-04')).toEqual({ employee_id: undefined, work_date: undefined });
  });

  it('una persona y un día libre suyo; marca lo que el servidor rechaza y agrega', async () => {
    let posts = 0;
    const { calls } = pickerServer((call) => {
      if (call.init.method !== 'POST') return null;
      posts += 1;
      return posts === 1 ? fieldFail(422, 'WORKDAY_NOT_NEEDED', 'Ese día ya es laborable para Ana Ruiz', 'work_date') : apiOk({ ...workday, work_date: today }, { status: 201 });
    });
    renderAt('/company/calendar/workdays/new');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar día laborable' }));
    await reviewed();
    expect(screen.getByText('Elige al empleado')).toBeInTheDocument();

    const anaBox = await screen.findByRole('checkbox', { name: /Ana Ruiz/ });
    await userEvent.click(anaBox);
    await userEvent.click(screen.getByRole('checkbox', { name: /Beto Díaz/ }));
    expect(anaBox).not.toBeChecked(); // una sola persona
    await userEvent.click(screen.getByRole('checkbox', { name: /Beto Díaz/ }));
    expect(screen.getByText('Elige al empleado')).toBeInTheDocument();
    await userEvent.click(anaBox);
    await userEvent.type(screen.getByLabelText('Día que trabaja'), display(today).replaceAll('/', ''));
    await userEvent.type(screen.getByLabelText(/Nota/), 'Guardia');

    // Pregunta con la persona elegida (su nombre), el día y la nota.
    await userEvent.click(screen.getByRole('button', { name: 'Agregar día laborable' }));
    const confirm = await question('¿Agregar el día laborable?');
    expect(within(confirm).getByText('Día laborable especial')).toBeInTheDocument();
    expect(within(confirm).getByRole('region', { name: 'Detalles' })).toHaveTextContent(`EmpleadoAna RuizDía que trabaja${longDate(today)}NotaGuardia`);
    expect(posted(calls)).toBeUndefined();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Agregar día laborable' }));
    await failed('No se pudo agregar el día laborable');
    expect(screen.getByText('Ese día ya es laborable para Ana Ruiz')).toBeInTheDocument();
    expect(bodyOf(posted(calls))).toEqual({ employee_id: 7, work_date: today, note: 'Guardia' });

    await submitAndConfirm('Agregar día laborable', '¿Agregar el día laborable?');
    expect(await screen.findByRole('dialog', { name: 'Día laborable agregado' })).toHaveTextContent(`Ana Ruiz trabaja el ${longDate(today).toLowerCase()}: ese día sí checa.`);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/company/calendar?tab=workdays'));
  });

  it('sin nota no la pregunta (cancelar no envía nada); un empleado que ya no existe se marca; Cancelar regresa', async () => {
    const { calls } = pickerServer((call) => (call.init.method === 'POST' ? apiFail(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado') : null));
    renderAt('/company/calendar/workdays/new');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Ana Ruiz/ }));
    await userEvent.type(screen.getByLabelText('Día que trabaja'), display(last).replaceAll('/', ''));
    // Una nota de puros espacios no se muestra.
    await userEvent.type(screen.getByLabelText(/Nota/), '   ');

    await userEvent.click(screen.getByRole('button', { name: 'Agregar día laborable' }));
    const details = within(await question('¿Agregar el día laborable?')).getByRole('region', { name: 'Detalles' });
    expect(details).toHaveTextContent(`EmpleadoAna RuizDía que trabaja${longDate(last)}`);
    expect(details).not.toHaveTextContent('Nota');
    await cancelQuestion('¿Agregar el día laborable?', calls);
    expect(screen.getByRole('checkbox', { name: /Ana Ruiz/ })).toBeChecked();
    expect(screen.getByLabelText('Día que trabaja')).toHaveValue(display(last));
    expect(screen.getByRole('button', { name: 'Agregar día laborable' })).toBeEnabled();
    expect(screen.getByTestId('where')).toHaveTextContent('/company/calendar/workdays/new');

    await submitAndConfirm('Agregar día laborable', '¿Agregar el día laborable?');
    await failed('No se pudo agregar el día laborable');
    expect(screen.getByText('Empleado no encontrado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/company/calendar?tab=workdays');
  });
});
