import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Weekday, WorkSite } from '../../types';
import { SitePicker } from './SitePicker';
import { ShiftSummary } from './ShiftSummary';
import { shiftTimeline } from './shiftRules';
import { WeekdayPicker, type WeekdayPreset } from './WeekdayPicker';

afterEach(() => vi.unstubAllGlobals());

const site = (id: number, name: string): WorkSite => ({
  id,
  name,
  radius_m: 1200,
  active: true,
  employees: 0,
  created_at: '2026-10-01T00:00:00Z',
  address: { street: 'Calle 1', exterior_number: '10', interior_number: null, postal_code: '83000', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo', latitude: 29, longitude: -110 },
});

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

function Sites() {
  const [ids, setIds] = useState<number[]>([]);
  return (
    <>
      <SitePicker label="Sitios" value={ids} onChange={setIds} hint="Obligatorio." error={ids.length ? undefined : 'Elige un sitio'} />
      <output>{ids.join(',')}</output>
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
    expect(north.closest('label')).toHaveClass('is-checked');
    expect(north).toHaveAccessibleDescription('Calle 1 10, 83000 Hermosillo, Sonora 1.2 km'); // domicilio e insignia del radio
    await userEvent.click(north);
    expect(output()).toBe('2');
  });

  it('con más de 50 sitios activos avisa que se muestran los primeros', async () => {
    mockFetch(apiOk({ items: [site(1, 'Planta Norte')], total: 51, page: 1, size: 50 }));
    renderWithProviders(<SitePicker label="Sitios" value={[]} onChange={() => undefined} hint="Opcional." />);
    expect(await screen.findByText('Opcional. Se muestran los primeros 1 sitios activos (orden alfabético).')).toBeInTheDocument();
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
    expect(await screen.findByText('No hay sitios activos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo sitio' })).toHaveAttribute('href', '/company/sites/new');
  });
});
