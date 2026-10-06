import { renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShiftPlace } from '../../../components/shifts/useShiftPlace';
import { apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { morning, page, plant, plantRef } from '../../../test/shifts';
import { ShiftFormPage } from './ShiftFormPage';

/** Bodega: un sitio que el turno tenía y luego se desactivó (no acepta registros). */
const closed = { ...plantRef, id: 9, name: 'Bodega', active: false };
const bodyOf = (call: MockCall | undefined) => JSON.parse(call?.init.body as string) as unknown;
const fieldFail = (code: string, message: string, field: string) => jsonResponse(envelope(null, { status: 422, code, message, errors: [{ code, message, field, details: null }] }), 422);
const rows = (dialog: HTMLElement, region: string) => within(within(dialog).getByRole('region', { name: region })).getAllByRole('listitem').map((row) => row.textContent);
const shiftDay = (name: string) => within(screen.getByRole('group', { name: 'Días en que empieza' })).getByRole('button', { name });
const remoteDay = (name: string) => within(screen.getByRole('group', { name: 'Días en que se checa remoto' })).getByRole('button', { name });
const SITE_REQUIRED = 'Elige al menos un sitio para los días no remotos';

afterEach(() => vi.unstubAllGlobals());

function renderForm(route: string, answer: (call: MockCall) => Response) {
  const server = mockFetch((call) => (call.url.startsWith('/api/sites') ? apiOk(page([plant], 1, 50)) : answer(call)));
  renderWithProviders(
    <Routes>
      <Route path="/company/shifts" element={<p>Lista de turnos</p>} />
      <Route path="/company/shifts/new" element={<ShiftFormPage />} />
      <Route path="/company/shifts/:id/edit" element={<ShiftFormPage />} />
    </Routes>,
    { route },
  );
  return server;
}

/** Pide guardar y confirma. */
async function confirmSave(button: string, title: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: button }));
  await userEvent.click(within(await screen.findByRole('dialog', { name: title })).getByRole('button', { name: button }));
}

describe('Turnos: dónde se checa', () => {
  it('un sitio es obligatorio salvo que todos sus días sean remotos; los días remotos son días del turno', async () => {
    const { calls } = renderForm('/company/shifts/new', () => apiOk(morning, { status: 201 }));
    await userEvent.type(screen.getByLabelText(/Nombre del turno/), 'Oficina');
    expect(await screen.findByRole('checkbox', { name: /Planta Norte/ })).not.toBeChecked();
    expect(screen.getByText(/Obligatorio: los días no remotos/)).toBeInTheDocument();
    expect(remoteDay('sábado')).toBeDisabled(); // el turno no trabaja el sábado

    await userEvent.click(screen.getByRole('button', { name: 'Crear turno' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(popup).toHaveTextContent(SITE_REQUIRED);
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText(SITE_REQUIRED)).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);

    // Remoto todos sus días: ya no hace falta un sitio. Quitar un día del turno lo quita de los remotos.
    await userEvent.click(screen.getByRole('button', { name: 'Todos sus días' }));
    expect(screen.queryByText(SITE_REQUIRED)).toBeNull();
    await userEvent.click(shiftDay('viernes'));
    expect(remoteDay('viernes')).toHaveAttribute('aria-pressed', 'false');
    expect(remoteDay('viernes')).toBeDisabled();
    await confirmSave('Crear turno', /¿Crear el turno Oficina\?/);
    expect(await screen.findByText('Lista de turnos')).toBeInTheDocument();
    expect(bodyOf(calls.find((c) => c.init.method === 'POST'))).toMatchObject({ weekdays: [0, 1, 2, 3], site_ids: [], remote_weekdays: [0, 1, 2, 3] });
  });

  it('los errores del servidor sobre el lugar quedan en su campo hasta cambiarlo', async () => {
    let posts = 0;
    const { calls } = renderForm('/company/shifts/new', () => {
      posts += 1;
      if (posts === 1) return fieldFail('SITE_NOT_AVAILABLE', 'Elige sitios activos de la empresa', 'site_ids');
      if (posts === 2) return fieldFail('REMOTE_DAY_OUTSIDE_SHIFT', 'El turno no trabaja el sábado: no puede ser día remoto', 'remote_weekdays');
      return apiOk(morning, { status: 201 });
    });
    await userEvent.type(screen.getByLabelText(/Nombre del turno/), 'Oficina');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Planta Norte/ }));
    await userEvent.click(remoteDay('lunes'));
    const save = async () => {
      await confirmSave('Crear turno', /¿Crear el turno Oficina\?/);
      await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo crear el turno' })).getByRole('button', { name: 'Entendido' }));
    };
    await save();
    expect(screen.getByText('Elige sitios activos de la empresa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Planta Norte/ }));
    expect(screen.queryByText('Elige sitios activos de la empresa')).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: /Planta Norte/ }));

    await save();
    expect(screen.getByText('El turno no trabaja el sábado: no puede ser día remoto')).toBeInTheDocument();
    await userEvent.click(remoteDay('martes'));
    expect(screen.queryByText('El turno no trabaja el sábado: no puede ser día remoto')).toBeNull();
    await confirmSave('Crear turno', /¿Crear el turno Oficina\?/);
    expect(await screen.findByRole('dialog', { name: 'Turno creado' })).toBeInTheDocument();
    expect(bodyOf(calls.filter((c) => c.init.method === 'POST').at(-1))).toMatchObject({ site_ids: [3], remote_weekdays: [0, 1] });
  });

  it('al editar: un sitio desactivado se ve para quitarlo; la confirmación dice qué cambia de los lugares y a cuántos afecta', async () => {
    const original = { ...morning, employees: 1, sites: [closed], remote_weekdays: [4] };
    const { calls } = renderForm('/company/shifts/5/edit', (call) => apiOk(call.init.method === 'PUT' ? { ...original, sites: [plantRef] } : original));
    const bodega = await screen.findByRole('checkbox', { name: /Bodega/ });
    expect(bodega).toBeChecked();
    expect(screen.getByText(/Desactivado: no acepta registros/)).toBeInTheDocument();
    await userEvent.click(bodega);
    await userEvent.click(screen.getByRole('checkbox', { name: /Planta Norte/ }));
    await userEvent.click(remoteDay('viernes'));
    const ask = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      return screen.findByRole('dialog', { name: '¿Guardar los cambios del turno Matutino?' });
    };

    // Sin sitios y remoto todos sus días: "Ninguno" en lugar de sus sitios.
    await userEvent.click(screen.getByRole('checkbox', { name: /Planta Norte/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Todos sus días' }));
    const remote = await ask();
    expect(rows(remote, 'Cambios')).toEqual(['Sitios donde se checaAntes: BodegaDespués: Ninguno', 'Días en que se checa remotoAntes: VieDespués: Lun a vie']);
    await userEvent.click(within(remote).getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ninguno' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Planta Norte/ }));

    const confirm = await ask();
    expect(confirm).toHaveTextContent('Afecta a 1 empleado asignado: desde ahora checan con este horario y en estos lugares.');
    expect(rows(confirm, 'Cambios')).toEqual(['Sitios donde se checaAntes: BodegaDespués: Planta Norte', 'Días en que se checa remotoAntes: VieDespués: Ninguno']);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('dialog', { name: 'Turno actualizado' })).toBeInTheDocument();
    expect(bodyOf(calls.find((c) => c.init.method === 'PUT'))).toMatchObject({ site_ids: [3], remote_weekdays: [] });
  });

  it('nombra un sitio que no conoce por su número', () => {
    const { result } = renderHook(() => useShiftPlace(null, [0, 1]));
    expect(result.current.siteName(99)).toBe('Sitio 99');
    expect(result.current.current).toEqual([]);
  });
});
