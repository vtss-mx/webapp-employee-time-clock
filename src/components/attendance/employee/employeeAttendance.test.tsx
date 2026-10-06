import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { ApiError } from '../../../services/apiClient';
import { renderWithProviders } from '../../../test/render';
import { addressLine } from '../../../utils/address';
import { LocationError } from '../../../utils/geolocation';
import { attendanceProblem } from './attendanceProblems';
import { AttendanceResultCard } from './AttendanceResultCard';
import { CheckPlaces } from './CheckPlaces';
import { Countdown, Elapsed } from './LiveTime';
import { addMinutes, countdownText, minutesBetween, msUntil, serverOffset } from './serverTime';
import { DayOffCard, dayOffIcon } from './DayOffCard';
import { HolidayList } from './HolidayList';
import { actionResult, attendanceToday, breakWindow, dayOff, holiday, NOW, sampleSite, workSession } from './testData';
import { actionFromSlug, breakWindowText, clockCountdown, clockState, primaryAction, recordLabel, refreshAt } from './todayView';

const apiError = (statusCode: number, code: string, message = 'Mensaje del servidor') => new ApiError({ statusCode, code, message });
const onBreak = workSession({ breaks: [{ started_at: '2026-10-05T18:00:00Z', ended_at: null, minutes: 0, exceeded_minutes: 0 }] });
const next = { work_date: '2026-10-06', start: '2026-10-06T14:00:00Z', end: '2026-10-06T22:00:00Z', opens: '2026-10-06T13:45:00Z', deadline: '2026-10-06T23:00:00Z' };
const nothing = attendanceToday({ shift: null, occurrence: null, actions: [], sites: [], message: 'No tienes un turno asignado: pídeselo a tu empresa.' });

afterEach(() => vi.useRealTimers());

describe('tiempo del servidor', () => {
  it('lo que falta: días, horas, minutos con segundos y segundos (nunca negativo)', () => {
    expect(countdownText((2 * 24 + 3) * 3_600_000)).toBe('2 d 3 h');
    expect(countdownText(24 * 3_600_000)).toBe('1 d');
    expect(countdownText(3 * 3_600_000 + 5 * 60_000 + 30_000)).toBe('3 h 5 min');
    expect(countdownText(3_600_000)).toBe('1 h');
    expect(countdownText(14 * 60_000 + 4_200)).toBe('14 min 05 s');
    expect(countdownText(44_100)).toBe('45 s');
    expect(countdownText(-5_000)).toBe('0 s');
  });

  it('diferencia con el teléfono, minutos completos e instantes', () => {
    expect(serverOffset(NOW, Date.parse(NOW) - 5_000)).toBe(5_000);
    expect(Math.abs(serverOffset(new Date().toISOString()))).toBeLessThan(1_000);
    expect(minutesBetween('2026-10-05T13:55:00Z', '2026-10-05T14:30:59Z')).toBe(35);
    expect(minutesBetween('2026-10-05T14:00:00Z', '2026-10-05T13:00:00Z')).toBe(0);
    expect(addMinutes('2026-10-05T18:00:00Z', 30)).toBe('2026-10-05T18:30:00.000Z');
    expect(msUntil(new Date(Date.now() + 60_000).toISOString(), 0)).toBeGreaterThan(58_000);
  });
});

describe('Countdown y Elapsed (un temporizador propio, con la hora del servidor)', () => {
  it('corre cada segundo aunque el teléfono tenga otra hora y al llegar lo dice y se detiene', () => {
    vi.useFakeTimers({ now: new Date('2026-10-05T10:00:00Z') }); // el reloj del teléfono va 3 h 30 min atrasado
    const offset = serverOffset(NOW);
    render(<Countdown until="2026-10-05T13:30:03Z" offsetMs={offset} label="Podrás checar en" done="Ya puedes checar" />);
    expect(screen.getByText('Podrás checar en')).toBeInTheDocument();
    expect(screen.getByText('3 s')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText('2 s')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByText('Ya puedes checar')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('lo trabajado corre cada minuto y descuenta los descansos; al desmontar no deja temporizadores', () => {
    vi.useFakeTimers({ now: new Date('2026-10-05T10:00:00Z') });
    const view = render(<Elapsed since="2026-10-05T13:00:00Z" offsetMs={serverOffset(NOW)} minusMinutes={10} />);
    expect(view.container).toHaveTextContent('20 min');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(view.container).toHaveTextContent('21 min');
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('presentación de "hoy"', () => {
  it('acción de la ruta y texto del botón', () => {
    expect(actionFromSlug('break-start')).toBe('BREAK_START');
    expect(actionFromSlug('otra')).toBeNull();
    expect(actionFromSlug(undefined)).toBeNull();
    expect(recordLabel('Inicio de descanso')).toBe('Registrar inicio de descanso');
  });

  it('en qué va la jornada (estados del tablero)', () => {
    expect(clockState(attendanceToday({ session: workSession() }))).toBe('WORKING');
    expect(clockState(attendanceToday({ session: onBreak }))).toBe('ON_BREAK');
    expect(clockState(attendanceToday({ session: workSession({ status: 'CLOSED' }) }))).toBe('DONE');
    expect(clockState(attendanceToday({ session: workSession({ status: 'MISSED_CHECKOUT' }) }))).toBe('MISSED_CHECKOUT');
    expect(clockState(attendanceToday())).toBe('SCHEDULED');
    expect(clockState(attendanceToday({ now: '2026-10-05T14:05:00Z' }))).toBe('MISSING');
    expect(clockState(attendanceToday({ occurrence: null, next_occurrence: next }))).toBe('SCHEDULED');
    expect(clockState(nothing)).toBeNull();
    // Festivo o ausencia aprobada: día libre (no es una falta), aun sin turno que mostrar.
    expect(clockState(attendanceToday({ occurrence: null, next_occurrence: next, actions: [], day_off: dayOff() }))).toBe('DAY_OFF');
    expect(clockState({ ...nothing, day_off: dayOff() })).toBe('DAY_OFF');
  });

  it('la ventana del descanso, solo con lo que respondió el servidor', () => {
    const working = (overrides: Parameters<typeof attendanceToday>[0] = {}) =>
      attendanceToday({ occurrence: null, session: workSession(), break_window: breakWindow(), actions: ['CHECK_OUT'], now: '2026-10-05T16:00:00Z', ...overrides });
    expect(breakWindowText(working({ actions: ['BREAK_START', 'CHECK_OUT'] }))).toBe('Descanso disponible hasta las 16:00 · 30 min');
    expect(breakWindowText(working({ now: '2026-10-05T13:56:00Z' }))).toBe('Podrás tomar tu descanso desde las 08:00');
    expect(breakWindowText(working({ now: '2026-10-05T22:10:00Z' }))).toBe('Tu horario terminó: ya no puedes iniciar un descanso');
    expect(breakWindowText(working({ break_window: breakWindow({ remaining: 0 }) }))).toBe('Ya tomaste tus descansos');
    // Dentro del horario sin poder iniciarlo (lo decide el servidor), en descanso, sin descansos, sin ventana o sin jornada abierta: nada.
    expect(breakWindowText(working())).toBeNull();
    expect(breakWindowText(working({ session: onBreak }))).toBeNull();
    expect(breakWindowText(working({ session: workSession({ breaks_allowed: 0 }), break_window: breakWindow({ remaining: 0 }) }))).toBeNull();
    expect(breakWindowText(working({ break_window: null }))).toBeNull();
    expect(breakWindowText(working({ session: workSession({ status: 'CLOSED' }) }))).toBeNull();
    expect(breakWindowText(attendanceToday())).toBeNull();
  });

  it('lo que corre: fin del descanso, salida, inicio del turno o la siguiente ventana', () => {
    expect(clockCountdown(attendanceToday({ session: onBreak }))).toMatchObject({ until: '2026-10-05T18:30:00.000Z', label: 'Tu descanso termina en' });
    expect(clockCountdown(attendanceToday({ session: workSession() }))).toMatchObject({ until: '2026-10-05T22:00:00Z', label: 'Tu salida es en' });
    expect(clockCountdown(attendanceToday({ session: workSession({ status: 'CLOSED' }) }))).toBeNull();
    expect(clockCountdown(attendanceToday())).toMatchObject({ until: '2026-10-05T14:00:00Z', label: 'Tu turno empieza en' });
    expect(clockCountdown(attendanceToday({ now: '2026-10-05T14:05:00Z' }))).toBeNull();
    expect(clockCountdown(attendanceToday({ occurrence: null, next_occurrence: next }))).toMatchObject({ until: next.opens, done: 'Ya puedes checar' });
    expect(clockCountdown(nothing)).toBeNull();
  });

  it('cuándo volver a preguntar al servidor', () => {
    // Jornada abierta: se abre la ventana del descanso (inicio programado), se cierra (salida programada) y vence la salida.
    expect(refreshAt(attendanceToday({ session: workSession() }))).toBe('2026-10-05T14:00:00Z');
    expect(refreshAt(attendanceToday({ now: '2026-10-05T15:00:00Z', session: workSession() }))).toBe('2026-10-05T22:00:00Z');
    expect(refreshAt(attendanceToday({ now: '2026-10-05T22:30:00Z', session: workSession() }))).toBe('2026-10-05T23:00:00Z');
    expect(refreshAt(attendanceToday({ now: '2026-10-05T23:30:00Z', session: workSession() }))).toBeNull();
    expect(refreshAt(attendanceToday())).toBe('2026-10-05T14:00:00Z');
    // Sin entrada: se cierra la entrada al terminar el turno y después vence la salida.
    expect(refreshAt(attendanceToday({ now: '2026-10-05T14:05:00Z' }))).toBe('2026-10-05T22:00:00Z');
    expect(refreshAt(attendanceToday({ now: '2026-10-05T22:05:00Z', session: workSession({ status: 'CLOSED' }) }))).toBe('2026-10-05T23:00:00Z');
    expect(refreshAt(attendanceToday({ occurrence: null, next_occurrence: next }))).toBe(next.opens);
    expect(refreshAt(nothing)).toBeNull();
  });

  it('el botón destacado: la salida cuando ya es hora; si no, la primera acción', () => {
    const working = { session: workSession(), actions: ['BREAK_START', 'CHECK_OUT'] as const };
    expect(primaryAction(attendanceToday({ ...working, actions: [...working.actions] }))).toBe('BREAK_START');
    expect(primaryAction(attendanceToday({ ...working, actions: [...working.actions], now: '2026-10-05T22:05:00Z' }))).toBe('CHECK_OUT');
    expect(primaryAction(attendanceToday())).toBe('CHECK_IN');
    expect(primaryAction(attendanceToday({ session: workSession({ status: 'CLOSED' }), actions: [] }))).toBeUndefined();
  });
});

describe('problemas al registrar', () => {
  it('ubicación del teléfono: el permiso bloqueado se explica para la asistencia; los demás, con su texto', () => {
    const denied = attendanceProblem(new LocationError('denied'));
    expect(denied?.kind).toBe('retry');
    expect(denied?.message()).toMatchObject({ title: 'Permite el acceso a tu ubicación', text: expect.stringContaining('asistencia') as string });
    expect(denied?.message().details?.at(-1)).toBe('Regresa aquí y toca «Reintentar».');
    expect(denied?.message().actions?.map((a) => a.id)).toEqual(['close', 'retry']);
    expect(attendanceProblem(new LocationError('timeout'))?.message().title).toBe('La ubicación tardó demasiado');
  });

  it('respuestas del servidor: fuera del sitio, imprecisa, no creíble y estado que cambió', () => {
    expect(attendanceProblem(apiError(403, 'LOCATION_OUT_OF_SITE'))?.message()).toMatchObject({ title: 'Estás fuera de tu sitio de trabajo', text: 'Mensaje del servidor' });
    expect(attendanceProblem(apiError(422, 'LOCATION_INACCURATE'))?.message().title).toBe('Tu ubicación no es precisa');
    expect(attendanceProblem(apiError(403, 'IMPOSSIBLE_TRAVEL'))?.message().title).toBe('Tu ubicación no es creíble');
    const stale = attendanceProblem(apiError(409, 'ATTENDANCE_ACTION_NOT_ALLOWED'));
    expect(stale?.kind).toBe('stale');
    expect(stale?.message()).toMatchObject({ title: 'Tu asistencia cambió', footnote: 'Revisa lo que puedes registrar ahora.' });
    expect(attendanceProblem(apiError(409, 'FACE_LOCKED'))).toBeNull();
    expect(attendanceProblem(new Error('otro'))).toBeNull();
  });
});

describe('CheckPlaces (dónde puede checar hoy)', () => {
  it('remoto y los sitios de su turno con su domicilio y su radio', () => {
    renderWithProviders(<CheckPlaces today={attendanceToday({ remote_allowed: true, sites: [sampleSite, { ...sampleSite, id: 3, name: 'Bodega', radius_m: 1500 }] })} />);
    expect(screen.getByText('Puedes checar de forma remota')).toBeInTheDocument();
    expect(screen.getByText('Planta Norte')).toBeInTheDocument();
    expect(screen.getAllByText(addressLine(sampleSite.address))).toHaveLength(2);
    expect(screen.getByText('Dentro de 150 m de su ubicación')).toBeInTheDocument();
    expect(screen.getByText('Dentro de 1.5 km de su ubicación')).toBeInTheDocument();
  });

  it('sin remoto ni sitios: explica que su empresa debe revisar su turno', () => {
    renderWithProviders(<CheckPlaces today={attendanceToday({ sites: [] })} />);
    expect(screen.getByText('Sin sitio de trabajo activo')).toBeInTheDocument();
    expect(screen.getByText(/Pide a tu empresa que revise tu turno/)).toBeInTheDocument();
  });
});

describe('AttendanceResultCard (lo registrado)', () => {
  it('entrada: hora, modalidad y sitio, retardo, horario y "Listo"', async () => {
    const onDone = vi.fn();
    renderWithProviders(<AttendanceResultCard result={actionResult({ session: workSession({ late_minutes: 12 }) })} onDone={onDone} />);
    expect(screen.getByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(screen.getByText('07:55')).toBeInTheDocument();
    expect(screen.getByText(/· En sitio · Planta Norte/)).toBeInTheDocument();
    expect(screen.getByText('12 min de retardo')).toBeInTheDocument();
    expect(screen.getByText('08:00 – 16:00')).toBeInTheDocument();
    expect(screen.getByText('Salida a más tardar').nextSibling).toHaveTextContent('17:00');
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('inicio y fin de descanso: su hora, cuántos lleva y cuánto duró (con lo excedido)', () => {
    const started = { started_at: '2026-10-05T18:00:00Z', ended_at: null, minutes: 0, exceeded_minutes: 0 };
    const view = renderWithProviders(<AttendanceResultCard result={actionResult({ action: 'BREAK_START', message: 'Descanso iniciado', session: workSession({ breaks: [started] }) })} onDone={vi.fn()} />);
    expect(screen.getByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
    view.unmount();
    const ended = { ...started, ended_at: '2026-10-05T18:35:00Z', minutes: 35, exceeded_minutes: 5 };
    renderWithProviders(<AttendanceResultCard result={actionResult({ action: 'BREAK_END', message: 'Descanso terminado', session: workSession({ breaks: [ended] }) })} onDone={vi.fn()} />);
    expect(screen.getByText('12:35')).toBeInTheDocument();
    expect(screen.getByText('35 min')).toBeInTheDocument();
    expect(screen.getByText('5 min de descanso de más')).toBeInTheDocument();
  });

  it('salida: remota, tiempo trabajado y en descanso; sin jornada, la hora de la verificación', () => {
    const closed = workSession({ status: 'CLOSED', check_out_at: '2026-10-05T22:02:00Z', check_out_mode: 'REMOTE', worked_minutes: 470, break_minutes: 30 });
    const view = renderWithProviders(<AttendanceResultCard result={actionResult({ action: 'CHECK_OUT', message: 'Salida registrada', session: closed })} onDone={vi.fn()} />);
    expect(screen.getByText('16:02')).toBeInTheDocument();
    expect(screen.getByText(/· Remoto/)).toBeInTheDocument();
    expect(screen.getByText('7 h 50 min')).toBeInTheDocument();
    view.unmount();
    renderWithProviders(<AttendanceResultCard result={actionResult({ session: null })} onDone={vi.fn()} />);
    expect(screen.getByText('07:55')).toBeInTheDocument();
    expect(document.querySelector('.result-card__details')).toBeNull();
  });
});

describe('DayOffCard (día libre del empleado)', () => {
  it('hoy de vacaciones: ícono, nombre, rango y cuántos días; con el mensaje del servidor', () => {
    renderWithProviders(<DayOffCard dayOff={dayOff()} today="2026-10-05" message="Estás de vacaciones del 05/10/2026 al 18/10/2026." />);
    const card = screen.getByRole('region', { name: 'Día libre' });
    expect(card).toHaveTextContent('Hoy no trabajas');
    expect(card).toHaveTextContent('Vacaciones');
    expect(card).toHaveTextContent('5 oct 2026 al 18 oct 2026 · 14 días');
    expect(card).toHaveTextContent('Estás de vacaciones del 05/10/2026 al 18/10/2026.');
    expect(card).not.toHaveClass('day-off--holiday');
  });

  it('un festivo que viene: "Tus próximos días libres", un solo día y sin mensaje', () => {
    renderWithProviders(<DayOffCard dayOff={dayOff({ kind: 'HOLIDAY', name: 'Navidad', work_date: '2026-12-25', starts_on: '2026-12-25', ends_on: '2026-12-25' })} today="2026-12-24" />);
    const card = screen.getByRole('region', { name: 'Día libre' });
    expect(card).toHaveTextContent('Tus próximos días libres');
    expect(card).toHaveTextContent('Día festivo: Navidad');
    expect(card).toHaveTextContent(/25 dic 2026$/);
    expect(card).toHaveClass('day-off--holiday');
    expect(card.querySelector('.day-off__message')).toBeNull();
  });

  it('ícono por motivo (uno nuevo del catálogo usa el de día libre)', () => {
    expect(dayOffIcon('SICK_LEAVE')).not.toBe(dayOffIcon('OTHER'));
    expect(dayOffIcon('NEW_KIND')).toBe(dayOffIcon('OTHER'));
  });
});

describe('Mi asistencia en inglés (en-US)', () => {
  it('lo que corre, la ventana del descanso y el texto de los botones', async () => {
    await setLocale('en-US');
    expect(countdownText((2 * 24 + 3) * 3_600_000)).toBe('2 d 3 h');
    expect(countdownText(14 * 60_000 + 4_200)).toBe('14 min 05 s');
    expect(recordLabel('Break start')).toBe('Record break start');
    const working = attendanceToday({ occurrence: null, session: workSession(), break_window: breakWindow(), actions: ['BREAK_START', 'CHECK_OUT'], now: '2026-10-05T16:00:00Z' });
    expect(breakWindowText(working)).toBe('Break available until 4:00 PM · 30 min');
    expect(breakWindowText({ ...working, actions: ['CHECK_OUT'], now: '2026-10-05T13:56:00Z' })).toBe('You can take your break from 8:00 AM');
    expect(clockCountdown(attendanceToday())).toMatchObject({ label: 'Your shift starts in', done: 'Your shift has started' });
  });

  it('un problema al registrar se arma al dibujarse: el mismo popup sigue al idioma activo', async () => {
    const outside = attendanceProblem(apiError(403, 'LOCATION_OUT_OF_SITE'));
    expect(outside?.message().title).toBe('Estás fuera de tu sitio de trabajo');
    await setLocale('en-US');
    expect(outside?.message()).toMatchObject({ eyebrow: 'Location', title: "You're outside your work site", text: 'Mensaje del servidor' });
    expect(outside?.message().details?.at(-1)).toBe('Tap “Retry.”');
    expect(outside?.message().actions?.map((a) => a.label)).toEqual(['Cancel', 'Retry']);
    expect(new LocationError('timeout').message).toBe("Turn on precise location on the device and try again.");
  });

  it('el registro hecho, el día libre y los festivos en inglés (fechas y horas del idioma)', async () => {
    await setLocale('en-US');
    const view = renderWithProviders(<AttendanceResultCard result={actionResult({ session: workSession() })} onDone={vi.fn()} />);
    expect(screen.getByText('7:55 AM').parentElement).toHaveTextContent(/^at 7:55 AM/);
    expect(screen.getByText('Check out by').nextSibling).toHaveTextContent('5:00 PM');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    view.unmount();
    renderWithProviders(<DayOffCard dayOff={dayOff({ kind: 'HOLIDAY', name: 'Christmas', work_date: '2026-12-25', starts_on: '2026-12-25', ends_on: '2026-12-25' })} today="2026-12-25" />);
    const card = screen.getByRole('region', { name: 'Day off' });
    expect(card).toHaveTextContent("You're off today");
    expect(card).toHaveTextContent('Holiday: Christmas');
    renderWithProviders(<HolidayList holidays={[holiday(), holiday({ id: 4, official: false })]} loading={false} />);
    expect(screen.getAllByText('Dec')).toHaveLength(2);
    expect(screen.getAllByText('Friday')).toHaveLength(2);
    expect(screen.getByText('Official')).toBeInTheDocument();
    expect(screen.getByText("Your company's")).toBeInTheDocument();
  });
});
