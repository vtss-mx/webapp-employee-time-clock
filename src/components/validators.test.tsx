import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { useCountdown } from '../hooks/useCountdown';
import { checkpointService } from '../services/checkpointService';
import { validatorService } from '../services/validatorService';
import { catalogsFixture, catalogsWith, testCatalogs } from '../test/catalogs';
import { identifiedResult as identified, sampleValidator } from '../test/fixtures';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { WithCatalogs } from '../test/render';
import type { ValidatorMode } from '../types';
import { ValidatorModal, type ValidatorDialog } from './ValidatorModal';
import { ValidatorModeBadge, ValidatorModePicker, availableMethods } from './ValidatorModes';
import { VerificationResultCard } from './VerificationResultCard';

const wrapper = ({ children }: { children: ReactNode }) => (
  <FeedbackProvider>
    <WithCatalogs>{children}</WithCatalogs>
  </FeedbackProvider>
);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('validatorService y checkpointService', () => {
  it.each([
    ['list', () => validatorService.list(), [sampleValidator], 'GET', '/api/validators'],
    ['update', () => validatorService.update(3, { mode: 'QR' }), sampleValidator, 'PUT', '/api/validators/3'],
    ['setStatus', () => validatorService.setStatus(3, false), sampleValidator, 'PATCH', '/api/validators/3/status'],
    ['resetPassword', () => validatorService.resetPassword(3, 'Nueva1234'), sampleValidator, 'PUT', '/api/validators/3/password'],
    ['remove', () => validatorService.remove(3), null, 'DELETE', '/api/validators/3'],
    ['profile', () => checkpointService.profile(), { id: 3, name: 'Recepción', mode: 'QR', company: { id: 1, name: 'Mi empresa' } }, 'GET', '/api/checkpoint/me'],
    ['recent', () => checkpointService.recent(5), [], 'GET', '/api/checkpoint/recent?limit=5'],
    ['identifyQr', () => checkpointService.identifyQr('TCQR1:abc'), identified, 'POST', '/api/checkpoint/identify/qr'],
    ['inspectQr', () => checkpointService.inspectQr('TCQR1:abc'), { employee_id: 7, name: 'Ana Ruiz', employee_number: 'EMP-7' }, 'POST', '/api/checkpoint/qr/inspect'],
  ])('%s', async (_name, call, data, method, url) => {
    const { calls } = mockFetch(apiOk(data));
    await call();
    expect(calls[0].init.method ?? 'GET').toBe(method);
    expect(calls[0].url).toBe(url);
  });

  it('alta con datos limpios y rostro con el QR del modo "QR y rostro"', async () => {
    const { calls } = mockFetch(apiOk(sampleValidator), apiOk(identified));
    await validatorService.create({ name: '  Recepción ', email: ' Recepcion@Empresa.com ', password: 'Valida1234', mode: 'FACE' });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: 'Recepción', email: 'recepcion@empresa.com', password: 'Valida1234', mode: 'FACE' });
    await checkpointService.identifyFace([new Blob(['x'])], { id: 'c1', image: new Blob(['y']) }, 'TCQR1:abc');
    const form = calls[1].init.body as FormData;
    expect(calls[1].url).toBe('/api/checkpoint/identify/face');
    expect(form.get('qr_content')).toBe('TCQR1:abc');
    expect(form.get('challenge_id')).toBe('c1');
    expect(form.getAll('images')).toHaveLength(1);
  });
});

describe('modos del validador', () => {
  const mode = (code: ValidatorMode) => testCatalogs.byCode('validator_modes', code);

  it('métodos disponibles: los del catálogo según el modo, sin QR si la empresa lo desactivó', () => {
    expect(availableMethods(mode('QR_OR_FACE'), true)).toEqual(['FACE', 'QR']);
    expect(availableMethods(mode('QR_OR_FACE'), false)).toEqual(['FACE']);
    expect(availableMethods(mode('QR'), false)).toEqual([]);
    expect(availableMethods(mode('QR_AND_FACE'), true)).toEqual(['QR_FACE']);
    expect(availableMethods(mode('QR_AND_FACE'), false)).toEqual([]);
    expect(availableMethods(undefined, true)).toEqual([]); // modo que el catálogo no tiene
  });

  it('solo ofrece los modos activos; la insignia nombra también uno inactivo o desconocido', () => {
    const catalogs = catalogsWith({
      validator_modes: catalogsFixture.validator_modes.map((m) => (m.code === 'QR' ? { ...m, active: false } : m)),
    });
    render(
      <WithCatalogs catalogs={catalogs}>
        <ValidatorModePicker value="FACE" onChange={vi.fn()} />
        <ValidatorModeBadge mode="QR" />
        <ValidatorModeBadge mode={'KIOSK' as ValidatorMode} />
      </WithCatalogs>,
    );
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['QR_OR_FACE', 'FACE', 'QR_AND_FACE']);
    expect(screen.getByText('Solo QR')).toHaveClass('mode-badge');
    expect(screen.getByText('KIOSK')).toHaveClass('mode-badge');
  });

  it('insignia y selección con tarjetas (grupo de radio)', async () => {
    function Harness() {
      const [mode, setMode] = useState<ValidatorMode>('QR_OR_FACE');
      return (
        <>
          <ValidatorModePicker value={mode} onChange={setMode} />
          <ValidatorModeBadge mode={mode} />
        </>
      );
    }
    render(<Harness />, { wrapper });
    expect(screen.getByRole('radio', { name: /QR o rostro/ })).toBeChecked();
    await userEvent.click(screen.getByText('QR y rostro'));
    expect(screen.getByRole('radio', { name: /QR y rostro/ })).toBeChecked();
    expect(screen.getAllByText('QR y rostro')).toHaveLength(2); // tarjeta e insignia
  });

  it('etiquetas de la bitácora desde el catálogo', () => {
    expect(testCatalogs.nameOf('verification_methods', 'QR_FACE')).toBe('QR + rostro');
    expect(testCatalogs.nameOf('verification_reasons', 'AMBIGUOUS_MATCH', 'Fallida')).toBe('Parecido a varias personas');
    expect(testCatalogs.nameOf('verification_reasons', 'OTHER_COMPANY', 'Fallida')).toBe('QR no reconocido');
    expect(testCatalogs.nameOf('verification_reasons', null, 'Fallida')).toBe('Fallida');
  });
});

describe('ValidatorModal', () => {
  function open(dialog: ValidatorDialog) {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<ValidatorModal dialog={dialog} onSaved={onSaved} onClose={onClose} />, { wrapper });
    return { onSaved, onClose };
  }

  it('alta: nombre, correo, contraseña y modo; correo repetido se marca en el campo', async () => {
    const { calls } = mockFetch(apiFail(409, 'EMAIL_TAKEN', 'Ese correo ya está registrado'), apiOk(sampleValidator));
    const { onSaved, onClose } = open({ kind: 'create' });
    const add = screen.getByRole('button', { name: 'Agregar' });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Nombre o ubicación/), 'R');
    await userEvent.tab();
    expect(screen.getByText(/Escribe un nombre o ubicación/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Nombre o ubicación/), 'ecepción planta 1');
    await userEvent.type(screen.getByLabelText(/Correo de acceso/), 'recepcion@empresa.com');
    await userEvent.type(screen.getByLabelText(/Contraseña inicial/), 'Valida1234');
    await userEvent.click(screen.getByText('Solo QR'));
    await userEvent.click(add);

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('No se pudo agregar el validador')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Ese correo ya está registrado')).toBeInTheDocument();
    expect(add).toBeDisabled(); // hasta que cambie el correo
    await userEvent.type(screen.getByLabelText(/Correo de acceso/), 'x');
    expect(add).toBeEnabled();
    await userEvent.click(add);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(sampleValidator));
    expect(onClose).toHaveBeenCalled();
    expect(JSON.parse(calls[1].init.body as string)).toMatchObject({ name: 'Recepción planta 1', mode: 'QR', password: 'Valida1234' });
  });

  it('edición: solo nombre y modo; restablecer: solo la contraseña', async () => {
    const { calls } = mockFetch(apiOk({ ...sampleValidator, mode: 'FACE' }), apiOk(sampleValidator));
    open({ kind: 'edit', validator: sampleValidator });
    expect(screen.queryByLabelText(/Correo de acceso/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Contraseña/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Solo rostro'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe('/api/validators/3');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: 'Recepción planta 1', mode: 'FACE' });
    expect(await screen.findByText('Validador actualizado')).toBeInTheDocument();
  });

  it('restablecer contraseña', async () => {
    const { calls } = mockFetch(apiOk(sampleValidator));
    const { onSaved } = open({ kind: 'password', validator: sampleValidator });
    expect(screen.queryByLabelText(/Nombre o ubicación/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Contraseña nueva/), 'Nueva1234');
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls[0].url).toBe('/api/validators/3/password');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ password: 'Nueva1234' });
  });
});

describe('resultado en el punto de control (kiosco)', () => {
  it('textos para el operador y regreso automático a la siguiente persona', () => {
    vi.useFakeTimers();
    const onBack = vi.fn();
    render(<VerificationResultCard result={identified} failureTitle="No" onRetry={vi.fn()} onBack={onBack} kiosk={{ autoReturnSeconds: 3 }} />);
    expect(screen.getByText('Empleado identificado')).toBeInTheDocument();
    expect(screen.getByText('Identidad confirmada: Ana Ruiz.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente persona (3)' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: 'Siguiente persona (2)' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(onBack).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('sin éxito: reintentar o volver al inicio', () => {
    render(<VerificationResultCard result={{ ...identified, verified: false, message: 'Rostro no reconocido' }} failureTitle="Empleado no identificado" onRetry={vi.fn()} onBack={vi.fn()} kiosk={{ autoReturnSeconds: 8 }} />);
    expect(screen.getByText('Rostro no reconocido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver al inicio (8)' })).toBeInTheDocument();
  });

  it('useCountdown sin segundos no hace nada', () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useCountdown(undefined, onDone));
    expect(result.current).toBeNull();
  });
});
