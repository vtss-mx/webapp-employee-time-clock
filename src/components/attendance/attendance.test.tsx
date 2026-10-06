import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import type { WorkSession } from '../../types';
import { MinutesBadge } from './MinutesBadge';
import { formatDistance } from '../../utils/numbers';
import { breaksUsed, clockOn, exceededMinutes, mapsUrl, scheduleRange } from './sessionFacts';
import { SessionSummary } from './SessionSummary';
import { SessionTimeline } from './SessionTimeline';

/** Turno de 08:00 a 16:00 (hora del Centro, UTC-6): entró 08:25 remoto y tomó un descanso de 35 min. */
const session: WorkSession = {
  id: 31,
  work_date: '2026-10-02',
  shift_name: 'Matutino',
  scheduled_start: '2026-10-02T14:00:00Z',
  scheduled_end: '2026-10-02T22:00:00Z',
  check_out_deadline: '2026-10-02T23:00:00Z',
  status: 'OPEN',
  check_in_at: '2026-10-02T14:25:00Z',
  check_in_mode: 'REMOTE',
  check_in_site: null,
  check_out_at: null,
  check_out_mode: null,
  check_out_site: null,
  late_minutes: 25,
  early_leave_minutes: 0,
  break_minutes: 35,
  worked_minutes: null,
  breaks_allowed: 2,
  break_minutes_allowed: 30,
  breaks: [{ started_at: '2026-10-02T18:00:00Z', ended_at: '2026-10-02T18:35:00Z', minutes: 35, exceeded_minutes: 5 }],
};
const closed: WorkSession = {
  ...session,
  status: 'CLOSED',
  check_out_at: '2026-10-02T21:40:00Z',
  check_out_mode: 'ON_SITE',
  check_out_site: 'Planta Norte',
  early_leave_minutes: 20,
  worked_minutes: 400,
};
const onBreak: WorkSession = { ...session, breaks: [{ started_at: '2026-10-02T18:00:00Z', ended_at: null, minutes: 0, exceeded_minutes: 0 }] };
const missed: WorkSession = { ...session, status: 'MISSED_CHECKOUT' };

const timeline = (value: WorkSession) => {
  renderWithProviders(<SessionTimeline session={value} />);
  return screen.getByRole('list', { name: 'Jornada del turno Matutino' });
};

describe('Reglas de presentación de una jornada', () => {
  it('horario, horas en la hora del negocio y la fecha si el registro cae en otro día', () => {
    expect(scheduleRange(session.scheduled_start, session.scheduled_end)).toBe('08:00 – 16:00');
    expect(clockOn('2026-10-02T14:25:00Z', '2026-10-02')).toBe('08:25');
    // 06:02 del 3 de octubre en la hora del Centro: la salida de un turno nocturno.
    expect(clockOn('2026-10-03T12:02:00Z', '2026-10-02')).toBe('06:02 · 3 oct 2026');
  });

  it('descansos usados, minutos de más, distancias y el enlace al mapa', () => {
    expect(breaksUsed(session)).toBe('1/2 descansos');
    expect(breaksUsed({ breaks: [], breaks_allowed: 0 })).toBe('Sin descansos');
    expect(exceededMinutes({ breaks: [...session.breaks, { ...session.breaks[0], exceeded_minutes: 3 }] })).toBe(8);
    expect(formatDistance(12.4)).toBe('12 m');
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(mapsUrl(29.07, -110.95)).toBe('https://www.google.com/maps?q=29.07,-110.95');
  });

  it('la insignia de minutos dice qué significa y sin minutos no se dibuja', () => {
    const { container } = renderWithProviders(
      <>
        <MinutesBadge kind="late" minutes={25} />
        <MinutesBadge kind="early" minutes={0} />
      </>,
    );
    expect(screen.getByText('+25 min')).toBeInTheDocument();
    expect(screen.getByText('25 min de retardo')).toBeInTheDocument();
    expect(container.querySelectorAll('.badge')).toHaveLength(1);
  });
});

describe('SessionTimeline', () => {
  it('entrada con retardo, descanso con minutos de más y salida anticipada con lo trabajado', () => {
    const list = timeline(closed);
    for (const text of ['Entrada', '08:25', '+25 min', 'Programada 08:00 · Remoto', 'Descanso 1', '12:00 – 12:35', '+5 min', '35 min de 30 min permitidos']) {
      expect(within(list).getByText(text)).toBeInTheDocument();
    }
    for (const text of ['Salida', '15:40', '−20 min', 'Programada 16:00 · En sitio · Planta Norte', 'Tiempo trabajado: 6 h 40 min']) {
      expect(within(list).getByText(text)).toBeInTheDocument();
    }
  });

  it('un descanso en curso se resalta y la salida queda pendiente con su límite', () => {
    const list = timeline(onBreak);
    expect(within(list).getByText('Desde 12:00')).toBeInTheDocument();
    expect(within(list).getByText('En descanso')).toBeInTheDocument();
    expect(within(list).getByText('Puede durar hasta 30 min')).toBeInTheDocument();
    expect(within(list).getByText('Pendiente')).toBeInTheDocument();
    expect(within(list).getByText('Programada 16:00 · se puede checar hasta las 17:00')).toBeInTheDocument();
  });

  it('sin salida: el estado del catálogo y a qué hora venció; la salida de otro día lleva su fecha', () => {
    const list = timeline(missed);
    expect(within(list).getByText('Sin salida')).toBeInTheDocument();
    expect(within(list).getByText('Programada 16:00 · el límite para checarla fue a las 17:00')).toBeInTheDocument();
  });

  it('la salida de un turno nocturno muestra su fecha', () => {
    const list = timeline({ ...closed, check_out_at: '2026-10-03T12:02:00Z' });
    expect(within(list).getByText('06:02 · 3 oct 2026')).toBeInTheDocument();
  });
});

describe('SessionSummary', () => {
  const summary = (value: WorkSession) => {
    const { container } = renderWithProviders(<SessionSummary session={value} />);
    return container.querySelector('dl') as HTMLElement;
  };

  it('jornada en curso: entrada con retardo, salida pendiente, descansos y lo trabajado por calcular', () => {
    const facts = summary(session);
    for (const text of ['08:00 – 16:00', 'Matutino', '08:25', '+25 min', 'Remoto', 'Pendiente', 'Se puede checar hasta las 17:00', '1 de 2', 'De 30 min cada uno', '35 min', '+5 min', '—', 'Se calcula al checar la salida']) {
      expect(within(facts).getByText(text)).toBeInTheDocument();
    }
  });

  it('completa: salida con su modalidad y lo trabajado', () => {
    const facts = summary(closed);
    for (const text of ['15:40', '−20 min', 'En sitio · Planta Norte', '6 h 40 min']) expect(within(facts).getByText(text)).toBeInTheDocument();
    expect(within(facts).queryByText('Se calcula al checar la salida')).toBeNull();
  });

  it('sin salida y un turno sin descansos', () => {
    const facts = summary({ ...missed, breaks_allowed: 0, breaks: [], break_minutes: 0 });
    expect(within(facts).getByText('Sin salida')).toBeInTheDocument();
    expect(within(facts).getByText('El límite fue a las 17:00')).toBeInTheDocument();
    expect(within(facts).getByText('0 de 0')).toBeInTheDocument();
    expect(within(facts).getByText('Su turno no tiene descansos')).toBeInTheDocument();
  });
});
