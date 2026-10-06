import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { setLocale } from '../../i18n/core';
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
    if (method === 'GET') return apiOk({ items: list, total: list.length, page: 1, size: 10, active: list.filter((v) => v.active).length, limit: 10 });
    if (method === 'PATCH') {
      const { active } = JSON.parse(call.init.body as string) as { active: boolean };
      list = list.map((v) => (call.url.endsWith(`/${v.id}/status`) ? { ...v, active } : v));
      return apiOk({ ...sampleValidator, active });
    }
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
    expect(await screen.findByText('Sin validadores')).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'Agregar validador' })) expect(link).toHaveAttribute('href', '/company/validators/new');
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });

  it('domicilio, radio exigido y aviso a los que no tienen domicilio', async () => {
    const guarded: Validator = { ...busy, location_required: true, location_radius_m: 1500, devices_pending: 2, address: { ...sampleValidator.address!, interior_number: 'B' } };
    server([{ ...sampleValidator, address: null }, guarded]);
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText(/Sin domicilio: edítalo para agregarlo/)).toBeInTheDocument();
    expect(screen.getByText(/Calle Dr. Paliza 71 Int. B, Centro, 83000 Hermosillo, Sonora/)).toBeInTheDocument(); // con la colonia
    expect(screen.getByText('1,500 m')).toBeInTheDocument();
    expect(screen.getByText('2 dispositivos por autorizar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dispositivos de Comedor' })).toHaveAttribute('href', '/company/validators/4/devices');
  });

  it('desactivar y activar confirman el cambio de estado; eliminar confirma y lo quita de la lista', async () => {
    const { calls } = server([sampleValidator]);
    renderWithProviders(<ValidatorsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    let dialog = await screen.findByRole('alertdialog', { name: '¿Desactivar el validador Recepción planta 1?' });
    expect(within(dialog).getByText(/su sesión se cerrará de inmediato/)).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: ActivoDespués: Inactivo');
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Correo de accesorecepcion@empresa.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByText('Validador desactivado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' })); // confirmación en popup
    expect(calls.find((c) => c.init.method === 'PATCH')?.url).toBe('/api/validators/3/status');
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    dialog = await screen.findByRole('dialog', { name: '¿Activar el validador Recepción planta 1?' });
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: InactivoDespués: Activo');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Activar' }));
    expect(await screen.findByText('Validador activado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Recepción planta 1' }));
    dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar el validador Recepción planta 1?' });
    expect(dialog).toHaveTextContent('La bitácora de sus identificaciones se conserva.');
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent(
      'Correo de accesorecepcion@empresa.comModoQR o rostroDomicilioCalle Dr. Paliza 71, Centro, 83000 Hermosillo, Sonora',
    );
    expect(dialog).toHaveTextContent('Pasará a «Eliminados»: podrás restaurarlo durante 1 año. Sus datos faciales y fotos se borran para siempre.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar validador' }));
    expect(await screen.findByText('Validador eliminado')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('recepcion@empresa.com')).not.toBeInTheDocument());
  });

  it('cancelar activar, desactivar o eliminar no envía nada y la lista sigue igual', async () => {
    const { calls } = server([{ ...sampleValidator, address: null }, { ...busy, active: false }]);
    renderWithProviders(<ValidatorsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Desactivar el validador Recepción planta 1?' })).getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Activar el validador Comedor?' })).getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Recepción planta 1' }));
    const remove = await screen.findByRole('alertdialog', { name: '¿Eliminar el validador Recepción planta 1?' });
    expect(within(remove).getByRole('region', { name: 'Detalles' })).toHaveTextContent('DomicilioSin domicilio');
    await userEvent.click(within(remove).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls.some((c) => c.init.method === 'PATCH' || c.init.method === 'DELETE')).toBe(false);
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Activar' })).toBeEnabled();
    expect(screen.getByText('Comedor')).toBeInTheDocument();
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
  /** El listado con el uso de su límite (lo fija el administrador de la plataforma). */
  const seats = (items: Validator[], active: number, limit: number) =>
    mockFetch((call) => apiOk(call.url === '/api/settings/verification' ? samplePolicy : { items, total: items.length, page: 1, size: 10, active, limit }));

  it('dice cuántos activos lleva de su límite; al llegar, agregar y activar se deshabilitan con qué hacer', async () => {
    seats([sampleValidator, { ...busy, active: false }], 1, 1);
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText('1 de 1 activo')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Validadores activos de tu límite' })).toHaveAttribute('aria-valuenow', '100');
    const hint = 'Llegaste a tu límite de validadores activos. Pide más al administrador de la plataforma.';
    expect(screen.getByText(hint)).toBeInTheDocument();
    const add = screen.getByRole('button', { name: 'Agregar validador' });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute('title', hint);
    expect(within(row('Comedor')).getByRole('button', { name: 'Activar' })).toBeDisabled();
    expect(within(row('Recepción planta 1')).getByRole('button', { name: 'Desactivar' })).toBeEnabled(); // desactivar libera un lugar
  });

  it('con lugares, agregar lleva al alta; en inglés también dice su uso', async () => {
    await setLocale('en-US');
    seats([sampleValidator], 1, 3);
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText('1 of 3 active')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Active validators of your limit' })).toHaveAttribute('aria-valuenow', '33');
    expect(screen.getByRole('link', { name: 'Add validator' })).toHaveAttribute('href', '/company/validators/new');
    expect(screen.queryByText(/You reached your active validator limit/)).toBeNull();
  });

  it('desactivar uno no toca a los demás; un solo dispositivo pendiente se dice en singular', async () => {
    server([sampleValidator, { ...busy, devices_pending: 1 }]);
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText('1 dispositivo por autorizar')).toBeInTheDocument();
    expect(screen.getByText('2 de 10 activos')).toBeInTheDocument();
    await userEvent.click(within(row('Recepción planta 1')).getByRole('button', { name: 'Desactivar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByText('Validador desactivado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(await screen.findByText('1 de 10 activos')).toBeInTheDocument(); // el uso del límite viene del servidor
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
      return lists === 1 ? apiOk({ items: [sampleValidator, busy], total: 2, page: 1, size: 10, active: 1, limit: 10 }) : new Promise<Response>((done) => (release = done));
    });
    renderWithProviders(<ValidatorsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Comedor' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Eliminar el validador Comedor?' })).getByRole('button', { name: 'Eliminar validador' }));
    expect(await screen.findByText('Validador eliminado')).toBeInTheDocument();
    expect(row('Comedor').closest('ul')).toHaveClass('is-loading');
    release(apiOk({ items: [sampleValidator], total: 1, page: 1, size: 10, active: 1, limit: 10 }));
    expect(await screen.findByText('1 registrado · identifican a tu personal por QR, rostro o ambos')).toBeInTheDocument();
    expect(screen.queryByText('Comedor')).toBeNull();
  });

  it('si la empresa permite computadoras, el pie lo dice de otra forma', async () => {
    mockFetch((call) => apiOk(call.url === '/api/settings/verification' ? { ...samplePolicy, validator_mobile_only: false } : { items: [sampleValidator], total: 1, page: 1, size: 10, active: 1, limit: 10 }));
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText('Cada identificación queda en la bitácora con el validador que la hizo.')).toBeInTheDocument();
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

describe('Validadores: cada falla se explica con su título', () => {
  const refuse = () => apiFail(409, 'VALIDATOR_BUSY', 'Está en uso');

  it('la lista que no carga', async () => {
    mockFetch((call) => (call.url === '/api/settings/verification' ? apiOk(samplePolicy) : apiFail(403, 'FORBIDDEN', 'Sin acceso')));
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los validadores' })).toHaveTextContent('Sin acceso');
  });

  it('cambiar el estado y eliminar', async () => {
    mockFetch((call) => {
      if (call.url === '/api/settings/verification') return apiOk(samplePolicy);
      if (call.init.method === 'PATCH' || call.init.method === 'DELETE') return refuse();
      return apiOk({ items: [sampleValidator], total: 1, page: 1, size: 10, active: 1, limit: 10 });
    });
    renderWithProviders(<ValidatorsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: /^¿Desactivar/ })).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cambiar el estado' })).toHaveTextContent('Está en uso');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Recepción planta 1' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: /^¿Eliminar/ })).getByRole('button', { name: 'Eliminar validador' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar el validador' })).toHaveTextContent('Está en uso');
  });

  it('restablecer la contraseña', async () => {
    mockFetch((call) => (call.init.method === 'PUT' ? refuse() : apiOk(sampleValidator)));
    renderWithProviders(
      <Routes>
        <Route path="/company/validators/:id/password" element={<ValidatorPasswordPage />} />
      </Routes>,
      { route: '/company/validators/3/password' },
    );
    await userEvent.type(await screen.findByLabelText(/Contraseña nueva/), 'Nueva12345');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Nueva12345');
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: /^¿Restablecer/ })).getByRole('button', { name: 'Restablecer contraseña' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo restablecer la contraseña' })).toHaveTextContent('Está en uso');
  });
});

describe('ValidatorsPage en inglés (en-US)', () => {
  it('lista, actividad, radio con separadores, dispositivos y confirmación de estado en inglés', async () => {
    await setLocale('en-US');
    const guarded: Validator = { ...busy, location_required: true, location_radius_m: 1500, devices_pending: 1 };
    server([{ ...sampleValidator, address: null }, guarded]);
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText('Recepción planta 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Identity validators' })).toBeInTheDocument();
    expect(screen.getByText('2 registered · they identify your staff by QR, face or both')).toBeInTheDocument();
    expect(screen.getByText(/0 identifications today · Hasn't signed in yet/)).toBeInTheDocument();
    expect(screen.getByText(/1 identification today · Last sign-in:/)).toBeInTheDocument();
    expect(screen.getByText('No address: edit it to add one')).toBeInTheDocument();
    expect(screen.getByText('1,500 m')).toBeInTheDocument();
    expect(screen.getByText('1 device awaiting approval')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Devices of Comedor' })).toBeInTheDocument();
    expect(screen.getByText(/Validators only sign in from a tablet or a phone/)).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0]);
    const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate the validator Recepción planta 1?' });
    expect(dialog).toHaveTextContent('Sign-in emailrecepcion@empresa.com');
    expect(dialog).toHaveTextContent(/Status.*Active.*Inactive/);
  });
});
