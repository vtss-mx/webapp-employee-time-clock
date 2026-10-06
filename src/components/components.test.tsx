import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { useFeedback } from '../hooks/useFeedback';
import { samplePolicy } from '../test/fixtures';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { catalogsFixture, catalogsWith } from '../test/catalogs';
import { renderWithProviders, WithCatalogs } from '../test/render';
import type { EmployeeFormValues, FaceChallenge, VerificationResult } from '../types';
import { Ban, Glasses } from 'lucide-react';
import { accessoryIcon, ruledAccessories } from './accessories';
import { CountUp } from './CountUp';
import { EmployeeFormFields, HeadwearExemptField } from './EmployeeForm';
import { emptyEmployeeForm } from '../utils/formRules';
import { ErrorBoundary } from './ErrorBoundary';
import { FaceRequirements } from './FaceRequirements';
import { GlobalErrorHandler } from './GlobalErrorHandler';
import { captureDetail, challengeActions, detectionMode, flowStatus, introFor, scannerView } from './liveFaceView';
import { ConfirmDialog, Modal } from './Modal';
import { OfflineBanner } from './OfflineBanner';
import { PageHeader } from './PageHeader';
import { QrCodePanel } from './QrCodePanel';
import { describeDevice } from '../utils/userAgent';
import { PageLoader } from './Spinner';
import { AppErrorScreen } from './AppErrorScreen';
import { EnrollmentBadge, FaceStatusBadge, StatusBadge } from './StatusBadge';
import { Button } from './ui/Button';
import { SkeletonCard, SkeletonRows } from './ui/Skeleton';
import { StatusMark } from './ui/StatusMark';
import { VerificationAttempt } from './VerificationAttempt';
import { VerificationResultCard } from './VerificationResultCard';

const verified: VerificationResult = {
  verified: true,
  method: 'FACE',
  message: 'Identidad confirmada',
  employee_id: 1,
  employee_number: 'EMP-1',
  name: 'Ana Ruiz',
  confidence: 0.91,
  verified_at: '2026-10-01T10:00:00Z',
};

describe('Button', () => {
  it('ejecuta onClick con efecto ripple y bloquea mientras carga', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Guardar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(document.querySelector('.ripple')).not.toBeNull();
    rerender(<Button onClick={onClick} loading>Guardar</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('componentes de presentación', () => {
  it('renderizan su contenido', () => {
    render(
      <MemoryRouter>
        <StatusBadge active={false} />
        <FaceRequirements policy={{ block_glasses: true, block_headwear: true, block_mask: false, anti_spoofing: true }} headwearExempt />
        <PageHeader title="Título" subtitle="Sub" backTo="/" actions={<span>acción</span>} />
        <PageLoader text="Cargando datos" />
        <SkeletonCard lines={2} />
        <SkeletonRows rows={1} />
        <StatusMark kind="pending" />
      </MemoryRouter>,
      { wrapper: WithCatalogs },
    );
    expect(screen.getByText('Título')).toBeInTheDocument();
    expect(screen.getByText('Sin lentes')).toBeInTheDocument(); // nombre del catálogo de accesorios
    expect(screen.queryByText('Sin cubrebocas')).toBeNull(); // la empresa lo permite
    expect(screen.queryByText('Sin gorra')).toBeNull(); // empleado exento
    expect(screen.getByText('Tu rostro real, sin fotos')).toBeInTheDocument();
    expect(screen.getByText('Cargando datos')).toBeInTheDocument();
    expect(screen.getByText('acción')).toBeInTheDocument();
  });

  it('la carga muestra el ícono animado y "Cargando…": en el área de trabajo o a pantalla completa', () => {
    const { container, rerender } = render(<PageLoader />);
    const inline = screen.getByRole('status');
    expect(inline).toHaveClass('page-loader');
    expect(inline).toHaveTextContent('Cargando…');
    expect(container.querySelector('.brand-mark__tint')).not.toBeNull();
    rerender(<PageLoader fullscreen />);
    expect(screen.getByRole('status')).toHaveClass('app-splash');
  });

  it('la pantalla de error de la app se personaliza: título, explicación y botón', async () => {
    const onRetry = vi.fn();
    render(<AppErrorScreen onRetry={onRetry} title="Sin servidor" message="Vuelve en un momento" retryLabel="Intentar" />);
    const screenError = screen.getByRole('alert');
    expect(screenError).toHaveTextContent('Sin servidor');
    expect(screenError).toHaveTextContent('Vuelve en un momento');
    await userEvent.click(screen.getByRole('button', { name: 'Intentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('estados del registro facial y de las solicitudes: nombre y tono del catálogo', () => {
    render(
      <>
        <FaceStatusBadge status="PENDING_REVIEW" />
        <FaceStatusBadge status="APPROVED" />
        <EnrollmentBadge status="REJECTED" />
        <EnrollmentBadge status={'ARCHIVED' as 'PENDING'} />
      </>,
      { wrapper: WithCatalogs },
    );
    expect(screen.getByText('En validación')).toHaveClass('badge--warning', 'badge--live');
    expect(screen.getByText('Validado')).toHaveClass('badge--success');
    expect(screen.getByText('Rechazado')).toHaveClass('badge--danger');
    expect(screen.getByText('ARCHIVED')).toHaveClass('badge--muted'); // código sin registro en el catálogo
  });

  it('accesorios: ícono y regla de la política por código del catálogo', () => {
    expect(accessoryIcon('GLASSES')).toBe(Glasses);
    expect(accessoryIcon('SCARF')).toBe(Ban); // accesorio nuevo en el catálogo: ícono genérico
    const [glasses, headwear] = catalogsFixture.accessories;
    const scarf = { ...glasses, code: 'SCARF', name: 'Bufanda', phrase: 'la bufanda' };
    expect(ruledAccessories([glasses, { ...headwear, active: false }, scarf]).map(({ item, rule }) => [item.code, rule])).toEqual([
      ['GLASSES', 'block_glasses'],
    ]);
  });

  it('requisitos del rostro: solo accesorios activos del catálogo que la política exige', () => {
    const accessories = catalogsFixture.accessories.map((a) => (a.code === 'MASK' ? { ...a, active: false } : a));
    render(
      <WithCatalogs catalogs={catalogsWith({ accessories })}>
        <FaceRequirements policy={{ block_glasses: false, block_headwear: true, block_mask: true, anti_spoofing: false }} />
      </WithCatalogs>,
    );
    const items = within(screen.getByRole('list', { name: 'Requisitos para la captura' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.trim())).toEqual(['Sin gorra', 'Buena iluminación']);
  });

  it('CountUp termina en el valor final', async () => {
    render(<CountUp value={42} duration={10} />);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
  });

  it('OfflineBanner aparece sin conexión', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión');
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Modal y ConfirmDialog', () => {
  it('cierra con Escape, con el botón y al hacer clic fuera', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Modal open title="Detalle" onClose={onClose} footer={<span>pie</span>}>cuerpo</Modal>);
    expect(screen.getByRole('dialog', { name: 'Detalle' })).toBeInTheDocument();
    expect(document.body).toHaveClass('no-scroll');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByLabelText('Cerrar'));
    // El fondo cubre toda la pantalla y se monta en <body> (portal), fuera de la página.
    const backdrop = document.body.querySelector(':scope > .msg-layer');
    expect(backdrop).not.toBeNull();
    if (backdrop) fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
    rerender(<Modal open={false} title="Detalle" onClose={onClose}>cuerpo</Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirma o cancela', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="¿Seguro?" message="Se eliminará" confirmLabel="Eliminar" tone="danger" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('formulario de empleado', () => {
  function Harness() {
    const [values, setValues] = useState<EmployeeFormValues>(emptyEmployeeForm);
    const [exempt, setExempt] = useState(false);
    return (
      <>
        <EmployeeFormFields values={values} errors={{ email: 'Correo inválido' }} onChange={setValues} isEdit />
        <HeadwearExemptField checked={exempt} onChange={setExempt} />
        <output>{JSON.stringify({ values, exempt })}</output>
      </>
    );
  }
  it('actualiza valores y muestra errores', async () => {
    render(<Harness />, { wrapper: WithCatalogs });
    await userEvent.type(screen.getByLabelText('Nombres'), 'Ana');
    await userEvent.click(screen.getByRole('checkbox'));
    expect(document.querySelector('output')?.textContent).toContain('"first_name":"Ana"');
    expect(document.querySelector('output')?.textContent).toContain('"exempt":true');
    expect(screen.getByText('Correo inválido')).toBeInTheDocument();
    expect(screen.getByText('Déjala vacía para no cambiarla')).toBeInTheDocument();
  });
});

describe('verificación', () => {
  it('VerificationResultCard muestra éxito y fallo', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<VerificationResultCard result={verified} failureTitle="No" onRetry={onRetry} onBack={vi.fn()} />);
    expect(screen.getByText('Identidad confirmada')).toBeInTheDocument();
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
    rerender(<VerificationResultCard result={null} error="Sin red" failureTitle="No fue posible" onRetry={onRetry} onBack={vi.fn()} />);
    expect(screen.getByText('No fue posible')).toBeInTheDocument();
    expect(screen.getByText('Sin red')).toBeInTheDocument();
  });

  it('VerificationAttempt reinicia la captura al reintentar', async () => {
    const mounts = vi.fn();
    function Capture({ finish }: { finish: (o: { result: VerificationResult | null; error: string | null }) => void }) {
      mounts();
      return <button onClick={() => finish({ result: null, error: 'Rostro no reconocido' })}>capturar</button>;
    }
    renderWithProviders(<VerificationAttempt failureTitle={() => 'Falló'}>{(finish) => <Capture finish={finish} />}</VerificationAttempt>);
    await userEvent.click(screen.getByText('capturar'));
    expect(screen.getByText('Falló')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Intentar|Reintentar/ }));
    expect(screen.getByText('capturar')).toBeInTheDocument();
    expect(mounts).toHaveBeenCalledTimes(2);
  });

  it('flowStatus describe cada fase', () => {
    const base = { guidance: 'off_center' as const, submittingMessage: 'Enviando', detectorReady: true, detectorFailed: false };
    expect(flowStatus({ ...base, phase: 'checking' }).tone).toBe('busy');
    // Mientras se toman las fotos la indicación no cambia; la cuenta va aparte.
    expect(flowStatus({ ...base, phase: 'checking', capture: { current: 2, total: 5 } }).message).toBe('Mantente quieto');
    expect(flowStatus({ ...base, phase: 'checking' }).message).toBe('Analizando…');
    expect(captureDetail({ current: 2, total: 5 })).toBe('Foto 2 de 5');
    expect(captureDetail(null)).toBeNull();
    expect(flowStatus({ ...base, phase: 'submitting' }).message).toBe('Enviando');
    expect(flowStatus({ ...base, phase: 'blocked', blockedMessage: 'Quita lentes' })).toEqual({ message: 'Quita lentes', tone: 'warn' });
    expect(flowStatus({ ...base, phase: 'flash' })).toEqual({ message: 'Mantén tu rostro frente a la pantalla', tone: 'busy' });
    expect(flowStatus({ ...base, phase: 'challenge', guidance: 'hold_still' }).tone).toBe('ok');
    expect(flowStatus({ ...base, phase: 'challenge', guidance: 'move', instruction: 'Gira a la derecha' }).message).toBe('Gira a la derecha');
    // A medio movimiento se anima a terminarlo.
    expect(flowStatus({ ...base, phase: 'challenge', guidance: 'move', instruction: 'Gira a la derecha', moveProgress: 0.6 }).message).toBe('Un poco más');
    expect(flowStatus({ ...base, phase: 'frontal', detectorFailed: true }).message).toMatch(/Capturar/);
    expect(flowStatus({ ...base, phase: 'frontal', detectorReady: false }).message).toBeTruthy();
    // Entre dos movimientos: de vuelta al frente.
    expect(flowStatus({ ...base, phase: 'recenter' })).toEqual({ message: 'Vuelve a mirar al frente', tone: 'idle' });
    expect(flowStatus({ ...base, phase: 'recenter', guidance: 'ready' })).toEqual({ message: 'Listo para el siguiente paso', tone: 'ok' });
  });

  it('reto de varios movimientos: orden, título por paso, destello y cámara virtual', () => {
    const challenge: FaceChallenge = {
      liveness_required: true,
      challenge_id: 'c1',
      action: 'LOOK_UP',
      instruction: 'Mira hacia arriba',
      actions: ['LOOK_UP', 'TURN_RIGHT', 'MOVE_CLOSER'],
      instructions: ['Mira hacia arriba', 'Gira a tu derecha', 'Acerca tu rostro'],
      min_yaw_ratio: 0.18,
      min_pitch_delta: 0.09,
      min_closer_scale: 1.3,
      flash: ['#FF0000', '#00FF00', '#0000FF'],
      flash_required: false,
      expires_in: 90,
    };
    expect(challengeActions(challenge)).toEqual(['LOOK_UP', 'TURN_RIGHT', 'MOVE_CLOSER']);
    expect(challengeActions(null)).toEqual([]);

    const base = { guidance: 'move' as const, submittingMessage: 'Enviando', detectorReady: true, detectorFailed: false, moveProgress: 0.7, challenge, virtualCamera: false };
    const second = scannerView({ ...base, phase: 'challenge', step: 1 });
    expect(second.message).toBe('Un poco más');
    expect(second.detail).toBeNull();
    expect(second.intro).toEqual({ title: 'Prueba de vida · paso 2 de 3', text: 'Gira a tu derecha', label: 'Prueba de vida · paso 2 de 3' });
    expect(scannerView({ ...base, phase: 'flash', step: 0 }).intro).toEqual({
      title: 'Prueba de vida · destello',
      text: 'Mantén tu rostro frente a la pantalla mientras cambia de color.',
      label: 'Prueba de vida · destello',
    });
    expect(scannerView({ ...base, phase: 'recenter', step: 1 }).intro).toMatchObject({ text: 'Vuelve a mirar al frente para el siguiente paso.', label: 'Prueba de vida · paso 2 de 3' });
    // Fuera de la prueba de vida, el rótulo es el nombre de la etapa (la indicación grande va bajo el círculo).
    expect(scannerView({ ...base, phase: 'checking', step: 0, capture: { current: 3, total: 36 } })).toMatchObject({
      message: 'Mantente quieto',
      detail: 'Foto 3 de 36',
      intro: { title: 'Mantente quieto', label: 'Escaneo' },
    });
    expect(scannerView({ ...base, phase: 'submitting', step: 0 }).intro).toMatchObject({ title: 'Enviando', label: 'Confirmación' });
    expect(scannerView({ ...base, phase: 'blocked', step: 0, blockedMessage: 'Hay poca luz' }).intro).toMatchObject({ title: 'Intenta de nuevo', label: 'Intenta de nuevo' });
    expect(scannerView({ ...base, phase: 'frontal', step: 0, guidance: 'ready' }).tone).toBe('ok');
    expect(scannerView({ ...base, phase: 'frontal', step: 0, virtualCamera: true })).toMatchObject({ tone: 'warn', message: expect.stringMatching(/Cámara virtual/) as string });
    expect(introFor({ phase: 'challenge', stage: 'liveness', instruction: null, submittingMessage: '', step: { current: 1, total: 1 } })).toEqual({
      title: 'Prueba de vida',
      text: 'Mueve la cabeza como se indique; la pantalla puede cambiar de color un instante.',
      label: 'Prueba de vida',
    });
  });

  it('qué mide el detector en cada fase: el movimiento contra el rostro en reposo (con los mínimos del reto o los pisos)', () => {
    const baseline = { pitch: 0.5, width: 200 };
    const bare: FaceChallenge = { liveness_required: true, challenge_id: 'c', action: null, instruction: null, actions: [], instructions: [], min_yaw_ratio: null, min_pitch_delta: null, min_closer_scale: null, flash: [], flash_required: false, expires_in: null };
    expect(detectionMode('frontal', bare, 'TURN_LEFT', baseline)).toEqual({ kind: 'frontal' });
    expect(detectionMode('challenge', bare, null, baseline)).toEqual({ kind: 'frontal' });
    expect(detectionMode('challenge', bare, 'TURN_LEFT', baseline)).toEqual({ kind: 'action', action: 'TURN_LEFT', minimum: 0.2, baseline });
    expect(detectionMode('challenge', bare, 'LOOK_DOWN', null)).toEqual({ kind: 'action', action: 'LOOK_DOWN', minimum: 0.08, baseline: null });
    expect(detectionMode('challenge', null, 'MOVE_CLOSER', baseline)).toMatchObject({ minimum: 1.25 });
    const strict = { ...bare, min_yaw_ratio: 0.25, min_pitch_delta: 0.1, min_closer_scale: 1.4 };
    expect(detectionMode('challenge', strict, 'TURN_RIGHT', baseline)).toMatchObject({ minimum: 0.25 });
    expect(detectionMode('challenge', strict, 'LOOK_UP', baseline)).toMatchObject({ minimum: 0.1 });
    expect(detectionMode('challenge', strict, 'MOVE_CLOSER', baseline)).toMatchObject({ minimum: 1.4 });
  });
});

describe('sesiones', () => {
  it('describeDevice reconoce navegador, sistema y móvil', () => {
    expect(describeDevice(null).label).toBe('Dispositivo desconocido');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari/604.1')).toEqual({ label: 'Safari · iOS', mobile: true });
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Edg/120').label).toBe('Edge · Windows');
    expect(describeDevice('Mozilla/5.0 (X11; Linux) Firefox/120').label).toBe('Firefox · Linux');
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile').label).toBe('Chrome · Android');
    expect(describeDevice('Mozilla/5.0 (Macintosh; Mac OS X) Chrome/120').label).toBe('Chrome · macOS');
    expect(describeDevice('curl/8').label).toBe('Navegador · Sistema desconocido');
  });
});

describe('QrCodePanel (QR dinámico)', () => {
  const live = { live: true, live_until: '2026-10-03T12:00:30Z', last_issued_at: '2026-10-03T12:00:00Z', last_used_at: null };

  it('muestra la actividad e invalida el código vigente con confirmación', async () => {
    const { calls } = mockFetch((call) =>
      call.init.method === 'DELETE' ? apiOk({ ...live, live: false, live_until: null }) : call.url.includes('/settings/') ? apiOk(samplePolicy) : apiOk(live),
    );
    renderWithProviders(<QrCodePanel employeeId={5} />);
    expect(await screen.findByText('En pantalla')).toBeInTheDocument();
    expect(screen.getByText('Nunca')).toBeInTheDocument(); // aún no lo usa
    await userEvent.click(screen.getByRole('button', { name: 'Invalidar código vigente' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Invalidar el código vigente?' })).getByRole('button', { name: 'Invalidar' }));
    expect(await screen.findByText('Código invalidado')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'DELETE')?.url).toBe('/api/employees/5/qr');
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Código invalidado' })).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Sin código vigente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invalidar código vigente' })).toBeDisabled();
  });

  it('si falla la carga ofrece reintentar', async () => {
    let failed = false;
    mockFetch((call) => {
      if (call.url.includes('/settings/')) return apiOk(samplePolicy);
      if (failed) return apiOk({ ...live, last_used_at: '2026-10-03T12:00:10Z' });
      failed = true;
      return apiFail(500, 'INTERNAL', 'Falla');
    });
    renderWithProviders(<QrCodePanel employeeId={5} />);
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('En pantalla')).toBeInTheDocument();
  });
});

describe('manejo global de errores', () => {
  it('ErrorBoundary muestra el fallback y permite reintentar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let explode = true;
    function Bomb() {
      if (explode) throw new Error('boom');
      return <span>recuperado</span>;
    }
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Error en esta pantalla');
    explode = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByText('recuperado')).toBeInTheDocument();
  });

  it('GlobalErrorHandler notifica promesas rechazadas e ignora cancelaciones', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <FeedbackProvider>
        <GlobalErrorHandler />
      </FeedbackProvider>,
    );
    const reject = (reason: unknown) => {
      const event = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(event, 'reason', { value: reason });
      window.dispatchEvent(event);
    };
    act(() => reject(new DOMException('x', 'AbortError')));
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => reject(new Error('falla')));
    expect(await screen.findByRole('alertdialog', { name: 'Ocurrió un problema' })).toBeInTheDocument();
  });

  it('las confirmaciones de éxito son popups (la app no usa toasts) y se pueden personalizar', async () => {
    function Trigger() {
      const feedback = useFeedback();
      return <button onClick={() => void feedback.success('Guardado', 'detalle', { details: ['Paso listo'], detailsStyle: 'checks' })}>guardar</button>;
    }
    render(<FeedbackProvider><Trigger /></FeedbackProvider>);
    await userEvent.click(screen.getByText('guardar'));
    const popup = screen.getByRole('dialog', { name: 'Guardado' });
    expect(popup).toHaveClass('msg--success');
    expect(within(popup).getByText('detalle')).toBeInTheDocument();
    expect(within(popup).getByText('Paso listo')).toBeInTheDocument();
    expect(document.querySelector('.toast, .toaster')).toBeNull();
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(screen.queryByText('Guardado')).toBeNull());
  });
});

describe('rutas protegidas', () => {
  it('redirige al login sin sesión', async () => {
    mockFetch(apiFail(500, 'NO_DEBE_LLAMARSE')); // el backend dice que no hay sesión (testSession)
    const { ProtectedRoute } = await import('../routes/ProtectedRoute');
    const { AuthProvider } = await import('../context/AuthContext');
    render(
      <MemoryRouter initialEntries={['/privado']}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/privado" element={<span>secreto</span>} />
            </Route>
            <Route path="/login" element={<span>pantalla de login</span>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('pantalla de login')).toBeInTheDocument();
    expect(screen.queryByText('secreto')).toBeNull();
  });
});
