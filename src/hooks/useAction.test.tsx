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

describe('useAction: confirmación previa', () => {
  it('cancelar no envía nada, no marca ocupado ni avisa; confirmar sigue con la acción', async () => {
    const { result } = renderHook(() => useAction<number>(), { wrapper });
    const task = vi.fn(() => Promise.resolve('ok'));
    const callbacks = { onSuccess: vi.fn(), onError: vi.fn(), onSettled: vi.fn() };
    const options = { busy: 3, errorTitle: 'No se pudo', success: ['Eliminado'] as const, ...callbacks, confirm: { kind: 'delete' as const, title: '¿Eliminar a Ana?' } };

    let done: Promise<boolean> = Promise.resolve(true);
    act(() => {
      done = result.current.run(task, options);
    });
    const dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar a Ana?' });
    expect(result.current.busy).toBeNull(); // mientras se pregunta, nada está ocupado
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(await done).toBe(false);
    expect(task).not.toHaveBeenCalled();
    Object.values(callbacks).forEach((callback) => expect(callback).not.toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => {
      done = result.current.run(task, options);
    });
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Eliminar a Ana?' })).getByRole('button', { name: 'Eliminar' }));
    expect(await done).toBe(true);
    expect(task).toHaveBeenCalledOnce();
    expect(callbacks.onSuccess).toHaveBeenCalledWith('ok');
    expect(await screen.findByRole('dialog', { name: 'Eliminado' })).toBeInTheDocument();
  });
});

describe('useSubmit', () => {
  it('"Guardando…" hasta salir de la pantalla; si falla se libera, marca el campo y explica el motivo', async () => {
    const { result } = renderHook(() => useSubmit(), { wrapper });
    const confirm = { kind: 'create' as const, title: '¿Guardar?' };
    /** Envía y confirma (todo envío de formulario pregunta antes). */
    const sendConfirmed = async (submit: typeof result.current.submit, task: () => Promise<void>, title: string, onError?: (error: unknown) => void) => {
      let done: Promise<boolean> = Promise.resolve(false);
      act(() => {
        done = submit(task, title, { confirm, onError });
      });
      await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Guardar?' })).getByRole('button', { name: 'Crear' }));
      await act(() => done);
    };
    expect(result.current.saving).toBe(false);
    await sendConfirmed(result.current.submit, () => Promise.resolve(), 'No se pudo guardar');
    expect(result.current.saving).toBe(true);

    const second = renderHook(() => useSubmit(), { wrapper });
    const onError = vi.fn();
    const failure = new ApiError({ statusCode: 409, code: 'EMAIL_TAKEN', message: 'Correo en uso' });
    await sendConfirmed(second.result.current.submit, () => Promise.reject(failure), 'No se pudo agregar', onError);
    expect(second.result.current.saving).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo agregar' })).toHaveTextContent('Correo en uso');
  });

  it('con `confirm` pregunta antes de enviar: cancelar deja el formulario como estaba', async () => {
    const { result } = renderHook(() => useSubmit(), { wrapper });
    const task = vi.fn(() => Promise.reject(new ApiError({ statusCode: 409, code: 'EMAIL_TAKEN', message: 'Correo en uso' })));
    const onError = vi.fn();
    const options = { confirm: { kind: 'create' as const, title: '¿Agregar administrador?' }, onError };
    let done: Promise<boolean> = Promise.resolve(true);
    act(() => {
      done = result.current.submit(task, 'No se pudo agregar', options);
    });
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Agregar administrador?' })).getByRole('button', { name: 'Cancelar' }));
    expect(await done).toBe(false);
    expect(task).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(false);

    act(() => {
      done = result.current.submit(task, 'No se pudo agregar', options);
    });
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Agregar administrador?' })).getByRole('button', { name: 'Crear' }));
    expect(await done).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    await closePopup('No se pudo agregar');
  });
});
