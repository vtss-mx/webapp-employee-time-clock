import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { renderWithProviders } from '../../test/render';
import type { AttendanceEvent, BreakTimes, WorkSession } from '../../types';
import { formatDateTime } from '../../utils/format';
import { BreaksEditor, type BreaksEditorProps } from './BreaksEditor';
import { EventTimeline } from './EventTimeline';
import { emptyValues, manualFacts, manualLabels, manualServerErrors, manualTimes, newSessionPath, sessionValues, validateManual, type ManualValues } from './manualSession';
import { SessionSummary } from './SessionSummary';
import { SessionTimeline } from './SessionTimeline';
import { workSession } from './employee/testData';

const EDITED_AT = '2026-10-05T17:20:00Z';
/** La empresa registró la jornada (entrada y salida sin rostro ni ubicación) con su motivo. */
const edited: WorkSession = workSession({
  status: 'CLOSED',
  check_in_mode: 'COMPANY',
  check_in_site: null,
  check_out_at: '2026-10-05T22:00:00Z',
  check_out_mode: 'COMPANY',
  worked_minutes: 485,
  edited_at: EDITED_AT,
  edit_reason: 'Olvidó checar',
});

describe('Registrado por la empresa (solo lectura, igual para la empresa y el empleado)', () => {
  it('la línea de tiempo lleva la insignia, cuándo y el motivo; sin edición no se dibuja', () => {
    const { unmount } = renderWithProviders(<SessionTimeline session={edited} />);
    const note = document.querySelector('.att-edited') as HTMLElement;
    expect(within(note).getByText('Registrado por la empresa')).toBeInTheDocument();
    expect(within(note).getByText(formatDateTime(EDITED_AT))).toBeInTheDocument();
    expect(note).toHaveTextContent('Motivo: Olvidó checar');
    // La modalidad de la entrada también lo dice.
    expect(screen.getByText('Programada 08:00 · Registrado por la empresa')).toBeInTheDocument();
    unmount();

    renderWithProviders(<SessionTimeline session={{ ...edited, edit_reason: null }} />);
    expect(document.querySelector('.att-edited__reason')).toBeNull();
    expect(document.querySelector('.att-edited')).toHaveTextContent('Registrado por la empresa');
  });

  it('sin edición (la registró el empleado) no hay insignia', () => {
    renderWithProviders(<SessionTimeline session={workSession()} />);
    expect(document.querySelector('.att-edited')).toBeNull();
  });

  it('el resumen suma el motivo y cuándo; sin motivo, un guion', () => {
    const { unmount } = renderWithProviders(<SessionSummary session={edited} />);
    const fact = document.querySelector('.att-summary__company') as HTMLElement;
    expect(within(fact).getByText('Registrado por la empresa')).toBeInTheDocument();
    expect(within(fact).getByText('Olvidó checar')).toBeInTheDocument();
    expect(within(fact).getByText(formatDateTime(EDITED_AT))).toBeInTheDocument();
    unmount();

    const { unmount: again } = renderWithProviders(<SessionSummary session={{ ...edited, edit_reason: null }} />);
    expect(within(document.querySelector('.att-summary__company') as HTMLElement).getByText('—')).toBeInTheDocument();
    again();
    renderWithProviders(<SessionSummary session={workSession()} />);
    expect(document.querySelector('.att-summary__company')).toBeNull();
  });

  it('en la bitácora, un registro de la empresa lleva su insignia y su motivo (sin la ficha de modalidad)', () => {
    const base: AttendanceEvent = {
      action: 'CHECK_IN',
      mode: 'COMPANY',
      site: null,
      occurred_at: '2026-10-05T13:55:00Z',
      latitude: null,
      longitude: null,
      accuracy_m: null,
      distance_m: null,
      confidence: null,
      operator: 'rh@empresa.com',
      note: 'Olvidó checar',
    };
    renderWithProviders(<EventTimeline events={[base, { ...base, action: 'CHECK_OUT', mode: 'ON_SITE', site: 'Planta Norte', note: null, occurred_at: '2026-10-05T22:00:00Z' }]} workDate="2026-10-05" />);
    const [first, second] = screen.getAllByRole('listitem').filter((item) => item.classList.contains('att-step'));
    expect(within(first).getByText('Registrado por la empresa')).toHaveClass('badge');
    expect(within(first).getByText('Motivo: Olvidó checar')).toBeInTheDocument();
    expect(within(first).getByText('rh@empresa.com')).toBeInTheDocument();
    expect(within(second).queryByText('Registrado por la empresa')).toBeNull();
    expect(within(second).getByText('En sitio')).toBeInTheDocument();
    expect(within(second).queryByText(/Motivo/)).toBeNull();
  });
});

/** El editor con su propio estado, como lo usa un formulario. */
function Editor({ initial = [], onChange = vi.fn(), ...props }: Partial<BreaksEditorProps> & { initial?: BreakTimes[] }) {
  const [value, setValue] = useState(initial);
  return (
    <BreaksEditor
      max={2}
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('BreaksEditor (descansos que tomó)', () => {
  it('sin descansos lo dice; agrega hasta el máximo, escribe sus horas y quita uno', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Editor onChange={onChange} />);
    expect(screen.getByText('Sin descansos: agrega los que tomó.')).toBeInTheDocument();
    expect(screen.getByText('Su turno permite 2 descansos')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Agregar descanso' }));
    await userEvent.click(screen.getByRole('button', { name: 'Agregar descanso' }));
    expect(screen.getByRole('button', { name: 'Agregar descanso' })).toBeDisabled();
    expect(screen.getByText('Descanso 1')).toBeInTheDocument();
    expect(screen.getByText('Descanso 2')).toBeInTheDocument();

    const [start1, start2] = screen.getAllByLabelText('Inicio');
    const [end1] = screen.getAllByLabelText('Fin');
    await userEvent.type(start1, '1200');
    await userEvent.type(end1, '1230');
    await userEvent.type(start2, '1500');
    expect(onChange).toHaveBeenLastCalledWith([
      { start: '12:00', end: '12:30' },
      { start: '15:00', end: '' },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Quitar el descanso 1' }));
    expect(onChange).toHaveBeenLastCalledWith([{ start: '15:00', end: '' }]);
    // La fila que queda muestra las horas del que se conservó.
    expect(screen.getByLabelText('Inicio')).toHaveValue('15:00');
    expect(screen.getByRole('button', { name: 'Agregar descanso' })).toBeEnabled();
  });

  it('marca las horas que faltan, muestra el error del grupo y respeta "deshabilitado"', () => {
    renderWithProviders(<Editor initial={[{ start: '12:00', end: '' }]} markMissing disabled error="Los descansos no se pueden encimar" />);
    expect(screen.getByText('Indica la hora')).toBeInTheDocument();
    expect(screen.getByText('Los descansos no se pueden encimar')).toBeInTheDocument();
    expect(screen.queryByText('Su turno permite 2 descansos')).toBeNull();
    expect(screen.getByRole('button', { name: 'Agregar descanso' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quitar el descanso 1' })).toBeDisabled();
    expect(screen.getByLabelText('Inicio')).toBeDisabled();
  });

  it('textos personalizables, ayuda propia y el límite según el turno', () => {
    const { unmount } = renderWithProviders(<Editor max={0} />);
    expect(screen.getByText('Su turno no tiene descansos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar descanso' })).toBeDisabled();
    unmount();
    const view = renderWithProviders(<Editor max={1} />);
    expect(screen.getByText('Su turno permite 1 descanso')).toBeInTheDocument();
    view.unmount();
    renderWithProviders(<Editor max={3} hint="Hasta 3" labels={{ legend: 'Pausas', add: 'Otra pausa', empty: 'Ninguna pausa' }} />);
    expect(screen.getByText('Pausas')).toBeInTheDocument();
    expect(screen.getByText('Hasta 3')).toBeInTheDocument();
    expect(screen.getByText('Ninguna pausa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otra pausa' })).toBeEnabled();
  });
});

const TODAY = '2026-10-05';
const filled = (overrides: Partial<ManualValues> = {}): ManualValues => ({
  ...emptyValues('2026-10-02'),
  check_in: '08:05',
  check_out: '16:00',
  breaks: [{ start: '12:00', end: '12:30' }],
  reason: '  Olvidó   checar  ',
  ...overrides,
});
const fieldError = (code: string, field: string | null, message = 'Mensaje del servidor', status = 422) =>
  new ApiError({ statusCode: status, code, message, errors: [{ code, message, field, details: null }] });

describe('Reglas de la jornada que registra o corrige la empresa', () => {
  it('el enlace para registrar a un empleado en un día', () => {
    expect(newSessionPath(7, '2026-10-02')).toBe('/company/attendance/sessions/new?employee=7&date=2026-10-02');
  });

  it('valida el día (solo al registrar), las horas, los descansos completos y el motivo', () => {
    expect(validateManual(filled(), { today: TODAY, withDate: true })).toEqual({});
    expect(Object.values(validateManual(filled(), { today: TODAY, withDate: true })).filter(Boolean)).toHaveLength(0);
    const empty = validateManual(emptyValues(''), { today: TODAY, withDate: true });
    expect(empty).toMatchObject({
      work_date: 'Elige el día que trabajó',
      check_in: 'Indica la hora de entrada',
      check_out: 'Indica la hora de salida o marca «Aún no sale»',
      reason: 'Explica el motivo (al menos 5 caracteres)',
    });
    expect(empty.breaks).toBeUndefined();
    expect(validateManual(filled({ work_date: '31/02/2026' }), { today: TODAY, withDate: true }).work_date).toBe('Escribe una fecha válida (dd/mm/aaaa)');
    expect(validateManual(filled({ work_date: '2026-10-06' }), { today: TODAY, withDate: true }).work_date).toBe('No puede ser un día futuro');
    expect(validateManual(filled({ work_date: '' }), { today: TODAY, withDate: false }).work_date).toBeUndefined();
    expect(validateManual(filled({ check_out: '', stillWorking: true }), { today: TODAY, withDate: false }).check_out).toBeUndefined();
    expect(validateManual(filled({ breaks: [{ start: '12:00', end: '' }] }), { today: TODAY, withDate: false }).breaks).toBe('Indica el inicio y el fin de cada descanso (o quítalo)');
    expect(validateManual(filled({ breaks: [{ start: '', end: '12:30' }] }), { today: TODAY, withDate: false }).breaks).toBeDefined();
  });

  it('lo que se envía: sin salida si aún no sale y el motivo sin espacios de más', () => {
    expect(manualTimes(filled())).toEqual({ check_in: '08:05', check_out: '16:00', breaks: [{ start: '12:00', end: '12:30' }], reason: 'Olvidó checar' });
    expect(manualTimes(filled({ stillWorking: true })).check_out).toBeNull();
  });

  it('lo que se confirma: entrada, salida (o "Aún no sale") y descansos (o "Sin descansos"), con sus etiquetas', () => {
    expect(manualFacts(filled())).toEqual({ check_in: '08:05', check_out: '16:00', breaks: '12:00 – 12:30' });
    expect(manualFacts(filled({ breaks: [{ start: '12:00', end: '12:30' }, { start: '16:00', end: '16:15' }] })).breaks).toBe('12:00 – 12:30, 16:00 – 16:15');
    // Aún no sale: lo dice aunque quedara una hora escrita; sin descansos, también lo dice.
    expect(manualFacts(filled({ stillWorking: true, breaks: [] }))).toEqual({ check_in: '08:05', check_out: 'Aún no sale', breaks: 'Sin descansos' });
    expect(manualLabels()).toEqual({ check_in: 'Entrada', check_out: 'Salida', breaks: 'Descansos' });
  });

  it('al corregir: lo registrado en la hora del negocio; abierta sigue sin salida y un descanso en curso queda sin fin', () => {
    const open = workSession({ breaks: [{ started_at: '2026-10-05T18:00:00Z', ended_at: '2026-10-05T18:30:00Z', minutes: 30, exceeded_minutes: 0 }, { started_at: '2026-10-05T20:00:00Z', ended_at: null, minutes: 0, exceeded_minutes: 0 }] });
    expect(sessionValues(open)).toEqual({
      work_date: '2026-10-05',
      check_in: '07:55',
      check_out: '',
      stillWorking: true,
      breaks: [
        { start: '12:00', end: '12:30' },
        { start: '14:00', end: '' },
      ],
      reason: '',
    });
    expect(sessionValues(workSession({ status: 'MISSED_CHECKOUT' })).stillWorking).toBe(false);
    expect(sessionValues(edited)).toMatchObject({ check_out: '16:00', stillWorking: false });
  });

  it('errores del servidor en su campo: horas, descansos (también los de cada descanso) y el día', () => {
    expect(manualServerErrors(fieldError('CHECK_IN_OUTSIDE_SHIFT', 'check_in', 'La entrada se registra entre las 07:45 y las 16:00'))).toEqual({
      check_in: 'La entrada se registra entre las 07:45 y las 16:00',
    });
    const nested = new ApiError({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Datos no válidos',
      errors: [
        { code: 'TIME_PARSING', message: 'Hora inválida', field: 'breaks.0.end', details: null },
        { code: 'TIME_PARSING', message: 'Otra hora inválida', field: 'breaks.1.start', details: null },
        { code: 'EXTRA', message: 'Campo desconocido', field: 'other', details: null },
      ],
    });
    expect(manualServerErrors(nested)).toEqual({ breaks: 'Hora inválida' });
    expect(manualServerErrors(fieldError('NO_SHIFT_THAT_DAY', 'work_date', 'Ana no tiene turno el 02/10/2026'))).toEqual({ work_date: 'Ana no tiene turno el 02/10/2026' });
    expect(manualServerErrors(fieldError('DAY_OFF', null, 'Navidad: es día libre', 409))).toEqual({ work_date: 'Navidad: es día libre' });
    expect(manualServerErrors(fieldError('ATTENDANCE_SESSION_EXISTS', null, 'Ya tiene su jornada', 409))).toEqual({ work_date: 'Ya tiene su jornada' });
    expect(manualServerErrors(fieldError('ATTENDANCE_SESSION_OPEN', null, 'Tiene otra jornada abierta', 409))).toEqual({});
    expect(manualServerErrors(new Error('red'))).toEqual({});
  });
});
