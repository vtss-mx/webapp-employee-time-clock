import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { actionResult, attendanceToday, sampleShift } from '../../../components/attendance/employee/testData';
import { TimeClockCard } from '../../../components/attendance/employee/TimeClockCard';
import type { CapturedFace } from '../../../components/LiveFaceFlow';
import type { CameraController, UseCameraOptions } from '../../../hooks/useCamera';
import { resetPolicyCache } from '../../../hooks/useVerificationPolicy';
import { setLocale } from '../../../i18n/core';
import { paths } from '../../../routes/paths';
import { samplePolicy } from '../../../test/fixtures';
import { apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { DeviceLocation } from '../../../utils/geolocation';
import { AttendanceRecordPage } from './AttendanceRecordPage';

// La ubicación, la cámara, la lectura del QR y el rostro tienen sus pruebas; aquí, el paso del código del sitio.
const HERE: DeviceLocation = { latitude: 29.1, longitude: -110.9, accuracy: 12 };
vi.mock('../../../utils/locationSampling', () => ({ sampleLocation: () => Promise.resolve({ best: HERE, samples: [HERE] }) }));
vi.mock('../../../hooks/useCamera', () => ({
  useCamera: (options: UseCameraOptions): Partial<CameraController> => ({ videoRef: { current: null }, facing: options.facing, status: 'active', devices: [], activeDeviceId: null, isMirrored: false, problem: null, start: () => Promise.resolve() }),
}));
const scanner = vi.hoisted(() => ({ onDetect: (_content: string): void | Promise<void> => undefined }));
vi.mock('../../../hooks/useQrScanner', () => ({ useQrScanner: (options: { onDetect: (content: string) => void | Promise<void> }) => void (scanner.onDetect = options.onDetect) }));
vi.mock('../../../components/LiveFaceFlow', () => ({
  LiveFaceFlow: ({ title, onSubmit, onFatal }: { title: string; onSubmit: (c: CapturedFace) => Promise<void>; onFatal: (e: unknown) => void }) => (
    <div>
      <h1>{title}</h1>
      <button onClick={() => void onSubmit({ frontal: [new Blob(['x'])], accessoryReview: false }).catch(onFatal)}>capturar rostro</button>
    </div>
  ),
}));

const detect = (content: string) => act(() => Promise.resolve().then(() => void scanner.onDetect(content)));
const capture = () => userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));
const siteCodes = (calls: MockCall[]) => calls.filter((c) => c.url.startsWith('/api/me/attendance/')).map((c) => (c.init.body as FormData).get('site_code'));
const codeError = (status: number, code: string, message: string) => jsonResponse(envelope(null, { status, code, message, errors: [{ code, message, field: null, details: { site: 'Planta Norte' } }] }), status);

/** El servidor: la política y cada registro con la siguiente respuesta (la última se repite). */
function server(...records: Array<() => Response>) {
  let next = 0;
  return mockFetch((call) => {
    if (call.url.includes('/settings/verification')) return apiOk(samplePolicy);
    const respond = records[Math.min(next, records.length - 1)];
    next += 1;
    return respond();
  });
}

/** Abre el registro como lo hace "Mi asistencia" (con lo que sabe del código) o, sin estado, como una dirección a mano. */
function openRecord(slug: string, state?: { siteCode: boolean; remoteAllowed: boolean }) {
  return renderWithProviders(
    <Routes>
      <Route path="/start" element={<Navigate to={`/employee/attendance/record/${slug}`} state={state} />} />
      <Route path={paths.employee.recordAttendance(':action')} element={<AttendanceRecordPage />} />
      <Route path={paths.employee.attendance} element={<p>Pantalla de mi asistencia</p>} />
    </Routes>,
    { route: '/start' },
  );
}

afterEach(() => resetPolicyCache());

describe('Registro con el código del sitio (antifraude 2b)', () => {
  it('entrada en un sitio con código: tras la ubicación se escanea el QR del kiosco (otro QR se descarta) y viaja tal cual', async () => {
    const { calls } = server(() => apiOk(actionResult()));
    openRecord('check-in', { siteCode: true, remoteAllowed: false });
    expect(await screen.findByRole('heading', { name: 'Código del sitio' })).toBeInTheDocument();
    expect(screen.getByText('Escanea el QR del kiosco del sitio o escribe los 6 dígitos que muestra.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No estoy en el sitio' })).toBeNull();
    await detect('TCQR2:abc');
    expect(screen.getByRole('status')).toHaveTextContent('Ese QR no es el del kiosco');
    await detect('TC-SITE:3:12345'); // le falta un dígito
    expect(screen.queryByRole('heading', { name: 'Registrar entrada' })).toBeNull();
    await detect('TC-SITE:3:123456');
    expect(await screen.findByRole('heading', { name: 'Registrar entrada' })).toBeInTheDocument();
    await capture();
    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(siteCodes(calls)).toEqual(['TC-SITE:3:123456']);
  });

  it('salida: los 6 dígitos se escriben (solo números) y "Continuar" se habilita al completarlos', async () => {
    const { calls } = server(() => apiOk(actionResult({ action: 'CHECK_OUT' })));
    openRecord('check-out', { siteCode: true, remoteAllowed: false });
    const field = await screen.findByLabelText('Código de 6 dígitos');
    const next = screen.getByRole('button', { name: 'Continuar' });
    await userEvent.type(field, '12a34');
    expect(field).toHaveValue('1234');
    expect(next).toBeDisabled();
    fireEvent.submit(field.closest('form') as HTMLFormElement); // incompleto: no sigue
    expect(screen.getByRole('heading', { name: 'Código del sitio' })).toBeInTheDocument();
    await userEvent.type(field, '5678');
    expect(field).toHaveValue('123456');
    await userEvent.click(next);
    await capture();
    await screen.findByRole('heading', { name: /registrada/ });
    expect(siteCodes(calls)).toEqual(['123456']);
  });

  it('remoto: "No estoy en el sitio" sigue sin código; si el servidor lo pide, lo explica y vuelve al código', async () => {
    const { calls } = server(() => codeError(403, 'SITE_CODE_REQUIRED', 'Estás en Planta Norte: escribe su código.'), () => apiOk(actionResult()));
    openRecord('check-in', { siteCode: true, remoteAllowed: true });
    await userEvent.click(await screen.findByRole('button', { name: 'No estoy en el sitio' }));
    await capture();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo usar el código del sitio' });
    expect(popup).toHaveTextContent('Estás en Planta Norte: escribe su código.');
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    await userEvent.type(screen.getByLabelText('Código de 6 dígitos'), '654321');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await capture();
    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(siteCodes(calls)).toEqual([null, '654321']);
  });

  it('sin saberlo (dirección a mano) no se pide; un código ya usado o equivocado regresa al código aunque no se pidiera', async () => {
    const { calls } = server(
      () => codeError(409, 'SITE_CODE_USED', 'Ya usaste ese código: espera el siguiente.'),
      () => codeError(403, 'SITE_CODE_INVALID', 'El código no es de este sitio.'),
      () => apiOk(actionResult()),
    );
    openRecord('check-in');
    expect(await screen.findByRole('heading', { name: 'Registrar entrada' })).toBeInTheDocument();
    await capture();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo usar el código del sitio' })).toHaveTextContent('Ya usaste ese código');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('button', { name: 'No estoy en el sitio' })).toBeNull();
    await detect('TC-SITE:3:111111');
    await capture();
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Entendido' }));
    await detect('TC-SITE:3:222222');
    await capture();
    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(siteCodes(calls)).toEqual([null, 'TC-SITE:3:111111', 'TC-SITE:3:222222']);
  });

  it('un rostro no verificado: "Intentar de nuevo" vuelve a pedir el código (cada intento lleva uno nuevo)', async () => {
    const failed = actionResult({ verified: false, message: 'Rostro no reconocido', session: null, verification: { verified: false, method: 'FACE', message: 'Rostro no reconocido' } });
    server(() => apiOk(failed));
    openRecord('check-in', { siteCode: true, remoteAllowed: false });
    await screen.findByRole('heading', { name: 'Código del sitio' });
    await detect('TC-SITE:3:123456');
    await capture();
    await userEvent.click(await screen.findByRole('button', { name: 'Intentar de nuevo' }));
    expect(await screen.findByRole('heading', { name: 'Código del sitio' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Pantalla de mi asistencia')).toBeInTheDocument();
  });

  it('el descanso nunca pide el código', async () => {
    server(() => apiOk(actionResult({ action: 'BREAK_START' })));
    openRecord('break-start', { siteCode: true, remoteAllowed: true });
    expect(await screen.findByRole('heading', { name: 'Registrar inicio de descanso' })).toBeInTheDocument();
  });

  it('"Mi asistencia" le dice al registro si el sitio pide código y si hoy puede checar remoto', async () => {
    mockFetch(apiOk(null));
    function State() {
      return <pre>{JSON.stringify(useLocation().state)}</pre>;
    }
    renderWithProviders(
      <Routes>
        <Route path="/" element={<TimeClockCard today={attendanceToday({ site_code: true, remote_allowed: true })} shift={sampleShift} offsetMs={0} />} />
        <Route path={paths.employee.recordAttendance(':action')} element={<State />} />
      </Routes>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Registrar tu entrada?' })).getByRole('button', { name: 'Registrar entrada' }));
    expect(await screen.findByText('{"siteCode":true,"remoteAllowed":true}')).toBeInTheDocument();
  });

  it('en inglés', async () => {
    await setLocale('en-US');
    server(() => apiOk(actionResult()));
    openRecord('check-in', { siteCode: true, remoteAllowed: true });
    expect(await screen.findByRole('heading', { name: 'Site code' })).toBeInTheDocument();
    expect(screen.getByLabelText('6-digit code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "I'm not at the site" })).toBeInTheDocument();
  });
});
