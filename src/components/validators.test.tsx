import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { useCountdown } from '../hooks/useCountdown';
import { checkpointService } from '../services/checkpointService';
import { validatorService } from '../services/validatorService';
import { catalogsFixture, catalogsWith, testCatalogs } from '../test/catalogs';
import { identifiedResult as identified, sampleValidator } from '../test/fixtures';
import { apiOk, mockFetch } from '../test/http';
import { WithCatalogs } from '../test/render';
import type { ValidatorMode } from '../types';
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
    ['list', () => validatorService.list({ page: 2, size: 20 }), { items: [sampleValidator], total: 21, page: 2, size: 20, active: 3, limit: 5 }, 'GET', '/api/validators?page=2&size=20'],
    ['update', () => validatorService.update(3, { mode: 'QR' }), sampleValidator, 'PUT', '/api/validators/3'],
    ['setStatus', () => validatorService.setStatus(3, false), sampleValidator, 'PATCH', '/api/validators/3/status'],
    ['resetPassword', () => validatorService.resetPassword(3, 'Nueva1234568'), sampleValidator, 'PUT', '/api/validators/3/password'],
    ['remove', () => validatorService.remove(3), null, 'DELETE', '/api/validators/3'],
    ['profile', () => checkpointService.profile(), { id: 3, name: 'Recepción', mode: 'QR', company: { id: 1, name: 'Mi empresa' } }, 'GET', '/api/checkpoint/me'],
    ['recent', () => checkpointService.recent({ page: 2, size: 5 }), { items: [], total: 0, page: 2, size: 5 }, 'GET', '/api/checkpoint/recent?page=2&size=5'],
    ['identifyQr', () => checkpointService.identifyQr('TCQR1:abc'), identified, 'POST', '/api/checkpoint/identify/qr'],
    ['inspectQr', () => checkpointService.inspectQr('TCQR1:abc'), { employee_id: 7, name: 'Ana Ruiz', employee_number: 'EMP-7' }, 'POST', '/api/checkpoint/qr/inspect'],
  ])('%s', async (_name, call, data, method, url) => {
    const { calls } = mockFetch(apiOk(data));
    await call();
    expect(calls[0].init.method ?? 'GET').toBe(method);
    expect(calls[0].url).toBe(url);
  });

  it('la lista trae el uso del límite que fija el ADMIN: sin él, la respuesta no sirve', async () => {
    mockFetch(apiOk({ items: [sampleValidator], total: 1, page: 1, size: 10 }));
    await expect(validatorService.list({ page: 1, size: 10 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('alta con datos limpios y rostro con el QR del modo "QR y rostro"', async () => {
    const { calls } = mockFetch(apiOk(sampleValidator), apiOk(identified));
    const settings = { address: sampleValidator.address!, location_required: true, location_radius_m: 120 };
    await validatorService.create({ name: '  Recepción ', email: ' Recepcion@Empresa.com ', password: 'Valida123456', mode: 'FACE', ...settings });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: 'Recepción', email: 'recepcion@empresa.com', password: 'Valida123456', mode: 'FACE', ...settings });
    await checkpointService.identifyFace({ frontal: [new Blob(['x'])], challenge: { id: 'c1', images: [new Blob(['y']), new Blob(['z'])] }, camera: 'FaceTime HD Camera' }, 'TCQR1:abc');
    const form = calls[1].init.body as FormData;
    expect(calls[1].url).toBe('/api/checkpoint/identify/face');
    expect(form.get('qr_content')).toBe('TCQR1:abc');
    expect(form.get('challenge_id')).toBe('c1');
    expect(form.getAll('images')).toHaveLength(1);
    expect(form.getAll('challenge_image')).toHaveLength(2); // una captura por giro, en orden
    expect(form.get('camera_label')).toBe('FaceTime HD Camera');
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
