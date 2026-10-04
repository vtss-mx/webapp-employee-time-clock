import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import type { CameraController, CameraStatus, UseCameraOptions } from '../hooks/useCamera';
import { QrScanPanel } from './QrScanPanel';

// La cámara (getUserMedia) y la lectura con jsQR tienen sus propias pruebas; aquí, qué hace el panel
// con cada código leído y cuándo pausa la lectura.
const camera = vi.hoisted((): { status: CameraStatus; requested: UseCameraOptions[] } => ({ status: 'active', requested: [] }));
vi.mock('../hooks/useCamera', () => ({
  useCamera: (options: UseCameraOptions): Partial<CameraController> => {
    camera.requested.push(options);
    return { videoRef: { current: null }, facing: options.facing, status: camera.status, devices: [], activeDeviceId: null, isMirrored: false, problem: null, start: () => Promise.resolve() };
  },
}));
const scanner = vi.hoisted(() => ({ enabled: false, onDetect: (_content: string): void | Promise<void> => undefined }));
vi.mock('../hooks/useQrScanner', () => ({
  useQrScanner: (options: { enabled: boolean; onDetect: (content: string) => void | Promise<void> }) => {
    scanner.enabled = options.enabled;
    scanner.onDetect = options.onDetect;
  },
}));

const withPopups = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;
const message = () => screen.getByRole('status');
const detect = (content: string) => act(() => Promise.resolve().then(() => void scanner.onDetect(content)));

/** onScan que la prueba termina cuando quiere (el backend está validando). */
function pendingScan() {
  let finish: () => void = () => undefined;
  const onScan = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  return { onScan, finish: () => act(() => Promise.resolve().then(() => finish())) };
}

function renderPanel(props: Partial<Parameters<typeof QrScanPanel>[0]> = {}) {
  const onCancel = vi.fn();
  const view = render(<QrScanPanel title="Identifícate con tu QR" description="Muestra tu código" onScan={() => Promise.resolve()} onCancel={onCancel} {...props} />, { wrapper: withPopups });
  return { ...view, onCancel };
}

beforeEach(() => {
  vi.useFakeTimers();
  camera.status = 'active';
  camera.requested = [];
});
afterEach(() => vi.useRealTimers());

describe('QrScanPanel', () => {
  it('lee con la cámara trasera; un QR de la app se valida con la lectura en pausa y después sigue', async () => {
    const { onScan, finish } = pendingScan();
    renderPanel({ onScan });
    expect(camera.requested[0]).toEqual({ facing: 'environment' });
    expect(screen.getByRole('heading', { name: 'Identifícate con tu QR' })).toBeInTheDocument();
    expect(message()).toHaveTextContent('Apunta la cámara al código QR');
    expect(scanner.enabled).toBe(true);

    await detect('TCQR2:abc');
    expect(onScan).toHaveBeenCalledWith('TCQR2:abc');
    expect(message()).toHaveTextContent('QR detectado. Verificando...');
    expect(message()).toHaveClass('camera__message--busy');
    expect(scanner.enabled).toBe(false); // no se lee otro mientras tanto

    await finish();
    expect(message()).toHaveTextContent('Apunta la cámara al código QR');
    expect(scanner.enabled).toBe(true);
  });

  it('un QR ajeno o demasiado largo se rechaza al instante y la lectura sigue a los 2 s', async () => {
    const onScan = vi.fn(() => Promise.resolve());
    renderPanel({ onScan });
    await detect('https://otro-sitio.com/promo');
    expect(message()).toHaveTextContent('QR inválido. Usa el código generado para tu cuenta');
    expect(message()).toHaveClass('camera__message--warn');
    expect(scanner.enabled).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(scanner.enabled).toBe(true);

    await detect(`TCQR2:${'x'.repeat(600)}`);
    expect(message()).toHaveTextContent('QR inválido');
    expect(onScan).not.toHaveBeenCalled();
  });

  it('mensajes y botón personalizables; cancelar sale del lector', async () => {
    const { onScan } = pendingScan();
    const { onCancel } = renderPanel({ onScan, busyMessage: 'Registrando entrada...', invalidMessage: 'Ese código no es de esta empresa', cancelLabel: 'Volver' });
    await detect('OTRO');
    expect(message()).toHaveTextContent('Ese código no es de esta empresa');
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    await detect('TCQR2:abc');
    expect(message()).toHaveTextContent('Registrando entrada...');
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('sin imagen de la cámara (pidiendo permiso) no intenta leer', () => {
    camera.status = 'requesting';
    renderPanel();
    expect(scanner.enabled).toBe(false);
  });

  it('al salir mientras se valida o durante el aviso de QR inválido, no actualiza la pantalla', async () => {
    const { onScan, finish } = pendingScan();
    const validating = renderPanel({ onScan });
    await detect('TCQR2:abc');
    validating.unmount();
    await finish();
    expect(onScan).toHaveBeenCalledOnce();

    const invalid = renderPanel();
    await detect('OTRO');
    invalid.unmount();
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
