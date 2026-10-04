import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { resetPolicyCache } from '../hooks/useVerificationPolicy';
import { samplePolicy } from '../test/fixtures';
import { apiFail, mockFetch, type MockCall } from '../test/http';
import { renderWithProviders } from '../test/render';
import { CameraNotReadyError } from '../utils/cameraDiagnostics';
import { LiveFaceFlow } from './LiveFaceFlow';

// La cámara real (getUserMedia) y MediaPipe se prueban en navegador; aquí, cómo reacciona el flujo a
// las fallas: una cámara siempre activa y la captura manual (detección automática no disponible).
const camera = vi.hoisted(() => ({ capture: vi.fn<() => Promise<Blob>>() }));
vi.mock('../hooks/useCamera', () => ({
  useCamera: () => ({
    videoRef: { current: null },
    facing: 'user',
    status: 'active',
    error: null,
    problem: null,
    devices: [],
    activeDeviceId: null,
    activeLabel: 'Cámara frontal',
    trackLabel: 'FaceTime HD Camera',
    isMirrored: true,
    start: () => Promise.resolve(),
    requestAccess: () => undefined,
    stop: () => undefined,
    switchCamera: () => undefined,
    selectCamera: () => undefined,
    captureFrame: camera.capture,
  }),
}));
vi.mock('../hooks/useFaceDetection', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useFaceDetector: () => ({ detector: null, error: 'Detección automática no disponible', loading: false }),
  useFaceAutoCapture: () => ({ guidance: 'ready', progress: 0, moveProgress: 0 }),
}));

const BLOCKED = 'Intentemos de nuevo';
let onFatal: Mock<(error: unknown) => void>;

function renderFlow(check: (call: MockCall) => Response | Promise<Response>) {
  const server = mockFetch((call) => (call.url.includes('/face/check') ? check(call) : apiFail(404, 'NOT_FOUND')));
  renderWithProviders(
    <LiveFaceFlow title="Registro facial" frontalFrames={1} submittingMessage="Enviando..." policy={samplePolicy} onSubmit={() => Promise.resolve()} onFatal={onFatal} onCancel={() => undefined} />,
  );
  return server.calls;
}

/** "Capturar" (captura manual) y deja que el flujo procese la respuesta. */
async function capture() {
  fireEvent.click(screen.getByRole('button', { name: 'Capturar' }));
  await act(() => vi.advanceTimersByTimeAsync(0));
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const blocked = () => screen.queryByRole('heading', { name: BLOCKED });

beforeEach(() => {
  vi.useFakeTimers();
  onFatal = vi.fn<(error: unknown) => void>();
  camera.capture.mockResolvedValue(new Blob(['jpeg']));
});
afterEach(() => {
  vi.useRealTimers();
  resetPolicyCache();
});

describe('LiveFaceFlow ante fallas pasajeras', () => {
  it('servidor saturado: espera lo que pide (Retry-After), reintenta una vez y después se rinde con el error', async () => {
    const calls = renderFlow(() => apiFail(503, 'SERVER_BUSY', 'Servidor ocupado', { 'Retry-After': '8' }));
    await capture();
    expect(blocked()).toBeInTheDocument();
    await advance(5_000);
    expect(blocked()).toBeInTheDocument(); // la pausa normal (3 s) no basta: el servidor pidió 8 s
    await advance(3_000);
    expect(blocked()).toBeNull();
    expect(onFatal).not.toHaveBeenCalled();

    await capture();
    // Segunda falla seguida: no vuelve a subir las capturas; la pantalla ofrece "Reintentar".
    expect(onFatal).toHaveBeenCalledWith(expect.objectContaining({ code: 'SERVER_BUSY' }));
    expect(calls.filter((c) => c.url.includes('/face/check'))).toHaveLength(2);
  });

  it('sin conexión: no reanuda (ni vuelve a subir) hasta que regresa la red', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderFlow(() => Promise.reject(new TypeError('Failed to fetch')));
    await capture();
    expect(blocked()).toBeInTheDocument();
    await advance(30_000);
    expect(blocked()).toBeInTheDocument();
    online.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(blocked()).toBeNull();
    expect(onFatal).not.toHaveBeenCalled();
  });

  it('cámara sin imagen al capturar (cortada por una llamada): espera y continúa, no abandona', async () => {
    camera.capture.mockRejectedValue(new CameraNotReadyError());
    renderFlow(() => apiFail(404, 'NOT_FOUND'));
    for (let i = 0; i < 3; i++) {
      await capture();
      expect(blocked()).toBeInTheDocument();
      await advance(3_000);
      expect(blocked()).toBeNull();
    }
    expect(onFatal).not.toHaveBeenCalled();
  });

  it('un error que no se corrige reintentando termina al instante', async () => {
    renderFlow(() => apiFail(403, 'FORBIDDEN', 'Sin permiso'));
    await capture();
    expect(onFatal).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(blocked()).toBeNull();
  });
});
