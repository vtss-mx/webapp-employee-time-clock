import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { renderWithProviders } from '../../test/render';
import type { AttendanceEvent, WorkSession } from '../../types';
import { BreaksEditor } from './BreaksEditor';
import { EventTimeline } from './EventTimeline';
import { workSession } from './employee/testData';
import { businessClock, clockLabel, emptyValues, manualFacts, manualLabels, sessionValues, validateManual } from './manualSession';
import { MinutesBadge } from './MinutesBadge';
import { breaksUsed } from './sessionFacts';
import { SessionSummary } from './SessionSummary';
import { SessionTimeline } from './SessionTimeline';

/** Turno de 08:00 a 16:00 (hora del Centro, UTC−6): entró 08:25 remoto, un descanso de 35 min y salió 15:40 en Planta Norte. */
const closed: WorkSession = {
  id: 31,
  work_date: '2026-10-02',
  shift_name: 'Matutino',
  scheduled_start: '2026-10-02T14:00:00Z',
  scheduled_end: '2026-10-02T22:00:00Z',
  check_out_deadline: '2026-10-02T23:00:00Z',
  status: 'CLOSED',
  check_in_at: '2026-10-02T14:25:00Z',
  check_in_mode: 'REMOTE',
  check_in_site: null,
  check_out_at: '2026-10-02T21:40:00Z',
  check_out_mode: 'ON_SITE',
  check_out_site: 'Planta Norte',
  late_minutes: 25,
  early_leave_minutes: 20,
  break_minutes: 35,
  worked_minutes: 400,
  breaks_allowed: 2,
  break_minutes_allowed: 30,
  breaks: [{ started_at: '2026-10-02T18:00:00Z', ended_at: '2026-10-02T18:35:00Z', minutes: 35, exceeded_minutes: 5 }],
};
const open: WorkSession = { ...closed, status: 'OPEN', check_out_at: null, check_out_mode: null, check_out_site: null, early_leave_minutes: 0, worked_minutes: null };

/** Las horas de en-US llevan un espacio angosto antes de AM/PM: se comparan como espacio normal. */
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('Jornada en inglés (en-US): 12 horas y textos del diccionario', () => {
  it('la línea de tiempo: horas de 12 h, descansos, lo programado y lo trabajado', async () => {
    await setLocale('en-US');
    renderWithProviders(<SessionTimeline session={closed} />);
    const list = screen.getByRole('list', { name: 'Workday for the Matutino shift' });
    for (const text of ['8:25 AM', 'Scheduled 8:00 AM · Remoto', 'Break 1', '12:00 PM – 12:35 PM', '35 min of 30 min allowed', '3:40 PM', 'Scheduled 4:00 PM · En sitio · Planta Norte', 'Time worked: 6 h 40 min']) {
      expect(within(list).getByText(text)).toBeInTheDocument();
    }
    // Las insignias dicen qué significan en inglés.
    expect(within(list).getByText('25 min late')).toBeInTheDocument();
    expect(within(list).getByText('Left 20 min early')).toBeInTheDocument();
    expect(within(list).getByText('5 min over break time')).toBeInTheDocument();
  });

  it('un descanso en curso, la salida pendiente y la vencida', async () => {
    await setLocale('en-US');
    const onBreak = { ...open, breaks: [{ started_at: '2026-10-02T18:00:00Z', ended_at: null, minutes: 0, exceeded_minutes: 0 }] };
    const { unmount } = renderWithProviders(<SessionTimeline session={onBreak} />);
    expect(screen.getByText('Since 12:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Can last up to 30 min')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Scheduled 4:00 PM · check-out allowed until 5:00 PM')).toBeInTheDocument();
    unmount();
    renderWithProviders(<SessionTimeline session={{ ...open, status: 'MISSED_CHECKOUT' }} />);
    expect(screen.getByText('Scheduled 4:00 PM · the deadline to check out was 5:00 PM')).toBeInTheDocument();
  });

  it('el resumen: etiquetas, descansos de los permitidos y lo que falta por calcular', async () => {
    await setLocale('en-US');
    const { container, unmount } = renderWithProviders(<SessionSummary session={open} />);
    const facts = within(container.querySelector('dl') as HTMLElement);
    for (const text of ['Schedule', 'Check-in', 'Check-out', 'Breaks', 'Time on break', 'Time worked', '8:00 AM – 4:00 PM', '1 of 2', '30 min each', 'Pending', 'Check-out allowed until 5:00 PM', 'Calculated at check-out']) {
      expect(facts.getByText(text)).toBeInTheDocument();
    }
    unmount();
    const missed = renderWithProviders(<SessionSummary session={{ ...open, status: 'MISSED_CHECKOUT', breaks_allowed: 0, breaks: [] }} />);
    expect(within(missed.container).getByText('The deadline was 5:00 PM')).toBeInTheDocument();
    expect(within(missed.container).getByText('Their shift has no breaks')).toBeInTheDocument();
  });

  it('cambio de idioma en caliente: la jornada abierta se vuelve a dibujar en el idioma nuevo', async () => {
    const { container } = renderWithProviders(<SessionTimeline session={closed} />);
    expect(screen.getByText('Tiempo trabajado: 6 h 40 min')).toBeInTheDocument();
    expect(screen.getByText('08:25')).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    expect(screen.getByText('Time worked: 6 h 40 min')).toBeInTheDocument();
    expect(screen.getByText('8:25 AM')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('Programada');
  });

  it('la evidencia de cada registro en inglés', async () => {
    await setLocale('en-US');
    const event: AttendanceEvent = {
      action: 'CHECK_IN',
      mode: 'ON_SITE',
      site: 'Planta Norte',
      occurred_at: '2026-10-05T13:55:00Z',
      latitude: 29.1,
      longitude: -110.9,
      accuracy_m: 8,
      distance_m: 1500,
      confidence: 0.98,
      operator: 'rh@empresa.com',
      note: 'Forgot to check in',
    };
    renderWithProviders(<EventTimeline events={[event]} workDate="2026-10-05" />);
    const list = screen.getByRole('list', { name: 'Workday records' });
    expect(within(list).getByText('1.5 km from Planta Norte')).toBeInTheDocument();
    expect(within(list).getByText('±8 m')).toHaveAttribute('title', 'Location accuracy reported by the device');
    expect(within(list).getByText(/^Face /)).toHaveAttribute('title', 'Identity verification confidence');
    expect(within(list).getByText('rh@empresa.com')).toHaveAttribute('title', 'Recorded by');
    expect(within(list).getByText('Reason: Forgot to check in')).toHaveAttribute('title', 'Company reason');
    expect(within(list).getByRole('link', { name: 'View on map' })).toHaveAttribute('href', 'https://www.google.com/maps?q=29.1,-110.9');
  });

  it('lo registrado por la empresa y el editor de descansos', async () => {
    await setLocale('en-US');
    const { unmount } = renderWithProviders(<SessionTimeline session={workSession({ edited_at: '2026-10-05T17:20:00Z', edit_reason: 'Olvidó checar' })} />);
    expect(document.querySelector('.att-edited')).toHaveTextContent('Reason: Olvidó checar');
    unmount();
    renderWithProviders(<BreaksEditor value={[{ start: '12:00', end: '' }]} max={2} markMissing onChange={() => undefined} />);
    expect(screen.getByText('Break 1')).toBeInTheDocument();
    expect(screen.getByText('Their shift allows 2 breaks')).toBeInTheDocument();
    expect(screen.getByText('Enter the time')).toBeInTheDocument();
    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove break 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add break' })).toBeEnabled();
  });

  it('insignias y conteos de descansos', async () => {
    await setLocale('en-US');
    renderWithProviders(<MinutesBadge kind="late" minutes={25} />);
    expect(screen.getByText('+25 min')).toBeInTheDocument();
    expect(screen.getByText('25 min late')).toBeInTheDocument();
    expect(breaksUsed(closed)).toBe('1/2 breaks');
    expect(breaksUsed({ breaks: [], breaks_allowed: 0 })).toBe('No breaks');
  });
});

describe('Registro manual en inglés: valores de máquina y textos del idioma', () => {
  const filled = { ...emptyValues('2026-10-02'), check_in: '08:05', check_out: '16:00', breaks: [{ start: '12:00', end: '12:30' }], reason: 'Olvidó checar' };

  it('lo que se captura sigue en "HH:MM" (24 h); lo que se confirma, con las horas del idioma', async () => {
    await setLocale('en-US');
    // El formulario recibe la hora de máquina aunque se muestre en 12 h.
    expect(businessClock('2026-10-05T13:55:00Z')).toBe('07:55');
    expect(businessClock('2026-10-05T22:00:00Z')).toBe('16:00');
    expect(sessionValues(workSession()).check_in).toBe('07:55');
    const facts = manualFacts(filled);
    expect({ check_in: plain(facts.check_in), check_out: plain(facts.check_out), breaks: plain(facts.breaks) }).toEqual({ check_in: '8:05 AM', check_out: '4:00 PM', breaks: '12:00 PM – 12:30 PM' });
    expect(manualFacts({ ...filled, stillWorking: true, breaks: [] })).toMatchObject({ check_out: 'Still working', breaks: 'No breaks' });
    expect(manualLabels()).toEqual({ check_in: 'Check-in', check_out: 'Check-out', breaks: 'Breaks' });
  });

  it('una hora incompleta se muestra tal cual', () => {
    expect(clockLabel('')).toBe('');
    expect(clockLabel('7')).toBe('7');
    expect(clockLabel('07:30')).toBe('07:30');
  });

  it('las validaciones en inglés', async () => {
    await setLocale('en-US');
    expect(validateManual(emptyValues(''), { today: '2026-10-05', withDate: true })).toMatchObject({
      work_date: 'Choose the day they worked',
      check_in: 'Enter the check-in time',
      check_out: 'Enter the check-out time or select “Still working”',
      reason: 'Explain why (at least 5 characters)',
    });
    expect(validateManual({ ...filled, work_date: '2026-10-06' }, { today: '2026-10-05', withDate: true }).work_date).toBe("It can't be a future day");
    expect(validateManual({ ...filled, breaks: [{ start: '12:00', end: '' }] }, { today: '2026-10-05', withDate: false }).breaks).toBe('Enter the start and end of each break (or remove it)');
  });
});
