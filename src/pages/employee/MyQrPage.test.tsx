import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DynamicQrCode } from '../../components/DynamicQrCode';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders, sampleUser } from '../../test/render';
import { MyQrPage } from './MyQrPage';

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: sampleUser }) }));

const qr = (id: number) => ({ id, employee_number: 'EMP-7', created_at: 'x', expires_at: 'y', lifetime_seconds: 30, image_base64: `data:image/png;base64,${id}` });

afterEach(() => resetPolicyCache());

describe('MyQrPage (QR dinámico)', () => {
  it('muestra el código con su cuenta regresiva, lo amplía y genera otro bajo demanda', async () => {
    let next = 0;
    const { calls } = mockFetch((call) => {
      if (call.url.includes('/settings/')) return apiOk(samplePolicy);
      if (call.init.method === 'POST') return apiOk(qr(++next));
      return apiOk({ id: next, status: 'ACTIVE', expires_at: null, used_at: null });
    });
    renderWithProviders(<MyQrPage />);
    expect(await screen.findByAltText('Código QR de Ana Ruiz')).toHaveAttribute('src', 'data:image/png;base64,1');
    expect(screen.getByText(/Se renueva en/)).toHaveTextContent(/30 s|29 s/);
    expect(screen.getByText(/Cambia cada 30 s y sirve una sola vez/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descargar/ })).toBeNull(); // un QR dinámico no se descarga

    await userEvent.click(screen.getByRole('button', { name: 'Generar otro' }));
    await waitFor(() => expect(screen.getAllByAltText('Código QR de Ana Ruiz')[0]).toHaveAttribute('src', 'data:image/png;base64,2'));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar en grande' }));
    const dialog = screen.getByRole('dialog', { name: 'Ana Ruiz' });
    expect(within(dialog).getByAltText('Código QR de Ana Ruiz')).toBeInTheDocument();
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Cerrar' })[0]);
  });

  it('si no se puede generar lo explica y permite reintentar', async () => {
    let failed = false;
    mockFetch((call) => {
      if (call.url.includes('/settings/')) return apiOk(samplePolicy);
      if (call.init.method === 'POST' && !failed) {
        failed = true;
        return apiFail(403, 'QR_DISABLED', 'La verificación por QR está deshabilitada');
      }
      return call.init.method === 'POST' ? apiOk(qr(1)) : apiOk({ id: 1, status: 'ACTIVE' });
    });
    renderWithProviders(<MyQrPage />);
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo generar tu código QR' });
    expect(screen.getByText('No se pudo generar tu código')).toBeInTheDocument();
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByAltText('Código QR de Ana Ruiz')).toBeInTheDocument();
  });
});

describe('DynamicQrCode', () => {
  it.each([
    ['used', '¡Listo!', null],
    ['replaced', 'Este código se reemplazó', 'Mostrar un código nuevo'],
    ['paused', 'En pausa', 'Mostrar código'],
  ] as const)('estado %s', async (phase, title, action) => {
    const onRenew = vi.fn();
    renderWithProviders(<DynamicQrCode qr={qr(1)} phase={phase} progress={0} remaining={0} alt="QR" onRenew={onRenew} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    if (action) {
      await userEvent.click(screen.getByRole('button', { name: action }));
      expect(onRenew).toHaveBeenCalled();
    }
  });

  it('cargando: esqueleto; últimos segundos: aviso en el anillo', () => {
    const { container, rerender } = renderWithProviders(<DynamicQrCode qr={null} phase="loading" progress={0} remaining={0} alt="QR" onRenew={vi.fn()} />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    rerender(<DynamicQrCode qr={qr(1)} phase="ready" progress={0.1} remaining={3} alt="QR" onRenew={vi.fn()} />);
    expect(container.querySelector('.dynamic-qr')).toHaveClass('is-ending');
  });
});
