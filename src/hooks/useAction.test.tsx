import { act, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { ApiError } from '../services/apiClient';
import { useAction, useSubmit } from './useAction';

const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;

/** Promesa que la prueba resuelve o rechaza cuando quiere (para ver el estado "ocupado"). */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const closePopup = async (name: string) => {
  const popup = await screen.findByRole('alertdialog', { name });
  await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
};

describe('useAction', () => {
  it('marca qué se procesa, aplica el resultado y avisa el éxito (el aviso puede usar el resultado)', async () => {
    const { result } = renderHook(() => useAction<number>(), { wrapper });
    const pending = deferred<{ name: string }>();
    const onSuccess = vi.fn();
    const onSettled = vi.fn();
    let done: Promise<boolean> = Promise.resolve(false);
    act(() => {
      done = result.current.run(() => pending.promise, {
        busy: 7,
        errorTitle: 'No se pudo',
        success: (saved) => ['Guardado', `${saved.name} quedó listo.`],
        onSuccess,
        onSettled,
      });
    });
    expect(result.current.busy).toBe(7);
    await act(async () => {
      pending.resolve({ name: 'Recepción' });
      expect(await done).toBe(true);
    });
    expect(result.current.busy).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith({ name: 'Recepción' });
    expect(onSettled).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Guardado' })).toHaveTextContent('Recepción quedó listo.');
  });

  it('si falla: revierte, explica el error con su título y se libera', async () => {
    const { result } = renderHook(() => useAction(), { wrapper });
    const onError = vi.fn();
    const onSuccess = vi.fn();
    const failure = new ApiError({ statusCode: 409, code: 'API_KEY_LIMIT', message: 'Ya tienes 10 llaves' });
    let ok = true;
    await act(async () => {
      ok = await result.current.run(() => Promise.reject(failure), {
        errorTitle: (error) => (error instanceof ApiError && error.code === 'API_KEY_LIMIT' ? 'Llegaste al tope' : 'No se pudo'),
        success: ['No debe verse'],
        onSuccess,
        onError,
      });
    });
    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.busy).toBeNull();
    expect(screen.getByRole('alertdialog', { name: 'Llegaste al tope' })).toHaveTextContent('Ya tienes 10 llaves');
    expect(screen.queryByRole('dialog', { name: 'No debe verse' })).toBeNull();
  });

  it('sin aviso de éxito no abre popup; keepBusy sigue ocupado tras salir bien (la pantalla se va)', async () => {
    const { result } = renderHook(() => useAction<string>(), { wrapper });
    await act(async () => {
      await result.current.run(() => Promise.resolve(), { errorTitle: 'No se pudo' });
    });
    expect(result.current.busy).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => {
      await result.current.run(() => Promise.resolve(), { busy: 'all', errorTitle: 'No se pudo', keepBusy: true });
    });
    expect(result.current.busy).toBe('all');
  });

  it('keepBusy se libera si falla, para poder corregir y reintentar', async () => {
    const { result } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('sin red')), { errorTitle: 'No se pudo cerrar', keepBusy: true });
    });
    expect(result.current.busy).toBeNull();
    await closePopup('No se pudo cerrar');
  });

  it('no toca el estado de una pantalla que ya se cerró', async () => {
    const { result, unmount } = renderHook(() => useAction(), { wrapper });
    const pending = deferred<void>();
    let done: Promise<boolean> = Promise.resolve(false);
    act(() => {
      done = result.current.run(() => pending.promise, { errorTitle: 'No se pudo' });
    });
    unmount();
    pending.resolve();
    await expect(done).resolves.toBe(true);
  });
});

describe('useSubmit', () => {
  it('"Guardando…" hasta salir de la pantalla; si falla se libera, marca el campo y explica el motivo', async () => {
    const { result } = renderHook(() => useSubmit(), { wrapper });
    expect(result.current.saving).toBe(false);
    await act(async () => {
      await result.current.submit(() => Promise.resolve(), 'No se pudo guardar');
    });
    expect(result.current.saving).toBe(true);

    const second = renderHook(() => useSubmit(), { wrapper });
    const onError = vi.fn();
    const failure = new ApiError({ statusCode: 409, code: 'EMAIL_TAKEN', message: 'Correo en uso' });
    await act(async () => {
      await second.result.current.submit(() => Promise.reject(failure), 'No se pudo agregar', onError);
    });
    expect(second.result.current.saving).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo agregar' })).toHaveTextContent('Correo en uso');
  });
});
