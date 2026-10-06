import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmployeeFormFields } from '../components/EmployeeForm';
import { setLocale } from '../i18n/core';
import { emptyEmployeeForm } from '../utils/formRules';
import * as availabilityService from '../services/availabilityService';
import { WithCatalogs } from '../test/render';
import { availabilityBlocks, availabilityError, liveFeedback, useAvailability } from './useAvailability';

const result = (code: string, message: string) => ({
  field: 'employee_number' as const, value: 'x', normalized: 'X', valid: code !== 'INVALID_FORMAT', available: code === 'AVAILABLE', code, message, via: 'websocket' as const,
});

afterEach(() => vi.useRealTimers());

describe('useAvailability', () => {
  it('espera a que se deje de escribir y reporta disponible / registrado', async () => {
    vi.useFakeTimers();
    const check = vi.spyOn(availabilityService, 'checkAvailability').mockImplementation((_f, value) =>
      Promise.resolve(value === 'EMP-1' ? result('TAKEN', 'Ya registrado') : result('AVAILABLE', 'Disponible')),
    );
    const { result: hook, rerender } = renderHook(({ value }) => useAvailability('employee_number', value), { initialProps: { value: 'EMP' } });
    expect(hook.current.status).toBe('checking');
    rerender({ value: 'EMP-1' });
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(check).toHaveBeenCalledOnce(); // solo el último valor (pausa entre teclas)
    expect(hook.current).toMatchObject({ status: 'taken', message: 'Ya registrado' });
    rerender({ value: 'EMP-2' });
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(hook.current.status).toBe('available');
  });

  it('ignora respuestas de valores anteriores y no consulta si no cambió', async () => {
    vi.useFakeTimers();
    let release: (v: ReturnType<typeof result>) => void = () => undefined;
    vi.spyOn(availabilityService, 'checkAvailability')
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
      .mockImplementation(() => Promise.resolve(result('AVAILABLE', 'Disponible')));
    const { result: hook, rerender } = renderHook(({ value }) => useAvailability('employee_number', value, { unchangedValue: 'EMP-7' }), {
      initialProps: { value: 'A-1' },
    });
    await act(() => vi.advanceTimersByTimeAsync(400));
    rerender({ value: 'A-2' });
    await act(() => vi.advanceTimersByTimeAsync(400));
    await act(() => {
      release(result('TAKEN', 'viejo'));
      return Promise.resolve();
    });
    expect(hook.current.status).toBe('available'); // la respuesta vieja no pisa la nueva
    rerender({ value: ' emp-7 ' });
    expect(hook.current.status).toBe('idle');
  });

  it('un código que esta versión no conoce no bloquea (el servidor valida al guardar)', async () => {
    vi.useFakeTimers();
    vi.spyOn(availabilityService, 'checkAvailability').mockResolvedValue(result('RESERVED', 'Reservado'));
    const { result: hook } = renderHook(() => useAvailability('employee_number', 'EMP-9'));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(hook.current).toMatchObject({ status: 'unknown', message: 'Reservado' });
    expect(availabilityBlocks(hook.current)).toBe(false);
  });

  it('si no se puede verificar no bloquea', async () => {
    vi.useFakeTimers();
    vi.spyOn(availabilityService, 'checkAvailability').mockRejectedValue(new Error('sin red'));
    const { result: hook } = renderHook(() => useAvailability('email', 'a@b.com'));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(hook.current.status).toBe('unknown');
  });
});

describe('EmployeeFormFields en vivo', () => {
  it('muestra verificando, disponible o el error de duplicado', () => {
    const { rerender } = render(
      <EmployeeFormFields values={emptyEmployeeForm} errors={{}} onChange={vi.fn()} live={{ employee_number: { status: 'checking' } }} />,
      { wrapper: WithCatalogs },
    );
    expect(screen.getByText('Verificando disponibilidad…')).toBeInTheDocument();
    rerender(
      <EmployeeFormFields
        values={emptyEmployeeForm}
        errors={{}}
        onChange={vi.fn()}
        live={{ employee_number: { status: 'available', message: 'Número de empleado disponible' }, email: { status: 'taken', message: 'El correo electrónico ya está registrado' } }}
      />,
    );
    expect(screen.getByText('Número de empleado disponible')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('El correo electrónico ya está registrado');
  });
});

describe('lectura del estado en vivo (única regla para formularios y campos)', () => {
  it('error: solo duplicado o formato inválido; bloquea además mientras se verifica', () => {
    expect(availabilityError({ status: 'taken', message: 'Ya registrado' })).toBe('Ya registrado');
    expect(availabilityError({ status: 'invalid', message: 'Formato inválido' })).toBe('Formato inválido');
    expect(availabilityError({ status: 'available', message: 'Disponible' })).toBeUndefined();
    expect(availabilityError(undefined)).toBeUndefined();
    expect(availabilityBlocks({ status: 'checking' })).toBe(true);
    expect(availabilityBlocks({ status: 'taken', message: 'Ya registrado' })).toBe(true);
    expect(availabilityBlocks({ status: 'linkable', message: 'Ya tiene cuenta' })).toBe(false);
    expect(availabilityBlocks({ status: 'unknown' })).toBe(false); // sin verificar no bloquea: valida el servidor
  });

  it('liveFeedback: indicador junto al control o error inmediato', () => {
    expect(liveFeedback({ status: 'checking' }).status).toEqual({ tone: 'checking', text: 'Verificando disponibilidad…' });
    expect(liveFeedback({ status: 'available', message: 'Disponible' }).status).toEqual({ tone: 'success', text: 'Disponible' });
    expect(liveFeedback({ status: 'linkable', message: 'Ya tiene cuenta' }).status).toEqual({ tone: 'info', text: 'Ya tiene cuenta' });
    expect(liveFeedback({ status: 'taken', message: 'Ya registrado' })).toEqual({ error: 'Ya registrado' });
    expect(liveFeedback({ status: 'idle' })).toEqual({});
    expect(liveFeedback(undefined)).toEqual({});
  });

  it('en inglés: "Checking availability…" (el texto se pide al dibujar; el del servidor llega traducido)', async () => {
    await setLocale('en-US');
    expect(liveFeedback({ status: 'checking' }).status).toEqual({ tone: 'checking', text: 'Checking availability…' });
    expect(liveFeedback({ status: 'available', message: 'Available' }).status).toEqual({ tone: 'success', text: 'Available' });
  });
});
