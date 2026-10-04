import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import { SettingsPage } from './SettingsPage';

/** Política con el servidor que acepta cada cambio (responde la política ya actualizada). */
function serve(policy = samplePolicy) {
  return mockFetch((call) => apiOk(call.init.method === 'PUT' ? { ...policy, ...(JSON.parse(call.init.body as string) as object) } : policy));
}
const puts = (calls: Array<{ init: RequestInit }>) => calls.filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(c.init.body as string) as unknown);

afterEach(() => resetPolicyCache());

describe('Configuración: activar y confirmar', () => {
  it('activar una regla se guarda al instante y avisa qué cambia', async () => {
    const { calls } = serve({ ...samplePolicy, block_glasses: false });
    renderWithProviders(<SettingsPage />);
    const glasses = await screen.findByRole('switch', { name: 'Retirar los lentes' });
    expect(glasses).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(glasses);
    expect(await screen.findByText('Retirar los lentes: activado')).toBeInTheDocument();
    expect(glasses).toHaveAttribute('aria-checked', 'true');
    expect(puts(calls)).toEqual([{ block_glasses: true }]);
  });

  it('cancelar la confirmación deja la protección encendida y no guarda nada', async () => {
    const { calls } = serve();
    renderWithProviders(<SettingsPage />);
    const antiSpoofing = await screen.findByRole('switch', { name: 'Anti-spoofing' });
    await userEvent.click(antiSpoofing);
    const dialog = screen.getByRole('alertdialog', { name: 'Desactivar anti-spoofing' });
    expect(dialog).toHaveTextContent('Esto reduce la protección contra suplantación de identidad');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(antiSpoofing).toHaveAttribute('aria-checked', 'true');
    expect(puts(calls)).toEqual([]);
  });

  it('si la política no carga ofrece volver a cargar', async () => {
    mockFetch(apiFail(403, 'FORBIDDEN', 'Sin permisos'), apiOk(samplePolicy));
    renderWithProviders(<SettingsPage />);
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar la configuración' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('switch')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('switch', { name: 'Anti-spoofing' })).toBeInTheDocument();
  });
});
