import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DynamicQrCode } from '../components/DynamicQrCode';
import { FeedbackProvider } from '../context/FeedbackContext';
import { useQrImage } from './useQrImage';

// Cuántas veces seguidas falla el dibujo (la librería no se pudo usar).
const qrLibrary = vi.hoisted(() => ({ failures: 0 }));
vi.mock('qrcode', () => ({
  toDataURL: (text: string) => (qrLibrary.failures-- > 0 ? Promise.reject(new Error('Failed to fetch dynamically imported module')) : Promise.resolve(`data:image/png;base64,${text}`)),
}));

afterEach(() => {
  qrLibrary.failures = 0;
});

const qr = { id: 1, employee_number: 'EMP-7', created_at: 'x', expires_at: 'y', lifetime_seconds: 30, content: 'TCQR2:token-1' };

describe('useQrImage', () => {
  it('dibuja el código del texto actual', async () => {
    const { result } = renderHook(() => useQrImage('https://app/login'));
    await waitFor(() => expect(result.current.src).toBe('data:image/png;base64,https://app/login'));
    expect(result.current.error).toBeNull();
  });

  it('si no se puede dibujar devuelve el error (no se queda cargando) y `retry` lo intenta de nuevo', async () => {
    qrLibrary.failures = 1;
    const { result } = renderHook(() => useQrImage('TCQR2:x'));
    await waitFor(() => expect(result.current.error?.message).toMatch(/No se pudo preparar el código QR/));
    expect(result.current.src).toBeNull();
    act(() => result.current.retry());
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.src).toBe('data:image/png;base64,TCQR2:x'));
  });

  it('sin texto no dibuja nada', () => {
    const { result } = renderHook(() => useQrImage(null));
    expect(result.current).toMatchObject({ src: null, error: null });
  });
});

describe('DynamicQrCode: el código no se pudo dibujar', () => {
  it('lo explica en el popup y en su lugar ofrece "Reintentar" (nunca un esqueleto eterno)', async () => {
    qrLibrary.failures = 1;
    const onRenew = vi.fn();
    const { container } = render(<DynamicQrCode qr={qr} phase="ready" deadline={Date.now() + 30_000} alt="QR" onRenew={onRenew} />, { wrapper: FeedbackProvider });
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo mostrar tu código QR' });
    expect(within(popup).getByText(/Revisa tu conexión/)).toBeInTheDocument();
    const code = container.querySelector<HTMLElement>('.dynamic-qr');
    expect(code).toHaveClass('dynamic-qr--error');
    expect(container.querySelector('.skeleton')).toBeNull();
    await userEvent.click(within(code as HTMLElement).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByAltText('QR')).toHaveAttribute('src', 'data:image/png;base64,TCQR2:token-1');
    expect(onRenew).not.toHaveBeenCalled(); // reintenta dibujar el mismo código, no pide otro
  });

  it('"Reintentar" del popup también vuelve a dibujarlo', async () => {
    qrLibrary.failures = 1;
    render(<DynamicQrCode qr={qr} phase="ready" deadline={Date.now() + 30_000} alt="QR" onRenew={vi.fn()} />, { wrapper: FeedbackProvider });
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo mostrar tu código QR' });
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByAltText('QR')).toBeInTheDocument();
  });
});
