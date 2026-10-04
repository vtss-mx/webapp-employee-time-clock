import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DynamicQrCode, QrCountdown } from '../../components/DynamicQrCode';
import { FeedbackProvider } from '../../context/FeedbackContext';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders, sampleUser } from '../../test/render';
import { MyQrPage } from './MyQrPage';

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: sampleUser }) }));
// El teléfono dibuja el código a partir de su contenido: la imagen de prueba lo lleva tal cual.
vi.mock('qrcode', () => ({ toDataURL: (text: string) => Promise.resolve(`data:image/png;base64,${text}`) }));

const qr = (id: number) => ({ id, employee_number: 'EMP-7', created_at: 'x', expires_at: 'y', lifetime_seconds: 30, content: `TCQR2:token-${id}` });

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
    expect(await screen.findByAltText('Código QR de Ana Ruiz')).toHaveAttribute('src', 'data:image/png;base64,TCQR2:token-1');
    expect(screen.getByText(/Se renueva en/)).toHaveTextContent(/30 s|29 s/);
    expect(screen.getByText(/Cambia cada 30 s y sirve una sola vez/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descargar/ })).toBeNull(); // un QR dinámico no se descarga

    await userEvent.click(screen.getByRole('button', { name: 'Generar otro' }));
    await waitFor(() => expect(screen.getAllByAltText('Código QR de Ana Ruiz')[0]).toHaveAttribute('src', 'data:image/png;base64,TCQR2:token-2'));
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
    renderWithProviders(<DynamicQrCode qr={qr(1)} phase={phase} deadline={0} alt="QR" onRenew={onRenew} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    if (action) {
      await userEvent.click(screen.getByRole('button', { name: action }));
      expect(onRenew).toHaveBeenCalled();
    }
  });

  it('cargando: esqueleto; vigente: el anillo sigue la vigencia desde el punto en que va', () => {
    // El código explica en el popup si no se puede dibujar: necesita los mensajes también al redibujarse.
    const { container, rerender } = render(<DynamicQrCode qr={null} phase="loading" deadline={0} alt="QR" onRenew={vi.fn()} />, { wrapper: FeedbackProvider });
    expect(container.querySelector('.skeleton')).not.toBeNull();
    const deadline = Date.now() + 3_000; // faltan 3 de 30 s: ya en los últimos segundos
    rerender(<DynamicQrCode qr={qr(1)} phase="ready" deadline={deadline} alt="QR" onRenew={vi.fn()} />);
    const ring = container.querySelector<HTMLElement>('.dynamic-qr--ready');
    expect(ring?.style.getPropertyValue('--qr-life')).toBe('30s');
    expect(parseFloat(ring?.style.getPropertyValue('--qr-drain-delay') ?? '')).toBeCloseTo(-27, 0);
    expect(parseFloat(ring?.style.getPropertyValue('--qr-warn-delay') ?? '')).toBeLessThan(0); // ámbar desde ya
  });

  it('la cuenta regresiva baja cada segundo hasta cero', async () => {
    vi.useFakeTimers();
    renderWithProviders(<QrCountdown deadline={Date.now() + 2_500} />);
    expect(screen.getByText(/Se renueva en/)).toHaveTextContent('3 s');
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(screen.getByText(/Se renueva en/)).toHaveTextContent('2 s');
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(screen.getByText(/Se renueva en/)).toHaveTextContent('0 s');
    await act(() => vi.advanceTimersByTimeAsync(5_000)); // ya no programa más
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
