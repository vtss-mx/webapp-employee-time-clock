import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionResult } from '../../../components/attendance/employee/testData';
import type { CapturedFace } from '../../../components/LiveFaceFlow';
import { resetPolicyCache } from '../../../hooks/useVerificationPolicy';
import { setLocale } from '../../../i18n/core';
import { paths } from '../../../routes/paths';
import { samplePolicy } from '../../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { LocationError, type DeviceLocation } from '../../../utils/geolocation';
import { AttendanceRecordPage } from './AttendanceRecordPage';

// La ubicación del teléfono la controla cada prueba (el aviso nativo se prueba en navegador real).
const geo = vi.hoisted(() => ({ read: vi.fn<() => Promise<DeviceLocation>>() }));
vi.mock('../../../utils/geolocation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  currentLocation: () => geo.read(),
}));
// Cada lectura de la pantalla es una toma (las lecturas de más se prueban en `locationSampling.test.ts`).
vi.mock('../../../utils/locationSampling', () => ({
  sampleLocation: async () => {
    const best = await geo.read();
    return { best, samples: [best, { ...best, accuracy: best.accuracy + 3 }] };
  },
}));

interface FlowProps {
  title: string;
  submittingMessage: string;
  onSubmit: (captured: CapturedFace) => Promise<void>;
  onFatal: (error: unknown) => void;
  onCancel: () => void;
}
// La cámara y el detector se prueban en navegador real; aquí, qué hace la pantalla con cada salida del
// flujo. Un error del envío llega a `onFatal`, como hace el flujo con los que no son del rostro.
vi.mock('../../../components/LiveFaceFlow', () => ({
  LiveFaceFlow: ({ title, submittingMessage, onSubmit, onFatal, onCancel }: FlowProps) => (
    <div>
      <h1>{title}</h1>
      <p>{submittingMessage}</p>
      <button onClick={() => void onSubmit({ frontal: [new Blob(['x'])], accessoryReview: false }).catch(onFatal)}>capturar rostro</button>
      <button onClick={() => onFatal(new Error('No se pudo abrir la cámara'))}>falla de cámara</button>
      <button onClick={onCancel}>salir</button>
    </div>
  ),
}));

const HERE: DeviceLocation = { latitude: 29.1, longitude: -110.9, accuracy: 12 };
const RECORD = (call: MockCall) => call.url.startsWith('/api/me/attendance/');

/** Política de la empresa y el registro (cada respuesta del registro en orden; la última se repite). */
function server(...records: Response[]) {
  const queue = [...records];
  return mockFetch((call) => {
    if (call.url.includes('/settings/verification')) return apiOk(samplePolicy);
    return queue.length > 1 ? (queue.shift() as Response) : queue[0].clone();
  });
}

/** Un botón fuera de la pantalla para salir de ella mientras hay algo pendiente. */
function Leave() {
  const navigate = useNavigate();
  return <button onClick={() => void navigate('/otra')}>ir a otra pantalla</button>;
}

function renderRecord(slug: string) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path={paths.employee.recordAttendance(':action')} element={<AttendanceRecordPage />} />
        <Route path={paths.employee.attendance} element={<p>Pantalla de mi asistencia</p>} />
        <Route path="/otra" element={<p>Otra pantalla</p>} />
      </Routes>
      <Leave />
    </>,
    { route: `/employee/attendance/record/${slug}` },
  );
}

const capture = () => userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));
const faceStep = (title = 'Registrar entrada') => screen.findByRole('heading', { name: title });
const posted = (calls: MockCall[]) => calls.filter(RECORD);
/** El popup abierto (advertencia). */
const popup = () => within(screen.getByRole('alertdialog'));

beforeEach(() => {
  geo.read.mockReset();
  geo.read.mockResolvedValue(HERE);
});
afterEach(() => resetPolicyCache());

describe('AttendanceRecordPage (registrar con rostro y ubicación)', () => {
  it('una ruta desconocida vuelve a Mi asistencia', async () => {
    server(apiOk(actionResult()));
    renderRecord('otra-cosa');
    expect(await screen.findByText('Pantalla de mi asistencia')).toBeInTheDocument();
  });

  it('primero la ubicación, luego el rostro; registra con ambos y "Listo" vuelve a Mi asistencia', async () => {
    let resolve!: (location: DeviceLocation) => void;
    geo.read.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { calls } = server(apiOk(actionResult()));
    renderRecord('check-in');
    expect(screen.getByRole('heading', { name: 'Obteniendo tu ubicación…' })).toBeInTheDocument();
    expect(screen.getByText('Registrar entrada')).toBeInTheDocument();
    resolve(HERE);
    expect(await faceStep()).toBeInTheDocument();
    expect(screen.getByText('Registrando tu entrada…')).toBeInTheDocument();
    await capture();
    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    const call = posted(calls)[0];
    expect(call.url).toBe('/api/me/attendance/check-in');
    const form = call.init.body as FormData;
    expect([form.get('latitude'), form.get('longitude'), form.get('accuracy')]).toEqual(['29.1', '-110.9', '12']);
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(await screen.findByText('Pantalla de mi asistencia')).toBeInTheDocument();
  });

  it('rostro no verificado: nada se registra; "Intentar de nuevo" vuelve a la cámara con la misma ubicación', async () => {
    const failed = actionResult({ verified: false, message: 'Rostro no reconocido', session: null, verification: { verified: false, method: 'FACE', message: 'Rostro no reconocido' } });
    server(apiOk(failed, { code: 'IDENTITY_NOT_VERIFIED' }));
    renderRecord('break-start');
    expect(await faceStep('Registrar inicio de descanso')).toBeInTheDocument();
    await capture();
    expect(await screen.findByText('No se pudo registrar tu inicio de descanso')).toBeInTheDocument();
    expect(screen.getByText('Rostro no reconocido')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(await faceStep('Registrar inicio de descanso')).toBeInTheDocument();
    expect(geo.read).toHaveBeenCalledOnce();
  });

  it('una falla de la cámara se muestra con su motivo y "Volver a mi asistencia"', async () => {
    server(apiOk(actionResult()));
    renderRecord('check-out');
    await faceStep('Registrar salida');
    await userEvent.click(screen.getByRole('button', { name: 'falla de cámara' }));
    expect(await screen.findByText('No se pudo abrir la cámara')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a mi asistencia' }));
    expect(await screen.findByText('Pantalla de mi asistencia')).toBeInTheDocument();
  });

  it('fuera del sitio: popup con la distancia y qué hacer; "Reintentar" lee otra ubicación y vuelve al rostro', async () => {
    const { calls } = server(apiFail(403, 'LOCATION_OUT_OF_SITE', 'Hoy debes registrar en tu sitio de trabajo. Estás a 1.2 km de Planta Norte.'), apiOk(actionResult()));
    renderRecord('check-in');
    await faceStep();
    await capture();
    expect(await screen.findByText('Estás fuera de tu sitio de trabajo')).toBeInTheDocument();
    expect(screen.getByText(/Estás a 1.2 km de Planta Norte/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No se registró tu asistencia' })).toBeInTheDocument();
    await userEvent.click(popup().getByRole('button', { name: 'Reintentar' }));
    await faceStep();
    expect(geo.read).toHaveBeenCalledTimes(2);
    await capture();
    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(posted(calls)).toHaveLength(2);
  });

  it('ubicación imprecisa o no creíble: su popup; al cerrarlo quedan "Reintentar" y volver en la pantalla', async () => {
    server(apiFail(422, 'LOCATION_INACCURATE', 'Tu ubicación no es precisa (±350 m).'), apiFail(403, 'IMPOSSIBLE_TRAVEL', 'Tu ubicación no es creíble.'));
    renderRecord('check-in');
    await faceStep();
    await capture();
    expect(await screen.findByRole('heading', { name: 'Tu ubicación no es precisa' })).toBeInTheDocument();
    await userEvent.click(popup().getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await faceStep();
    await capture();
    expect(await screen.findByRole('heading', { name: 'Tu ubicación no es creíble' })).toBeInTheDocument();
    await userEvent.click(popup().getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Volver a mi asistencia' }));
    expect(await screen.findByText('Pantalla de mi asistencia')).toBeInTheDocument();
  });

  it('el estado cambió (409): vuelve a Mi asistencia y lo explica', async () => {
    server(apiFail(409, 'ATTENDANCE_ACTION_NOT_ALLOWED', 'Ya tienes una entrada registrada o no tienes un turno en este momento'));
    renderRecord('check-in');
    await faceStep();
    await capture();
    expect(await screen.findByText('Pantalla de mi asistencia')).toBeInTheDocument();
    expect(screen.getByText('Tu asistencia cambió')).toBeInTheDocument();
    expect(screen.getByText('Ya tienes una entrada registrada o no tienes un turno en este momento')).toBeInTheDocument();
  });

  it('permiso de ubicación bloqueado: lo explica para la asistencia y "Reintentar" vuelve a pedirla', async () => {
    geo.read.mockRejectedValueOnce(new LocationError('denied'));
    server(apiOk(actionResult()));
    renderRecord('check-in');
    expect(await screen.findByText('Permite el acceso a tu ubicación')).toBeInTheDocument();
    expect(screen.getByText(/Tu registro de asistencia necesita tu ubicación/)).toBeInTheDocument();
    await userEvent.click(popup().getByRole('button', { name: 'Reintentar' }));
    expect(await faceStep()).toBeInTheDocument();
  });

  it('una ubicación vieja (más de un minuto en la cámara) se vuelve a leer antes de enviar', async () => {
    const { calls } = server(apiOk(actionResult()));
    renderRecord('check-in');
    await faceStep();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    geo.read.mockResolvedValueOnce({ latitude: 29.2, longitude: -110.8, accuracy: 8 });
    await capture();
    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    const form = posted(calls)[0].init.body as FormData;
    expect([form.get('latitude'), form.get('longitude'), form.get('accuracy')]).toEqual(['29.2', '-110.8', '8']);
    expect(geo.read).toHaveBeenCalledTimes(2);
  });

  it('si la ubicación vieja ya no se puede volver a leer, se explica y se reintenta', async () => {
    const { calls } = server(apiOk(actionResult()));
    renderRecord('check-in');
    await faceStep();
    const later = Date.now() + 61_000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    geo.read.mockRejectedValueOnce(new LocationError('timeout'));
    await capture();
    expect(await screen.findByText('La ubicación tardó demasiado')).toBeInTheDocument();
    expect(posted(calls)).toHaveLength(0);
    await userEvent.click(popup().getByRole('button', { name: 'Reintentar' }));
    await faceStep();
    await capture();
    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(geo.read).toHaveBeenCalledTimes(3);
  });

  it('cancelar en la ubicación o en la cámara vuelve a Mi asistencia; lo que llegue tarde se ignora', async () => {
    let fail!: (error: unknown) => void;
    geo.read.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)));
    server(apiOk(actionResult()));
    const view = renderRecord('check-in');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Pantalla de mi asistencia')).toBeInTheDocument();
    fail(new LocationError('denied'));
    await Promise.resolve();
    expect(screen.queryByText('Permite el acceso a tu ubicación')).toBeNull();
    view.unmount();
    renderRecord('check-in');
    await faceStep();
    await userEvent.click(screen.getByRole('button', { name: 'salir' }));
    expect(await screen.findByText('Pantalla de mi asistencia')).toBeInTheDocument();
  });

  it('si sale de la pantalla con el popup abierto, "Reintentar" ya no hace nada', async () => {
    server(apiFail(403, 'LOCATION_OUT_OF_SITE', 'Fuera del sitio'));
    renderRecord('check-in');
    await faceStep();
    await capture();
    await screen.findByText('Estás fuera de tu sitio de trabajo');
    fireEvent.click(screen.getByRole('button', { name: 'ir a otra pantalla' }));
    expect(await screen.findByText('Otra pantalla')).toBeInTheDocument();
    await userEvent.click(popup().getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryByText('Estás fuera de tu sitio de trabajo')).toBeNull());
    expect(geo.read).toHaveBeenCalledOnce();
  });
});

describe('AttendanceRecordPage en inglés (en-US)', () => {
  it('obtener la ubicación, el rostro y lo que no se registró, en inglés', async () => {
    await setLocale('en-US');
    let located!: (here: DeviceLocation) => void;
    geo.read.mockReturnValue(new Promise<DeviceLocation>((resolve) => (located = resolve)));
    server(apiOk(actionResult()));
    renderRecord('check-out');
    expect(await screen.findByText('Getting your location…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    located(HERE);
    // El nombre de la acción es del catálogo (lo envía el servidor en su idioma).
    expect(await screen.findByText('Recording your salida…')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'falla de cámara' }));
    expect(await screen.findByText("Couldn't record your salida")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to my attendance' })).toBeInTheDocument();
  });

  it('cambio en caliente con el popup abierto: el problema y la pantalla de fondo pasan a inglés', async () => {
    server(apiFail(403, 'LOCATION_OUT_OF_SITE', 'Estás a 1.2 km de Planta Norte.'), apiOk(actionResult()));
    renderRecord('check-in');
    await faceStep();
    await capture();
    expect(await screen.findByText('Estás fuera de tu sitio de trabajo')).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('heading', { name: "You're outside your work site" })).toBeInTheDocument();
    expect(popup().getByText('Tap “Retry.”')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Your attendance wasn't recorded" })).toBeInTheDocument();
    await userEvent.click(popup().getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Record entrada' })).toBeInTheDocument();
  });
});
