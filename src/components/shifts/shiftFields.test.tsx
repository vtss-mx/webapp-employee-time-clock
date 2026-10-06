import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import { morning, plant, plantRef, siteAddress, weekend } from '../../test/shifts';
import type { Weekday, WorkSite } from '../../types';
import { addressLine } from '../../utils/address';
import { ShiftCard } from './ShiftCard';
import { SitePicker } from './SitePicker';
import { ShiftSummary } from './ShiftSummary';
import { shiftTimeline } from './shiftRules';
import type { PickedSite } from './useShiftPlace';
import { WeekdayPicker, type WeekdayPreset } from './WeekdayPicker';

afterEach(() => vi.unstubAllGlobals());

const site = (id: number, name: string): WorkSite => ({ ...plant, id, name, radius_m: 1200 });

function Days({ allowed, presets }: { allowed?: Weekday[]; presets?: WeekdayPreset[] }) {
  const [days, setDays] = useState<Weekday[]>([2]);
  return (
    <>
      <WeekdayPicker label="Días" value={days} onChange={setDays} allowed={allowed} presets={presets} hint="Elige los días" />
      <output>{days.join(',')}</output>
    </>
  );
}

const output = () => document.querySelector('output')?.textContent;

describe('WeekdayPicker', () => {
  it('prende y apaga días (en orden) y aplica las selecciones rápidas', async () => {
    renderWithProviders(<Days presets={[{ label: 'Lun a vie', days: [0, 1, 2, 3, 4] }, { label: 'Ninguno', days: [] }]} />);
    const group = screen.getByRole('group', { name: 'Días' });
    expect(group).toHaveAccessibleDescription('Elige los días');
    await userEvent.click(within(group).getByRole('button', { name: 'lunes' }));
    expect(output()).toBe('0,2');
    await userEvent.click(within(group).getByRole('button', { name: 'miércoles' }));
    expect(output()).toBe('0');
    expect(within(group).getByRole('button', { name: 'lunes' })).toHaveAttribute('aria-pressed', 'true');

    const quick = screen.getByRole('group', { name: 'Selección rápida: días' });
    await userEvent.click(within(quick).getByRole('button', { name: 'Lun a vie' }));
    expect(output()).toBe('0,1,2,3,4');
    expect(within(quick).getByRole('button', { name: 'Lun a vie' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(quick).getByRole('button', { name: 'Ninguno' }));
    expect(output()).toBe('');
  });

  it('solo deja elegir los días permitidos y sin selecciones rápidas no las muestra', () => {
    renderWithProviders(<Days allowed={[0, 2]} />);
    expect(screen.getByRole('button', { name: 'martes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'martes' })).toHaveAttribute('title', 'El turno no trabaja ese día');
    expect(screen.getByRole('button', { name: 'lunes' })).toBeEnabled();
    expect(screen.queryByRole('group', { name: /Selección rápida/ })).toBeNull();
  });
});

describe('ShiftSummary', () => {
  it('sin horas válidas explica qué falta; con turno nocturno lo indica', () => {
    const { rerender } = renderWithProviders(<ShiftSummary timeline={null} weekdays={[]} breaksCount={0} breakMinutes={0} />);
    expect(screen.getByText(/Elige la hora de entrada y la de salida/)).toBeInTheDocument();
    const night = shiftTimeline({ start: 1320, end: 360, breaksCount: 1, breakMinutes: 30, earlyCheckIn: 30, lateTolerance: 5, earlyCheckOut: 0, lateCheckOut: 60 });
    rerender(<ShiftSummary timeline={night} weekdays={[0, 1, 2, 3, 4]} breaksCount={1} breakMinutes={30} />);
    expect(screen.getByText('8 h')).toBeInTheDocument();
    expect(screen.getByText('Termina al día siguiente')).toBeInTheDocument();
    expect(screen.getByText('Puede checar desde las 21:30; después de las 22:05 es retardo.')).toBeInTheDocument();
    expect(screen.getByText('Desde las 06:00 del día siguiente y a más tardar a las 07:00 del día siguiente.')).toBeInTheDocument();
    expect(screen.getByText('1 × 30 min')).toBeInTheDocument();
    expect(screen.getByText('Lun a vie')).toBeInTheDocument();
  });
});

function Sites({ current }: { current?: typeof plantRef[] }) {
  const [ids, setIds] = useState<number[]>(current?.map((one) => one.id) ?? []);
  const [picked, setPicked] = useState<PickedSite[]>([]);
  return (
    <>
      <SitePicker
        label="Sitios"
        value={ids}
        current={current}
        onChange={(next, names) => {
          setIds(next);
          setPicked(names);
        }}
        hint="Obligatorio."
        error={ids.length ? undefined : 'Elige un sitio'}
      />
      <output>{ids.join(',')}</output>
      <p data-testid="names">{picked.map((one) => one.name).join(',')}</p>
    </>
  );
}

describe('SitePicker', () => {
  it('pide los sitios activos (hasta 50) y se eligen tocando la tarjeta completa', async () => {
    const { calls } = mockFetch(apiOk({ items: [site(1, 'Planta Norte'), site(2, 'Oficina')], total: 2, page: 1, size: 50 }));
    renderWithProviders(<Sites />);
    const north = await screen.findByRole('checkbox', { name: /Planta Norte/ });
    expect(calls[0].url).toBe('/api/sites?active=true&page=1&size=50');
    expect(screen.getAllByText('1.2 km')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Sitios' })).toHaveAccessibleDescription('Elige un sitio');
    await userEvent.click(screen.getByText('Oficina'));
    await userEvent.click(north);
    expect(output()).toBe('2,1');
    expect(screen.getByTestId('names')).toHaveTextContent('Planta Norte,Oficina'); // los nombres para la confirmación
    expect(north.closest('label')).toHaveClass('is-checked');
    expect(north).toHaveAccessibleDescription(`${addressLine(siteAddress)} 1.2 km`); // domicilio e insignia del radio
    await userEvent.click(north);
    expect(output()).toBe('2');
  });

  it('un sitio del turno que se desactivó se ofrece marcado para poder quitarlo', async () => {
    const closed = { ...plantRef, id: 9, name: 'Bodega', active: false };
    mockFetch(apiOk({ items: [site(1, 'Planta Norte')], total: 1, page: 1, size: 50 }));
    renderWithProviders(<Sites current={[closed, { ...plantRef, id: 1 }]} />);
    const old = await screen.findByRole('checkbox', { name: /Bodega/ });
    expect(old).toBeChecked();
    expect(old).toHaveAccessibleDescription('Desactivado: no acepta registros. Quítalo del turno o actívalo en Sitios de trabajo. Inactivo 100 m');
    expect(screen.getAllByRole('checkbox')).toHaveLength(2); // el activo que ya tenía no se repite
    await userEvent.click(old);
    expect(output()).toBe('1');
  });

  it('con más de 50 sitios activos avisa que se muestran los primeros', async () => {
    mockFetch(apiOk({ items: [site(1, 'Planta Norte'), site(2, 'Oficina')], total: 51, page: 1, size: 50 }));
    const { unmount } = renderWithProviders(<SitePicker label="Sitios" value={[]} onChange={() => undefined} hint="Opcional." />);
    expect(await screen.findByText('Opcional. Se muestran los primeros 2 sitios activos (orden alfabético).')).toBeInTheDocument();
    unmount();
    mockFetch(apiOk({ items: [site(1, 'Planta Norte')], total: 51, page: 1, size: 50 }));
    renderWithProviders(<SitePicker label="Sitios" value={[]} onChange={() => undefined} hint="Opcional." />);
    expect(await screen.findByText('Opcional. Se muestra el primer sitio activo (orden alfabético).')).toBeInTheDocument();
  });

  it('sin sitios activos invita a crear uno; si falla la carga ofrece volver a cargar', async () => {
    let attempts = 0;
    mockFetch(() => {
      attempts += 1;
      return attempts === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada') : apiOk({ items: [], total: 0, page: 1, size: 50 });
    });
    renderWithProviders(<SitePicker label="Sitios" value={[]} onChange={() => undefined} hint="Opcional." />);
    await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los sitios' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Sin sitios activos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear sitio' })).toHaveAttribute('href', '/company/sites/new');
  });
});

describe('ShiftCard', () => {
  it('cuándo y dónde se checa: horario, días, descansos, sitios (con domicilio y radio) y días remotos', () => {
    const { rerender } = renderWithProviders(<ShiftCard shift={{ ...morning, remote_weekdays: [0], sites: [plantRef, { ...plantRef, id: 4, name: 'Bodega', active: false }] }} />);
    const card = screen.getByRole('group', { name: 'Turno Matutino: cuándo y dónde se checa' });
    expect(card).toHaveTextContent('08:00 – 16:00 · Lun a vie · 1 × 30 min');
    expect(card).toHaveTextContent('Remoto: Lun');
    expect(card).toHaveTextContent('Esos días se checa desde cualquier lugar, con el rostro y la ubicación.');
    expect(card).toHaveTextContent(addressLine(siteAddress));
    expect(card).toHaveTextContent('Dentro de 100 m de su ubicación');
    const bodega = within(card).getByText('Bodega').closest('li') as HTMLElement;
    expect(within(bodega).getByText('Inactivo')).toBeInTheDocument();
    // Sin descansos conocidos (el turno de una solicitud) y nocturno, remoto todos sus días.
    const { breaks_count: _count, break_minutes: _minutes, ...summary } = weekend;
    rerender(<ShiftCard shift={summary} />);
    expect(screen.getByRole('group', { name: 'Turno Fin de semana: cuándo y dónde se checa' })).toHaveTextContent('22:00 – 06:00 (día siguiente) · Sáb y domRemoto: Sáb y dom');
    expect(screen.queryByText(/Dentro de/)).toBeNull();
  });
});

describe('en inglés (en-US)', () => {
  it('días con sus nombres, resumen de la jornada y tarjeta del turno; el cambio de idioma se aplica en caliente', async () => {
    await setLocale('en-US');
    renderWithProviders(<Days allowed={[0, 2]} presets={[{ label: 'Workweek', days: [0, 1, 2, 3, 4] }]} />);
    const group = screen.getByRole('group', { name: 'Días' });
    expect(within(group).getByRole('button', { name: 'Monday' })).toHaveTextContent('Mon');
    expect(within(group).getByRole('button', { name: 'Tuesday' })).toHaveAttribute('title', "The shift doesn't work that day");
    expect(screen.getByRole('group', { name: 'Quick pick: días' })).toBeInTheDocument();

    const night = shiftTimeline({ start: 1320, end: 360, breaksCount: 1, breakMinutes: 30, earlyCheckIn: 30, lateTolerance: 5, earlyCheckOut: 0, lateCheckOut: 60 });
    const { rerender } = renderWithProviders(<ShiftSummary timeline={night} weekdays={[0, 1, 2, 3, 4]} breaksCount={1} breakMinutes={30} />);
    expect(screen.getByText('Ends the next day')).toBeInTheDocument();
    expect(screen.getByText('Can check in from 9:30 PM; after 10:05 PM it counts as late.')).toBeInTheDocument();
    expect(screen.getByText('From 6:00 AM the next day and no later than 7:00 AM the next day.')).toBeInTheDocument();
    expect(screen.getByText('Mon–Fri')).toBeInTheDocument();

    rerender(<ShiftCard shift={{ ...morning, remote_weekdays: [0] }} />);
    const card = screen.getByRole('group', { name: 'Matutino shift: when and where to check in' });
    expect(card).toHaveTextContent('8:00 AM – 4:00 PM · Mon–Fri · 1 × 30 min');
    expect(card).toHaveTextContent('Remote: Mon');
    expect(card).toHaveTextContent('Within 100 m of its location');
    // De vuelta a español con la tarjeta en pantalla: todo se traduce sin volver a montarla.
    await act(() => setLocale('es-MX'));
    expect(screen.getByRole('group', { name: 'Turno Matutino: cuándo y dónde se checa' })).toHaveTextContent('08:00 – 16:00 · Lun a vie · 1 × 30 min');
    expect(within(group).getByRole('button', { name: 'lunes' })).toHaveTextContent('Lun');
  });

  it('el selector de sitios avisa en inglés que solo muestra los primeros', async () => {
    await setLocale('en-US');
    mockFetch(apiOk({ items: [site(1, 'Planta Norte'), { ...site(2, 'Bodega'), radius_m: 1234 }], total: 60, page: 1, size: 50 }));
    renderWithProviders(<SitePicker label="Sites" value={[]} onChange={() => undefined} hint="Optional." />);
    expect(await screen.findByText('Optional. Showing the first 2 active sites (alphabetical order).')).toBeInTheDocument();
    expect(screen.getByText('1.234 km')).toBeInTheDocument();
  });
});
