import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import type { CameraController } from '../hooks/useCamera';
import { setLocale } from '../i18n/core';
import { describeCameraProblem, type CameraProblem } from '../utils/cameraDiagnostics';
import { CameraCapture } from './CameraCapture';

/** Cámara en el estado que se quiere mostrar (la lógica real de getUserMedia vive en useCamera). */
function cameraIn(state: Partial<CameraController> = {}): CameraController {
  return {
    videoRef: { current: null },
    facing: 'user',
    status: 'active',
    error: null,
    problem: null,
    devices: [],
    activeDeviceId: 'cam-1',
    activeLabel: 'Cámara frontal',
    trackLabel: 'FaceTime HD Camera',
    isMirrored: false,
    start: vi.fn(() => Promise.resolve()),
    requestAccess: vi.fn(),
    stop: vi.fn(),
    switchCamera: vi.fn(),
    selectCamera: vi.fn(),
    captureFrame: vi.fn(),
    videoTrack: () => null,
    ...state,
  };
}

const MAC_CHROME = { os: 'macos', browser: 'chrome' } as const;
const LOCAL = { protocol: 'https:', hostname: 'localhost', pathname: '/', search: '' };
const problemOf = (kind: CameraProblem['kind'], location = LOCAL) => describeCameraProblem(kind, MAC_CHROME, location);

const withPopups = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;

function renderCamera(camera: CameraController) {
  const ui = (next: CameraController) => (
    <CameraCapture camera={next} className="camera--fill">
      <p>Guía sobre la cámara</p>
    </CameraCapture>
  );
  const view = render(ui(camera), { wrapper: withPopups });
  return { ...view, rerenderCamera: (next: CameraController) => view.rerender(ui(next)) };
}

const popup = () => screen.findByRole('alertdialog');

afterEach(() => vi.unstubAllGlobals());

describe('CameraCapture: visor de la cámara', () => {
  it('activa: video en vivo con su capa (guía) y, con espejo, la imagen invertida como en un espejo', () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { container, rerenderCamera } = renderCamera(cameraIn({ isMirrored: true }));
    const video = screen.getByLabelText('Vista previa de la cámara');
    expect(video).toHaveClass('camera__video--mirrored');
    expect(screen.getByText('Guía sobre la cámara')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('camera', 'camera--fill');
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' }); // el visor queda completo a la vista
    rerenderCamera(cameraIn({ isMirrored: false }));
    expect(screen.getByLabelText('Vista previa de la cámara')).not.toHaveClass('camera__video--mirrored');
    expect(screen.queryByRole('button', { name: 'Cambiar cámara' })).toBeNull(); // una sola cámara
  });

  it('escribe en el visor la relación de aspecto real del flujo (--video-ar) al conocerla y si cambia; sin imagen no escribe nada', () => {
    const { container } = renderCamera(cameraIn());
    const box = container.firstChild as HTMLElement;
    const video = screen.getByLabelText('Vista previa de la cámara');
    Object.defineProperty(video, 'videoWidth', { value: 0, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 0, configurable: true });
    fireEvent.loadedMetadata(video);
    expect(box.style.getPropertyValue('--video-ar')).toBe(''); // aún sin imagen: el CSS usa su valor por omisión
    Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
    fireEvent.loadedMetadata(video);
    expect(box.style.getPropertyValue('--video-ar')).toBe('1.7778'); // computadora portátil: 16:9 horizontal
    Object.defineProperty(video, 'videoWidth', { value: 720, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1280, configurable: true });
    fireEvent(video, new Event('resize')); // el teléfono giró: el flujo ahora es vertical
    expect(box.style.getPropertyValue('--video-ar')).toBe('0.5625');
  });

  it.each([
    ['user', 'La cámara frontal se usará unos segundos para verificar tu identidad.'],
    ['environment', 'La cámara se usará unos segundos para leer el código QR.'],
  ] as const)('mientras el navegador pide el permiso (%s) explica para qué se usa', (facing, text) => {
    renderCamera(cameraIn({ status: 'requesting', facing }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Activando la cámara…');
    expect(status).toHaveTextContent(text);
    expect(screen.queryByText('Guía sobre la cámara')).toBeNull();
  });

  it('en pausa: "Activar cámara" reabre la misma (o la del propósito si no había)', async () => {
    const paused = cameraIn({ status: 'idle' });
    const { rerenderCamera } = renderCamera(paused);
    expect(screen.getByText('Cámara en pausa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Activar cámara' }));
    expect(paused.start).toHaveBeenCalledWith('cam-1');

    const unknown = cameraIn({ status: 'idle', activeDeviceId: null });
    rerenderCamera(unknown);
    await userEvent.click(screen.getByRole('button', { name: 'Activar cámara' }));
    expect(unknown.start).toHaveBeenCalledWith(undefined);
  });

  it('varias cámaras: cambiar con un toque o elegir de la lista (con el nombre real como ayuda)', async () => {
    const camera = cameraIn({
      devices: [
        { deviceId: 'cam-1', label: 'Cámara frontal', rawLabel: 'Front Camera', kind: 'front' },
        { deviceId: 'cam-2', label: 'Cámara trasera', rawLabel: 'Back Camera', kind: 'back' },
      ],
    });
    renderCamera(camera);
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar cámara' }));
    expect(camera.switchCamera).toHaveBeenCalled();
    const select = screen.getByRole('button', { name: /Seleccionar cámara/ });
    expect(select).toHaveTextContent('Cámara frontal');
    expect(select).toHaveAttribute('title', 'Cámara frontal'); // nunca el nombre en crudo del sistema (otro idioma)
    await userEvent.click(select);
    await userEvent.click(screen.getByRole('option', { name: /Cámara trasera/ }));
    expect(camera.selectCamera).toHaveBeenCalledWith('cam-2');
  });

  it('varias cámaras sin una abierta todavía: la lista no marca ninguna', () => {
    renderCamera(cameraIn({ activeDeviceId: null, devices: [{ deviceId: 'a', label: 'Cámara 1', rawLabel: 'USB', kind: 'unknown' }, { deviceId: 'b', label: 'Cámara 2', rawLabel: 'BRIO', kind: 'unknown' }] }));
    expect(screen.getByRole('button', { name: /Seleccionar cámara/ })).toHaveTextContent('Selecciona una opción');
  });
});

describe('CameraCapture: fallas de la cámara en el popup', () => {
  it('permiso bloqueado: popup con los pasos; "Reintentar" (del popup o del visor) vuelve a abrirla', async () => {
    const camera = cameraIn({ status: 'error', problem: problemOf('denied') });
    renderCamera(camera);
    const dialog = await popup();
    expect(dialog).toHaveTextContent('El permiso de cámara está bloqueado');
    expect(dialog).toHaveTextContent('Ajustes del Sistema');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reintentar' }));
    expect(camera.start).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' })); // el del visor
    expect(camera.start).toHaveBeenCalledTimes(2);
  });

  it('cerrar el popup no reintenta (el visor sigue ofreciendo "Reintentar")', async () => {
    const camera = cameraIn({ status: 'error', problem: problemOf('busy') });
    renderCamera(camera);
    const dialog = await popup();
    expect(dialog).toHaveTextContent('No se pudo iniciar la cámara');
    await userEvent.click(within(dialog).getByText('Cerrar'));
    expect(camera.start).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('conexión no segura: "Abrir versión segura" lleva a la dirección HTTPS', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const problem = problemOf('insecure', { protocol: 'http:', hostname: '192.168.1.20', pathname: '/verificar', search: '?a=1' });
    renderCamera(cameraIn({ status: 'error', problem }));
    await userEvent.click(within(await popup()).getByRole('button', { name: 'Abrir versión segura' }));
    expect(assign).toHaveBeenCalledWith('https://192.168.1.20:8443/verificar?a=1');
  });

  it('"Abrir versión segura" sin dirección segura conocida no navega', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    // El popup ofrece la versión segura, pero la cámara ya cambió de problema cuando se elige.
    const problem: CameraProblem = { ...problemOf('insecure', { protocol: 'http:', hostname: '10.0.0.5', pathname: '/', search: '' }) };
    renderCamera(cameraIn({ status: 'error', problem }));
    const dialog = await popup();
    delete problem.secureUrl;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Abrir versión segura' }));
    expect(assign).not.toHaveBeenCalled();
  });

  it('si la cámara se recupera sola, el popup se retira; un error sin diagnóstico no abre popup', async () => {
    const { rerenderCamera } = renderCamera(cameraIn({ status: 'error', problem: problemOf('not-found') }));
    expect(await popup()).toHaveTextContent('No se detectó ninguna cámara');
    rerenderCamera(cameraIn({ status: 'active' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    rerenderCamera(cameraIn({ status: 'error', problem: null }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('CameraCapture en inglés (en-US) y cambio de idioma en caliente', () => {
  it('el popup de un problema abierto cambia de idioma sin cerrarse ni reintentar', async () => {
    const camera = cameraIn({ status: 'error', problem: problemOf('denied') });
    renderCamera(camera);
    expect(await popup()).toHaveTextContent('El permiso de cámara está bloqueado');

    await act(() => setLocale('en-US'));
    const dialog = screen.getByRole('alertdialog', { name: 'Camera permission is blocked' });
    expect(dialog).toHaveTextContent("Chrome or the system won't let this page use the camera.");
    expect(dialog).toHaveTextContent('Privacy & Security → Camera → turn on Chrome');
    expect(dialog).toHaveTextContent('Press "Retry".');
    expect(camera.start).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));
    expect(camera.start).toHaveBeenCalledOnce();
  });

  it('el visor en inglés: permiso, pausa y varias cámaras', async () => {
    await setLocale('en-US');
    const { rerenderCamera } = renderCamera(cameraIn({ status: 'requesting', facing: 'environment' }));
    expect(screen.getByRole('status')).toHaveTextContent('Turning on the camera…The camera will be used for a few seconds to read the QR code.');
    rerenderCamera(cameraIn({ status: 'idle' }));
    expect(screen.getByText('Camera paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn on camera' })).toBeInTheDocument();
    rerenderCamera(
      cameraIn({
        devices: [
          { deviceId: 'cam-1', label: 'Front camera', rawLabel: 'Front Camera', kind: 'front' },
          { deviceId: 'cam-2', label: 'Back camera', rawLabel: 'Back Camera', kind: 'back' },
        ],
      }),
    );
    expect(screen.getByLabelText('Camera preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch camera' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Select camera/ })).toHaveTextContent('Front camera');
    expect(screen.getByRole('button', { name: /Select camera/ })).toHaveAttribute('title', 'Front camera');
  });

  it('conexión no segura en inglés: abrir la versión segura', async () => {
    await setLocale('en-US');
    renderCamera(cameraIn({ status: 'error', problem: problemOf('insecure', { protocol: 'http:', hostname: '192.168.1.20', pathname: '/', search: '' }) }));
    const dialog = await screen.findByRole('alertdialog', { name: 'The camera needs a secure connection' });
    expect(dialog).toHaveTextContent('Camera');
    expect(within(dialog).getByRole('button', { name: 'Open secure version' })).toBeInTheDocument();
  });
});
