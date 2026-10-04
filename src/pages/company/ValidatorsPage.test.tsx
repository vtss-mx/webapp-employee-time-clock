import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { samplePolicy, sampleValidator } from '../../test/fixtures';
import { apiFail, apiOk, liveCheck, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Validator } from '../../types';
import { Route, Routes } from 'react-router-dom';
import { ValidatorPasswordPage } from './ValidatorPasswordPage';
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

describe('ValidatorsPage: más casos', () => {
  const row = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

  it('desactivar uno no toca a los demás; un solo dispositivo pendiente se dice en singular', async () => {
    server([sampleValidator, { ...busy, devices_pending: 1 }]);
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText('1 dispositivo por autorizar')).toBeInTheDocument();
    await userEvent.click(within(row('Recepción planta 1')).getByRole('button', { name: 'Desactivar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByText('Validador desactivado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(within(row('Recepción planta 1')).getByRole('button', { name: 'Activar' })).toBeInTheDocument();
    expect(within(row('Comedor')).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
  });

  it('tras eliminar vuelve a pedir la lista; mientras llega se atenúa', async () => {
    let release: (response: Response) => void = () => undefined;
    let lists = 0;
    mockFetch((call) => {
      if (call.url === '/api/settings/verification') return apiOk(samplePolicy);
      if (call.init.method === 'DELETE') return apiOk(null);
      lists += 1;
      return lists === 1 ? apiOk({ items: [sampleValidator, busy], total: 2, page: 1, size: 10 }) : new Promise<Response>((done) => (release = done));
    });
    renderWithProviders(<ValidatorsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Comedor' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText('Validador eliminado')).toBeInTheDocument();
    expect(row('Comedor').closest('ul')).toHaveClass('is-loading');
    release(apiOk({ items: [sampleValidator], total: 1, page: 1, size: 10 }));
    expect(await screen.findByText('1 registrado · identifican a tu personal por QR, rostro o ambos')).toBeInTheDocument();
    expect(screen.queryByText('Comedor')).toBeNull();
  });

  it('si la empresa permite computadoras, el pie lo dice de otra forma', async () => {
    mockFetch((call) => apiOk(call.url === '/api/settings/verification' ? { ...samplePolicy, validator_mobile_only: false } : { items: [sampleValidator], total: 1, page: 1, size: 10 }));
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText('Cada identificación queda registrada en la bitácora con el validador que la hizo.')).toBeInTheDocument();
  });
});

describe('ValidatorPasswordPage: más casos', () => {
  const renderPassword = () =>
    renderWithProviders(
      <Routes>
        <Route path="/company/validators/:id/password" element={<ValidatorPasswordPage />} />
      </Routes>,
      { route: '/company/validators/3/password' },
    );

  it('enviar con Enter sin una contraseña válida no llama a la API', async () => {
    const { calls } = mockFetch(apiOk(sampleValidator));
    renderPassword();
    const reset = await screen.findByRole('button', { name: 'Restablecer' });
    await userEvent.type(screen.getByLabelText(/Contraseña nueva/), 'corta');
    fireEvent.submit(reset.closest('form')!);
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
    expect(reset).toBeDisabled();
  });

  it('si el validador no carga ofrece volver a cargar', async () => {
    mockFetch(apiFail(404, 'VALIDATOR_NOT_FOUND', 'Validador no encontrado'), apiOk(sampleValidator));
    renderPassword();
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar el validador' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Recepción planta 1 · recepcion@empresa.com')).toBeInTheDocument();
  });
});
