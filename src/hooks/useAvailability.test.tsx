import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmployeeFormFields, emptyEmployeeForm } from '../components/EmployeeForm';
import * as availabilityService from '../services/availabilityService';
import { WithCatalogs } from '../test/render';
import { useAvailability } from './useAvailability';

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
