import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import type { CameraController } from '../hooks/useCamera';
import { useCamera } from '../hooks/useCamera';
import { useDocumentScan, type DocumentScanState } from '../hooks/useDocumentScan';
import { setLocale } from '../i18n/core';
import { CameraNotReadyError } from '../utils/cameraDiagnostics';
import { DocumentScanner } from './DocumentScanner';

vi.mock('../hooks/useCamera', () => ({ useCamera: vi.fn() }));
vi.mock('../hooks/useDocumentScan', () => ({ useDocumentScan: vi.fn() }));

const camera = vi.mocked(useCamera);
const scan = vi.mocked(useDocumentScan);

/** Cámara ya activa; la captura devuelve un JPEG. */
function cameraIn(over: Partial<CameraController> = {}): CameraController {
  return {
    videoRef: { current: null },
    facing: 'environment',
    status: 'active',
    error: null,
    problem: null,
    devices: [],
    activeDeviceId: 'cam-1',
    activeLabel: 'Cámara trasera',
    trackLabel: 'Back Camera',
    isMirrored: false,
    start: vi.fn(() => Promise.resolve()),
    requestAccess: vi.fn(),
    stop: vi.fn(),
    switchCamera: vi.fn(),
    selectCamera: vi.fn(),
    captureFrame: vi.fn(() => Promise.resolve(new Blob(['jpeg'], { type: 'image/jpeg' }))),
    videoTrack: () => null,
    ...over,
  };
}

/** Deja pasar `autoCapture`: la función que `DocumentScanner` dispara cuando el documento está bien encuadrado. */
let autoCapture: () => void;
function scanIn(state: Partial<DocumentScanState> = {}): DocumentScanState {
  return { guidance: 'searching', acceptable: false, stalled: false, ...state };
}

/** Una promesa que la prueba resuelve o rechaza cuando quiere (la foto que aún no llega de la cámara). */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Ejecuta lo que la prueba decide (resolver o rechazar la foto) y deja que React asiente lo que provoca. */
const settle = (action: () => void) =>
  act(async () => {
    action();
    await Promise.resolve();
  });

const withPopups = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;

function renderScanner({ cam = cameraIn(), state = scanIn(), onCapture = vi.fn(), onCancel = vi.fn() }: { cam?: CameraController; state?: DocumentScanState; onCapture?: (file: File) => void; onCancel?: () => void } = {}) {
  camera.mockReturnValue(cam);
  scan.mockImplementation((opts) => {
    autoCapture = opts.onAutoCapture;
    return state;
  });
  const view = render(<DocumentScanner onCapture={onCapture} onCancel={onCancel} />, { wrapper: withPopups });
  return { ...view, cam, onCapture, onCancel };
}

const shutter = () => screen.getByRole('button', { name: 'Tomar foto' });

beforeEach(() => {
  camera.mockReset();
  scan.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('DocumentScanner: escáner de documento', () => {
  it('muestra la guía y la indicación del estado; el obturador espera a un cuadro válido', () => {
    const { container } = renderScanner();
    expect(screen.getByRole('heading', { name: 'Foto del documento' })).toBeInTheDocument();
    expect(screen.getByText('Coloca el documento en la guía')).toBeInTheDocument();
    expect(container.querySelector('.doc-scan--idle')).not.toBeNull();
    expect(shutter()).toBeDisabled(); // aún no hay documento
  });

  it('cuando el cuadro sirve: tono verde, «Mantén firme» y obturador habilitado', () => {
    const { container } = renderScanner({ state: scanIn({ guidance: 'holdStill', acceptable: true }) });
    expect(screen.getByText('Mantén firme')).toBeInTheDocument();
    expect(container.querySelector('.doc-scan--ok')).not.toBeNull();
    expect(shutter()).toBeEnabled();
  });

  it('un cuadro que sirve pero se mueve avisa en ámbar', () => {
    const { container } = renderScanner({ state: scanIn({ guidance: 'holdStill', acceptable: false }) });
    expect(container.querySelector('.doc-scan--warn')).not.toBeNull();
  });

  it('el obturador manual toma la foto y la entrega como un archivo JPEG', async () => {
    const { cam, onCapture } = renderScanner({ state: scanIn({ guidance: 'holdStill', acceptable: true }) });
    await userEvent.click(shutter());
    expect(cam.captureFrame).toHaveBeenCalledWith({ maxSide: 1600, quality: 0.85 });
    await waitFor(() => expect(onCapture).toHaveBeenCalledOnce());
    const file = vi.mocked(onCapture).mock.calls[0][0];
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/jpeg');
    expect(file.name).toMatch(/^documento-\d+\.jpg$/);
  });

  it('la captura automática usa el mismo camino que el obturador', async () => {
    const { onCapture } = renderScanner({ state: scanIn({ guidance: 'capturing', acceptable: true }) });
    act(() => {
      autoCapture();
    });
    await waitFor(() => expect(onCapture).toHaveBeenCalledOnce());
  });

  it('una falla al tomar la foto abre el popup y deja reintentar', async () => {
    const cam = cameraIn({ captureFrame: vi.fn(() => Promise.reject(new Error('boom'))) });
    const { onCapture } = renderScanner({ cam, state: scanIn({ guidance: 'holdStill', acceptable: true }) });
    await userEvent.click(shutter());
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('No se pudo tomar la foto');
    expect(onCapture).not.toHaveBeenCalled();
    expect(shutter()).toBeEnabled(); // vuelve a estar disponible
  });

  it('un disparo automático mientras ya se está capturando no toma una segunda foto', async () => {
    const photo = deferred<Blob>();
    const cam = cameraIn({ captureFrame: vi.fn(() => photo.promise) });
    const { onCapture } = renderScanner({ cam, state: scanIn({ guidance: 'holdStill', acceptable: true }) });
    await userEvent.click(shutter()); // el obturador manual empieza a capturar y la foto aún no llega
    act(() => {
      autoCapture(); // el detector dispara justo ahora, antes de que el visor se entere de que ya hay una captura
    });
    expect(cam.captureFrame).toHaveBeenCalledOnce();
    await settle(() => photo.resolve(new Blob(['jpeg'], { type: 'image/jpeg' })));
    await waitFor(() => expect(onCapture).toHaveBeenCalledOnce()); // una sola foto entregada
  });

  it('si la pantalla se cierra a media captura, la foto que llega después se descarta (no se entrega)', async () => {
    const photo = deferred<Blob>();
    const { onCapture, cam, rerender } = renderScanner({ cam: cameraIn({ captureFrame: vi.fn(() => photo.promise) }), state: scanIn({ guidance: 'holdStill', acceptable: true }) });
    await userEvent.click(shutter());
    rerender(<p>Otra pantalla</p>); // el escáner se desmonta; los popups de la app siguen montados
    await settle(() => photo.resolve(new Blob(['jpeg'], { type: 'image/jpeg' })));
    expect(cam.captureFrame).toHaveBeenCalledOnce();
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('si la pantalla se cierra a media captura, la falla que llega después no abre ningún popup', async () => {
    const photo = deferred<Blob>();
    const { onCapture, rerender } = renderScanner({ cam: cameraIn({ captureFrame: vi.fn(() => photo.promise) }), state: scanIn({ guidance: 'holdStill', acceptable: true }) });
    await userEvent.click(shutter());
    rerender(<p>Otra pantalla</p>);
    await settle(() => photo.reject(new Error('boom')));
    expect(screen.queryByRole('alertdialog')).toBeNull(); // el aviso de la captura no aparece sobre otra pantalla
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('«la cámara aún no da imagen» es pasajero: no abre popup', async () => {
    const cam = cameraIn({ captureFrame: vi.fn(() => Promise.reject(new CameraNotReadyError())) });
    renderScanner({ cam, state: scanIn({ guidance: 'holdStill', acceptable: true }) });
    await userEvent.click(shutter());
    await waitFor(() => expect(shutter()).toBeEnabled());
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('sin un cuadro válido por un rato, el obturador se habilita igual (nunca un callejón sin salida)', () => {
    renderScanner({ state: scanIn({ acceptable: false, stalled: true }) });
    expect(shutter()).toBeEnabled();
  });

  it('«Cancelar» vuelve a «Elegir archivo» (no se queda en la cámara)', async () => {
    const { onCancel } = renderScanner();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('en inglés (en-US)', async () => {
    await setLocale('en-US');
    renderScanner({ state: scanIn({ guidance: 'holdStill', acceptable: true }) });
    expect(screen.getByRole('heading', { name: 'Document photo' })).toBeInTheDocument();
    expect(screen.getByText('Hold steady')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeEnabled();
  });
});
