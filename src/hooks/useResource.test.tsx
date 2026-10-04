import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { ApiError } from '../services/apiClient';
import { useResource } from './useResource';

const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;

interface Call {
  id: number;
  signal: AbortSignal;
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
}

/** Responde una petición pendiente y deja que React aplique lo que resulte. */
const settle = (respond: () => void) =>
  act(() => {
    respond();
    return Promise.resolve();
  });

/** Recurso cuyas peticiones la prueba resuelve a mano (para simular respuestas tardías). */
function renderResource(initialId = 1) {
  const calls: Call[] = [];
  const fetch = (id: number) => (signal: AbortSignal) =>
    new Promise<string>((resolve, reject) => calls.push({ id, signal, resolve, reject }));
  const view = renderHook(({ id }) => useResource(fetch(id), id, 'No se pudo cargar el registro'), { wrapper, initialProps: { id: initialId } });
  return { ...view, calls };
}

describe('useResource', () => {
  it('pide al montar con una señal de cancelación y entrega el dato', async () => {
    const { result, calls } = renderResource();
    expect(calls).toHaveLength(1);
    expect(calls[0].signal.aborted).toBe(false);
    expect(result.current.data).toBeNull();
    await settle(() => calls[0].resolve('empresa 1'));
    expect(result.current.data).toBe('empresa 1');
    expect(result.current.error).toBeNull();
  });

  it('al cambiar de registro aborta la petición anterior y su respuesta tardía no pisa la nueva', async () => {
    const { result, rerender, calls } = renderResource();
    rerender({ id: 2 });
    rerender({ id: 3 });
    expect(calls.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(calls.map((c) => c.signal.aborted)).toEqual([true, true, false]);
    await settle(() => calls[2].resolve('empresa 3'));
    await settle(() => calls[0].resolve('empresa 1 (tarde)'));
    // El rechazo de una petición cancelada tampoco se reporta como error.
    await settle(() => calls[1].reject(new DOMException('cancelada', 'AbortError')));
    expect(result.current.data).toBe('empresa 3');
    expect(result.current.error).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('al salir de la pantalla aborta la petición en curso', () => {
    const { unmount, calls } = renderResource();
    unmount();
    expect(calls[0].signal.aborted).toBe(true);
  });

  it('el error se explica en un popup con "Reintentar"; reintentar vuelve a pedir y limpia el error', async () => {
    const { result, calls } = renderResource();
    await settle(() => calls[0].reject(new ApiError({ statusCode: 503, code: 'SERVER_BUSY', message: 'Ocupado' })));
    expect(result.current.error).toBeInstanceOf(ApiError);
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el registro' });
    expect(popup).toHaveTextContent('Ocupado');
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    // La petición sale dentro del efecto; el estado sin error llega en el siguiente render.
    await waitFor(() => expect(result.current.error).toBeNull());
    await settle(() => calls[1].resolve('empresa 1'));
    expect(result.current.data).toBe('empresa 1');
  });

  it('setData reemplaza el dato (p. ej. con lo que devolvió una acción)', async () => {
    const fetch = vi.fn((_signal: AbortSignal) => Promise.resolve('original'));
    const { result } = renderHook(() => useResource(fetch, 'k', 'No se pudo cargar'), { wrapper });
    await waitFor(() => expect(result.current.data).toBe('original'));
    act(() => result.current.setData('actualizado'));
    expect(result.current.data).toBe('actualizado');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
