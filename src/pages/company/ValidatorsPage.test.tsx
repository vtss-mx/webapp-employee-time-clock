import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { samplePolicy, sampleValidator } from '../../test/fixtures';
import { apiOk, liveCheck, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Validator } from '../../types';
import { ValidatorsPage } from './ValidatorsPage';

const busy: Validator = { ...sampleValidator, id: 4, name: 'Comedor', email: 'comedor@empresa.com', mode: 'QR_AND_FACE', identifications_today: 1, last_login_at: '2026-10-01T09:00:00Z' };

function server(list: Validator[]) {
  return mockFetch((call) => {
    const method = call.init.method ?? 'GET';
    if (call.url === '/api/settings/verification') return apiOk(samplePolicy);
    if (call.url.startsWith('/api/validation')) return liveCheck();
    if (method === 'GET') return apiOk(list);
    if (method === 'PATCH') return apiOk({ ...sampleValidator, active: (JSON.parse(call.init.body as string) as { active: boolean }).active });
    if (method === 'DELETE') return apiOk(null);
    return apiOk({ ...sampleValidator, id: 9, name: 'Planta 2', email: 'planta2@empresa.com' });
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

  it('vacío: invita a crear el primero y el alta lo agrega a la lista', async () => {
    server([]);
    renderWithProviders(<ValidatorsPage />);
    expect(await screen.findByText('Aún no tienes validadores')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Agregar validador' })[0]);
    await userEvent.type(screen.getByLabelText(/Nombre o ubicación/), 'Planta 2');
    await userEvent.type(screen.getByLabelText(/Correo de acceso/), 'planta2@empresa.com');
    await userEvent.type(screen.getByLabelText(/Contraseña inicial/), 'Valida1234');
    const add = screen.getByRole('button', { name: 'Agregar' });
    await waitFor(() => expect(add).toBeEnabled()); // correo verificado en vivo
    await userEvent.click(add);
    expect(await screen.findByText('Validador agregado')).toBeInTheDocument();
    expect(screen.getByText('Planta 2')).toBeInTheDocument();
  });

  it('desactivar pide confirmación; eliminar lo quita de la lista', async () => {
    const { calls } = server([sampleValidator]);
    renderWithProviders(<ValidatorsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    let dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/su sesión se cerrará de inmediato/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByText('Validador desactivado')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'PATCH')?.url).toBe('/api/validators/3/status');
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    expect(await screen.findByText('Validador activado')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Recepción planta 1' }));
    dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText('Validador eliminado')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('recepcion@empresa.com')).not.toBeInTheDocument());
  });

  it('editar y restablecer contraseña abren el formulario del validador', async () => {
    server([sampleValidator]);
    renderWithProviders(<ValidatorsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Recepción planta 1' }));
    expect(screen.getByRole('dialog', { name: 'Editar validador' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña de Recepción planta 1' }));
    expect(screen.getByRole('dialog', { name: 'Restablecer contraseña' })).toBeInTheDocument();
  });
});
