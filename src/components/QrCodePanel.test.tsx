import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { samplePolicy } from '../test/fixtures';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { renderWithProviders } from '../test/render';
import { QrCodePanel } from './QrCodePanel';

/* Sección "Código QR" del detalle de un empleado en inglés y con cambio de idioma en caliente. */
const live = { live: true, live_until: '2026-10-03T12:00:30Z', last_issued_at: '2026-10-03T12:00:00Z', last_used_at: null };

describe('QrCodePanel en inglés (en-US)', () => {
  it('la actividad, la confirmación abierta (que cambia de idioma) y una falla al invalidar', async () => {
    mockFetch((call) => (call.init.method === 'DELETE' ? apiFail(409, 'QR_NOT_LIVE', 'El código ya no está vigente') : call.url.includes('/settings/') ? apiOk(samplePolicy) : apiOk(live)));
    await setLocale('en-US');
    renderWithProviders(<QrCodePanel employeeId={5} />);
    expect(await screen.findByText('On screen')).toBeInTheDocument();
    expect(screen.getByText('Dynamic QR code')).toBeInTheDocument();
    expect(screen.getByText('Valid until')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Invalidate active code' }));
    expect(await screen.findByRole('alertdialog', { name: 'Invalidate the active code?' })).toHaveTextContent('QR code');
    await act(() => setLocale('es-MX'));
    const confirm = screen.getByRole('alertdialog', { name: '¿Invalidar el código vigente?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Invalidar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo invalidar el código' })).toHaveTextContent('El código ya no está vigente');
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('alertdialog', { name: "Couldn't invalidate the code" })).toBeInTheDocument();
  });
});
