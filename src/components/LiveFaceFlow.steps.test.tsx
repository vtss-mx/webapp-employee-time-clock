import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/apiClient';
import { advance, camera, checkReporting, detection, ENROLLMENT, flow, FOUR_MOVES, heading, message, renderFlow, resetFaceFlow, see, serve, stable } from '../test/faceFlow';
import { apiOk } from '../test/http';
import { CameraNotReadyError } from '../utils/cameraDiagnostics';

/** Presiona el obturador «Tomar foto» de la foto inicial (decisión del dueño, 2026-10-07: se toma a mano). */
const shutter = () => screen.getByRole('button', { name: 'Tomar foto' });
async function takePhoto() {
  void act(() => fireEvent.click(shutter()));
  await advance(0);
}

/*
 * Los pasos INDEPENDIENTES del registro facial del propio empleado (decisión del dueño del producto, 2026-10-07):
 * `enrollmentStep="photo"` toma solo la foto inicial (una foto de frente, sin reto ni validación previa: el servidor la
 * valida al guardarla) y `enrollmentStep="captures"` toma las fotos válidas y los cuatro movimientos SIN la foto inicial
 * (ya se guardó). Sin el paso, el flujo de siempre (en persona): `LiveFaceFlow.liveness.test.tsx`.
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));

beforeEach(resetFaceFlow);
afterEach(() => vi.useRealTimers());

describe('LiveFaceFlow: la foto inicial (paso 1), a MANO (decisión del dueño, 2026-10-07)', () => {
  it('el obturador toma UNA foto y la envía: sin reto, sin validación previa y con cuatro etapas (sin prueba de vida)', async () => {
    const server = serve({ challenge: () => apiOk(FOUR_MOVES) });
    renderFlow({ ...ENROLLMENT, enrollmentStep: 'photo' });
    expect(screen.getByRole('list', { name: /^Etapa \d de 4$/ })).toBeInTheDocument(); // sin la etapa de la prueba de vida
    expect(detection.options?.onStable).toBeUndefined(); // no se auto-dispara: la foto inicial se toma a mano
    await takePhoto();
    expect(camera.capture).toHaveBeenCalledOnce();
    expect(flow.onSubmit).toHaveBeenCalledWith({ frontal: [camera.frames[0]], camera: 'FaceTime HD Camera', telemetry: expect.any(String) });
    expect(server.challenges()).toBe(0);
    expect(server.checks()).toBe(0);
  });

  it('el obturador solo se habilita con el cuadro válido (borde verde); fuera de posición o borroso se deshabilita y el borde va en rojo', () => {
    serve();
    renderFlow({ ...ENROLLMENT, enrollmentStep: 'photo' });
    // Por omisión el detector simulado está «quieto» (hold_still): cuadro válido → borde verde y obturador habilitado.
    expect(document.querySelector('.face-scan')).toHaveClass('face-scan--ok');
    expect(shutter()).toBeEnabled();
    // Fuera de la guía: no se puede tomar y el borde se pone en rojo.
    see({ guidance: 'off_center' });
    expect(shutter()).toBeDisabled();
    expect(document.querySelector('.face-scan')).toHaveClass('face-scan--bad');
    expect(message()).toHaveTextContent('Centra tu rostro');
    // Borroso (no enfocado): igual, rojo y deshabilitado.
    see({ guidance: 'blurry' });
    expect(shutter()).toBeDisabled();
    expect(document.querySelector('.face-scan')).toHaveClass('face-scan--bad');
    // Sin rostro todavía: el borde queda neutro (ni rojo ni verde) y el obturador deshabilitado.
    see({ guidance: 'no_face' });
    expect(document.querySelector('.face-scan')).toHaveClass('face-scan--idle');
    expect(shutter()).toBeDisabled();
    expect(camera.capture).not.toHaveBeenCalled();
  });

  it('un rechazo del servidor (o un accesorio que la empresa bloquea) se explica y se puede volver a tomar la foto', async () => {
    serve();
    flow.onSubmit
      .mockRejectedValueOnce(new ApiError({ statusCode: 422, code: 'TOO_DARK', message: 'Hay poca luz' }))
      .mockImplementationOnce(() => Promise.reject(accessoriesError()));
    renderFlow({ ...ENROLLMENT, enrollmentStep: 'photo' });
    await takePhoto();
    expect(message()).toHaveTextContent('Hay poca luz');
    expect(heading()).toHaveTextContent('Intenta de nuevo');
    await advance(3_000); // se reanuda el escaneo (el obturador vuelve a habilitarse)
    await takePhoto();
    expect(message()).toHaveTextContent('Muestra tu rostro completo');
    expect(screen.getByRole('list', { name: 'Accesorios detectados' })).toHaveTextContent('Cubrebocas');
    await advance(3_000);
    await takePhoto();
    expect(flow.onSubmit).toHaveBeenCalledTimes(3);
    expect(flow.onFatal).not.toHaveBeenCalled();
  });

  it('las insignias de accesorios se actualizan en vivo mientras se alinea: aparecen al detectarse y desaparecen al quitarse', async () => {
    const worn = { items: ['GLASSES'] };
    const server = serve({ check: () => checkReporting(worn.items) });
    renderFlow({ ...ENROLLMENT, enrollmentStep: 'photo' });
    expect(screen.queryByRole('list', { name: 'Accesorios detectados' })).toBeNull(); // la vigilancia espera su intervalo
    await advance(2_600); // una ronda de la vigilancia continua (2.5 s)
    expect(server.checks()).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('list', { name: 'Accesorios detectados' })).toHaveTextContent('Lentes');
    worn.items = []; // la persona se quita los lentes
    await advance(2_600);
    expect(screen.queryByRole('list', { name: 'Accesorios detectados' })).toBeNull();
  });

  it('si la cámara no da imagen al tomarla, espera y vuelve a empezar sin enviar nada', async () => {
    serve();
    renderFlow({ ...ENROLLMENT, enrollmentStep: 'photo' });
    camera.capture.mockRejectedValueOnce(new CameraNotReadyError());
    await takePhoto();
    expect(message()).toHaveTextContent('La cámara aún no está lista');
    expect(flow.onSubmit).not.toHaveBeenCalled();
    await advance(3_000);
    expect(detection.options?.mode).toEqual({ kind: 'frontal', baseline: null });
  });
});

describe('LiveFaceFlow: las capturas (paso 2)', () => {
  it('empieza directo con las fotos válidas (sin la foto inicial ni la validación previa) y sigue con los cuatro movimientos', async () => {
    const server = serve({ challenge: () => apiOk(FOUR_MOVES) });
    renderFlow({ ...ENROLLMENT, enrollmentStep: 'captures' });
    await stable({ pitch: 0.55, width: 200 });
    await advance(20);
    expect(server.checks()).toBe(0);
    expect(server.calls.find((call) => call.url.includes('/face/challenge'))?.url).toContain('purpose=ENROLLMENT');
    expect(heading()).toHaveTextContent('Prueba de vida · paso 1 de 4');
    expect(camera.capture).toHaveBeenCalledOnce(); // la foto válida (ENROLLMENT pide una), ninguna inicial
  });
});

function accessoriesError(): ApiError {
  return new ApiError({
    statusCode: 422,
    code: 'ACCESSORIES_DETECTED',
    message: 'Quítate el cubrebocas para continuar',
    errors: [{ code: 'ACCESSORIES_DETECTED', message: 'Quítate el cubrebocas para continuar', field: null, details: { accessories: ['MASK'] } }],
  });
}
