import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { samplePolicy, sampleValidator } from '../../test/fixtures';
import { apiOk, liveCheck, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Validator } from '../../types';
import { Route, Routes } from 'react-router-dom';
import { ValidatorsPage } from './ValidatorsPage';

const busy: Validator = { ...sampleValidator, id: 4, name: 'Comedor', email: 'comedor@empresa.com', mode: 'QR_AND_FACE', identifications_today: 1, last_login_at: '2026-10-01T09:00:00Z' };

/** API simulada con estado: el listado (paginado) refleja altas y bajas. */
function server(initial: Validator[]) {
  let list = [...initial];
  return mockFetch((call) => {
    const method = call.init.method ?? 'GET';
    if (call.url === '/api/settings/verification') return apiOk(samplePolicy);
    if (call.url.startsWith('/api/validation')) return liveCheck();
    if (method === 'GET') return apiOk({ items: list, total: list.length, page: 1, size: 10 });
    if (method === 'PATCH') return apiOk({ ...sampleValidator, active: (JSON.parse(call.init.body as string) as { active: boolean }).active });
    if (method === 'DELETE') {
      list = list.filter((v) => !call.url.endsWith(`/${v.id}`));
      return apiOk(null);
    }
    return apiOk(sampleValidator); // restablecer contraseña
  });
}

afterEach(() => resetPolicyCache());

describe('ValidatorsPage (COMPANY)', () => {
  it('lista con modo, estado, actividad del día y aviso de dispositivos', async () => {
    server([sampleValidator, busy]);
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText('Recepción planta 1')).toBeInTheDocument();
    expect(screen.getByText('2 registrados · identifican a tu personal por QR, rostro o ambos')).toBeInTheDocument();
    expect(screen.getByText('QR o rostro')).toBeInTheDocument();
    expect(screen.getByText('QR y rostro')).toBeInTheDocument();
    expect(screen.getByText(/1 identificación hoy · Último acceso/)).toBeInTheDocument();
    expect(screen.getByText(/0 identificaciones hoy · Aún no inicia sesión/)).toBeInTheDocument();
    expect(screen.getByText(/solo inician sesión desde una tableta o un teléfono/)).toBeInTheDocument();
  });

  it('vacío: invita a crear el primero (la pantalla de alta)', async () => {
    server([]);
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText('No hay validadores registrados')).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'Agregar validador' })) expect(link).toHaveAttribute('href', '/company/validators/new');
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });

  it('domicilio, radio exigido y aviso a los que no tienen domicilio', async () => {
    const guarded: Validator = { ...busy, location_required: true, location_radius_m: 1500, devices_pending: 2, address: { ...sampleValidator.address!, interior_number: 'B' } };
    server([{ ...sampleValidator, address: null }, guarded]);
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText(/Sin domicilio: edítalo para agregarlo/)).toBeInTheDocument();
    expect(screen.getByText(/Calle Dr. Paliza 71 Int. B, 83000 Hermosillo, Sonora/)).toBeInTheDocument();
    expect(screen.getByText('1,500 m')).toBeInTheDocument();
    expect(screen.getByText('2 dispositivos por autorizar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dispositivos de Comedor' })).toHaveAttribute('href', '/company/validators/4/devices');
  });

  it('desactivar pide confirmación; eliminar lo quita de la lista', async () => {
    const { calls } = server([sampleValidator]);
    renderWithProviders(<ValidatorsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    let dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/su sesión se cerrará de inmediato/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByText('Validador desactivado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' })); // confirmación en popup
    expect(calls.find((c) => c.init.method === 'PATCH')?.url).toBe('/api/validators/3/status');
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    expect(await screen.findByText('Validador activado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Recepción planta 1' }));
    dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText('Validador eliminado')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('recepcion@empresa.com')).not.toBeInTheDocument());
  });

  it('editar, restablecer contraseña y dispositivos llevan a su pantalla', async () => {
    server([sampleValidator]);
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ValidatorsPage />} />
        <Route path="/company/validators/:id/edit" element={<p>Pantalla de edición</p>} />
        <Route path="/company/validators/:id/password" element={<p>Pantalla de contraseña</p>} />
      </Routes>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Restablecer contraseña de Recepción planta 1' }));
    expect(await screen.findByText('Pantalla de contraseña')).toBeInTheDocument();
  });

  it('editar lleva a su pantalla', async () => {
    server([sampleValidator]);
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ValidatorsPage />} />
        <Route path="/company/validators/:id/edit" element={<p>Pantalla de edición</p>} />
      </Routes>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Recepción planta 1' }));
    expect(await screen.findByText('Pantalla de edición')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull(); // ningún formulario en popup
  });
});
