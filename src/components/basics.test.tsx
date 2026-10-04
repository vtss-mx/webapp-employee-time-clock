import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { samplePolicy } from '../test/fixtures';
import { apiOk, mockFetch } from '../test/http';
import { renderWithProviders } from '../test/render';
import { CountUp } from './CountUp';
import { ErrorBoundary } from './ErrorBoundary';
import { FormField } from './FormField';
import { ConfirmDialog, Modal } from './Modal';
import { QrCodePanel } from './QrCodePanel';
import { Spinner } from './Spinner';
import { VerificationAttempt } from './VerificationAttempt';

/** Opciones de presentación y salidas de los componentes base que no cubren las pantallas. */

afterEach(() => vi.unstubAllGlobals());

describe('presentación', () => {
  it('CountUp: con "reducir movimiento" muestra el valor final sin animar', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    render(<CountUp value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(raf).not.toHaveBeenCalled();
  });

  it('Spinner claro (sobre fondos oscuros) con su tamaño', () => {
    render(<Spinner light size={16} />);
    const spinner = screen.getByRole('status', { name: 'Cargando' });
    expect(spinner).toHaveClass('spinner--light');
    expect(spinner).toHaveStyle({ width: '16px', height: '16px' });
  });

  it('Modal ancho y confirmaciones que no son peligrosas (diálogo, no alerta)', () => {
    render(
      <Modal open title="Código QR" wide onClose={() => undefined}>
        contenido
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Código QR' })).toHaveClass('msg--wide');
    render(<ConfirmDialog open title="Aprobar registro" message="¿Aprobar?" tone="success" onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Aprobar registro' })).toHaveClass('msg--success');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('contraseña: "Mostrar" la deja ver y "Ocultar" la vuelve a ocultar', async () => {
    render(<FormField label="Contraseña" type="password" defaultValue="Secreta1" />);
    const input = screen.getByLabelText('Contraseña');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});

describe('salidas', () => {
  it('ErrorBoundary: "Ir al inicio" carga la raíz de la aplicación', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    function Broken(): never {
      throw new Error('falla de dibujo');
    }
    render(
      <ErrorBoundary inline>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveClass('error-inline');
    await userEvent.click(screen.getByRole('button', { name: 'Ir al inicio' }));
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('VerificationAttempt: sin destino propio, "Cambiar método" vuelve al inicio del empleado', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/employee/verify" element={<VerificationAttempt failureTitle={() => 'No te reconocimos'}>{(finish) => <button onClick={() => finish({ result: null, error: 'Rostro no reconocido' })}>capturar</button>}</VerificationAttempt>} />
        <Route path="/employee/dashboard" element={<p>Inicio del empleado</p>} />
      </Routes>,
      { route: '/employee/verify' },
    );
    await userEvent.click(screen.getByRole('button', { name: 'capturar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar método' }));
    expect(screen.getByText('Inicio del empleado')).toBeInTheDocument();
  });

  it('QrCodePanel: cancelar la invalidación deja el código vigente', async () => {
    const live = { live: true, live_until: '2026-10-03T12:00:30Z', last_issued_at: '2026-10-03T12:00:00Z', last_used_at: '2026-10-03T12:00:10Z' };
    const { calls } = mockFetch((call) => (call.url.includes('/settings/') ? apiOk(samplePolicy) : apiOk(live)));
    renderWithProviders(<QrCodePanel employeeId={5} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Invalidar código vigente' }));
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Invalidar el código vigente' })).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('En pantalla')).toBeInTheDocument();
    expect(calls.some((call) => call.init.method === 'DELETE')).toBe(false);
  });
});
