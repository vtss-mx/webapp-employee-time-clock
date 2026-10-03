import { act, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { ApiError } from '../services/apiClient';
import { apiOk, mockFetch } from '../test/http';
import { serverFieldErrors, useEmployeeForm } from './useEmployeeForm';
import { notifyEnrollmentsChanged, usePendingEnrollments } from './usePendingEnrollments';
import { usePolling } from './usePolling';
import { useFeedback } from './useFeedback';
import * as availability from '../services/availabilityService';

afterEach(() => vi.useRealTimers());

describe('usePolling', () => {
  it('consulta periódicamente con jitter y aplica backoff ante errores', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter neutro (factor 1.0)
    let fail = true;
    const task = vi.fn(() => (fail ? Promise.reject(new Error('x')) : Promise.resolve()));
    renderHook(() => usePolling(task, { intervalMs: 1000 }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(task).toHaveBeenCalledTimes(1); // inmediata
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(task).toHaveBeenCalledTimes(1); // backoff: ahora espera 2 s
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(task).toHaveBeenCalledTimes(2);
    fail = false;
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(task).toHaveBeenCalledTimes(3);
    await act(() => vi.advanceTimersByTimeAsync(1000)); // vuelve al intervalo base
    expect(task).toHaveBeenCalledTimes(4);
  });

  it('se pausa con la pestaña oculta y reanuda al volver (sin ráfagas)', async () => {
    vi.useFakeTimers();
    const task = vi.fn(() => Promise.resolve());
    let state: DocumentVisibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state);
    renderHook(() => usePolling(task, { intervalMs: 1000, immediate: false }));
    state = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(task).not.toHaveBeenCalled();
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(task).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('focus')); // < 5 s desde la última: no repite de inmediato
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('no consulta deshabilitado', () => {
    const task = vi.fn(() => Promise.resolve());
    renderHook(() => usePolling(task, { intervalMs: 1000, enabled: false }));
    expect(task).not.toHaveBeenCalled();
  });
});

describe('usePendingEnrollments', () => {
  it('obtiene el total y se actualiza al notificar cambios', async () => {
    let total = 3;
    mockFetch(() => apiOk({ items: [], total, page: 1, size: 1 }));
    const { result } = renderHook(() => usePendingEnrollments(true));
    await waitFor(() => expect(result.current).toBe(3));
    total = 1;
    act(() => notifyEnrollmentsChanged());
    await waitFor(() => expect(result.current).toBe(1));
  });
});

describe('useEmployeeForm', () => {
  const valid = { first_name: 'Ana', last_name: 'Ruiz', birth_date: '1990-01-01', employee_number: 'EMP-1', rfc: 'RUAA900101AB1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '+526621234567', email: 'a@e.com', password: 'Segura123', password_confirm: 'Segura123' };

  const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;

  it('el botón solo se habilita con todo correcto y verificado; cada error se ve al salir del campo', async () => {
    vi.spyOn(availability, 'checkAvailability').mockImplementation((field, value) =>
      Promise.resolve({ field, value, normalized: value, valid: true, available: true, code: 'AVAILABLE', message: 'Disponible', via: 'http' }),
    );
    const { result } = renderHook(() => useEmployeeForm(), { wrapper });
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.errors).toEqual({}); // nada marcado antes de tocar los campos
    act(() => result.current.touch('rfc'));
    expect(result.current.errors.rfc).toBe('El RFC es obligatorio');

    act(() => result.current.setValues(valid));
    await waitFor(() => expect(result.current.canSubmit).toBe(true)); // tras verificar en vivo los datos únicos
    let ok = false;
    act(() => {
      ok = result.current.validate();
    });
    expect(ok).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it('persona de otra empresa (correo LINKABLE): se vincula sin contraseña', async () => {
    vi.spyOn(availability, 'checkAvailability').mockImplementation((field, value) =>
      Promise.resolve({
        field, value, normalized: value, valid: true, available: true, via: 'http',
        code: field === 'email' ? 'LINKABLE' : 'AVAILABLE',
        message: field === 'email' ? 'Ya tiene cuenta' : 'Disponible',
      }),
    );
    const { result } = renderHook(() => useEmployeeForm(), { wrapper });
    act(() => result.current.setValues({ ...valid, password: '', password_confirm: '' }));
    await waitFor(() => expect(result.current.linking).toBe(true));
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    expect(serverFieldErrors(new ApiError({ statusCode: 409, code: 'ACCOUNT_PHONE_MISMATCH', message: 'otro teléfono' }))).toEqual({
      phone: 'otro teléfono',
    });
  });

  it('persona en varias empresas: el teléfono se valida en vivo junto con el correo escrito', async () => {
    const check = vi.spyOn(availability, 'checkAvailability').mockImplementation((field, value, _exclude, related) =>
      Promise.resolve({
        field, value, normalized: value, valid: true, via: 'http',
        ...(field === 'phone' && related === 'a@e.com'
          ? { available: false, code: 'MISMATCH', message: 'Ese correo ya tiene una cuenta con otro teléfono' }
          : { available: true, code: field === 'email' ? 'LINKABLE' : 'AVAILABLE', message: 'Ok' }),
      }),
    );
    const { result } = renderHook(() => useEmployeeForm(), { wrapper });
    act(() => result.current.setValues({ ...valid, password: '', password_confirm: '' }));
    await waitFor(() => expect(result.current.live.phone).toMatchObject({ status: 'taken', message: 'Ese correo ya tiene una cuenta con otro teléfono' }));
    expect(result.current.canSubmit).toBe(false);
    expect(check).toHaveBeenCalledWith('phone', valid.phone, undefined, 'a@e.com');
  });

  it('al editar, el teléfono se valida solo (no se vincula a nadie)', async () => {
    const check = vi.spyOn(availability, 'checkAvailability').mockImplementation((field, value) =>
      Promise.resolve({ field, value, normalized: value, valid: true, available: true, code: 'AVAILABLE', message: 'Ok', via: 'http' }),
    );
    const { result } = renderHook(() => useEmployeeForm({ excludeId: 7, passwordOptional: true }), { wrapper });
    act(() => result.current.setValues({ ...valid, password: '', password_confirm: '' }));
    await waitFor(() => expect(check).toHaveBeenCalledWith('phone', valid.phone, 7, undefined));
  });

  it('red de seguridad al enviar con datos incompletos: marca todo y resume en un popup', async () => {
    const { result } = renderHook(() => useEmployeeForm(), { wrapper });
    act(() => void result.current.validate());
    expect(result.current.errors.curp).toBe('La CURP es obligatoria');
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa la información' });
    expect(popup).toHaveTextContent('El NSS es obligatorio');
  });

  it('muestra errores del servidor por campo', async () => {
    const { result } = renderHook(() => useEmployeeForm(), { wrapper });
    await act(() =>
      result.current.save(() => Promise.reject(new ApiError({ statusCode: 409, code: 'EMAIL_TAKEN', message: 'Correo en uso' }))),
    );
    expect(result.current.errors.email).toBe('Correo en uso');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo guardar' })).toHaveTextContent('Correo en uso');
    expect(result.current.saving).toBe(false);
    expect(serverFieldErrors(new Error('x'))).toEqual({});
    expect(serverFieldErrors(new ApiError({ statusCode: 409, code: 'EMPLOYEE_NUMBER_TAKEN', message: 'n' }))).toEqual({ employee_number: 'n' });
  });
});

describe('useFeedback', () => {
  it('requiere el provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useFeedback())).toThrow(/FeedbackProvider/);
    const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;
    expect(renderHook(() => useFeedback(), { wrapper }).result.current.fromError).toBeTypeOf('function');
  });
});
