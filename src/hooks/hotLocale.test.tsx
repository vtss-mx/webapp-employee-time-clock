import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { currentLocale, setLocale } from '../i18n/core';
import { ApiError } from '../services/apiClient';
import type { Page } from '../types';
import { validateEmail } from '../utils/validation';
import { useAction, useSubmit } from './useAction';
import { useConfirm } from './useConfirm';
import { useFormState } from './useFormState';
import { usePagedList } from './usePagedList';
import { useResource } from './useResource';
import { useSearchList } from './useSearchList';

/**
 * Cambio de idioma EN CALIENTE con popups abiertos (regla 16 de la raíz): una confirmación, un aviso
 * de éxito o el popup de un error abiertos cambian sus textos (títulos de una función y botones por
 * omisión) sin cerrarse y sin perder lo que la persona estaba haciendo. Un título fijo (string) se
 * sigue mostrando tal cual.
 */

const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;

/** Un texto que depende del idioma activo al calcularse (como `() => t('…')`). */
const say = (es: string, en: string) => () => (currentLocale() === 'en-US' ? en : es);

const serverError = () => new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Falla del servidor' });

describe('useAction: popups que siguen al idioma', () => {
  it('confirmación abierta: título de una función y botones por omisión cambian sin cerrarla ni enviar nada', async () => {
    const { result } = renderHook(() => useAction<number>(), { wrapper });
    const task = vi.fn(() => Promise.resolve('ok'));
    let done: Promise<boolean> = Promise.resolve(false);
    act(() => {
      done = result.current.run(task, { busy: 3, errorTitle: say('No se pudo eliminar', 'Could not delete'), confirm: () => ({ kind: 'delete', title: say('¿Eliminar a Ana?', 'Delete Ana?')() }) });
    });
    const spanish = await screen.findByRole('alertdialog', { name: '¿Eliminar a Ana?' });
    expect(within(spanish).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();

    await act(() => setLocale('en-US'));
    const english = screen.getByRole('alertdialog', { name: 'Delete Ana?' });
    expect(within(english).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(task).not.toHaveBeenCalled(); // sigue preguntando: nada se envió
    expect(result.current.busy).toBeNull();

    await userEvent.click(within(english).getByRole('button', { name: 'Delete' }));
    expect(await done).toBe(true);
    expect(task).toHaveBeenCalledOnce();
  });

  it('aviso de éxito abierto (de una función) y error abierto con título de una función: cambian al idioma nuevo', async () => {
    const { result } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.run(() => Promise.resolve('Recepción'), { errorTitle: 'No se pudo', success: (name) => [say('Guardado', 'Saved')(), say(`${name} quedó listo.`, `${name} is ready.`)()] });
    });
    expect(screen.getByRole('dialog', { name: 'Guardado' })).toHaveTextContent('Recepción quedó listo.');
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('dialog', { name: 'Saved' })).toHaveTextContent('Recepción is ready.');
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Saved' })).getByRole('button', { name: 'Got it' }));

    await act(() => setLocale('es-MX'));
    await act(async () => {
      await result.current.run(() => Promise.reject(serverError()), { errorTitle: say('No se pudo rotar la llave', 'Could not rotate the key') });
    });
    expect(screen.getByRole('alertdialog', { name: 'No se pudo rotar la llave' })).toHaveTextContent('Falla del servidor');
    await act(() => setLocale('en-US'));
    const popup = screen.getByRole('alertdialog', { name: 'Could not rotate the key' });
    expect(popup).toHaveTextContent('Falla del servidor'); // el mensaje del servidor no se traduce aquí
    expect(within(popup).getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  it('un título fijo (string) sigue funcionando: se muestra tal cual en cualquier idioma', async () => {
    const { result } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.run(() => Promise.reject(serverError()), { errorTitle: 'Título fijo' });
    });
    expect(screen.getByRole('alertdialog', { name: 'Título fijo' })).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('alertdialog', { name: 'Título fijo' })).toHaveTextContent('Got it');
  });
});

describe('useSubmit y useConfirm: confirmación abierta al cambiar el idioma', () => {
  it('useSubmit: la confirmación de una función cambia y, al fallar, el popup usa el título del idioma activo', async () => {
    const { result } = renderHook(() => useSubmit(), { wrapper });
    let done: Promise<boolean> = Promise.resolve(true);
    act(() => {
      done = result.current.submit(() => Promise.reject(serverError()), say('No se pudo guardar', 'Could not save'), { confirm: () => ({ kind: 'create', title: say('¿Crear el turno?', 'Create the shift?')() }) });
    });
    expect(within(await screen.findByRole('dialog', { name: '¿Crear el turno?' })).getByRole('button', { name: 'Crear' })).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Create the shift?' })).getByRole('button', { name: 'Create' }));
    expect(await done).toBe(false);
    expect(await screen.findByRole('alertdialog', { name: 'Could not save' })).toBeInTheDocument();
    expect(result.current.saving).toBe(false);
  });

  it('useConfirm: una confirmación fija (objeto) conserva su título y traduce solo sus botones por omisión', async () => {
    const { result } = renderHook(() => useConfirm(), { wrapper });
    let done: Promise<boolean> = Promise.resolve(true);
    act(() => {
      done = result.current({ kind: 'edit', title: 'Acme', changes: [{ label: 'Nombre', before: 'A', after: 'B' }] });
    });
    expect(within(await screen.findByRole('dialog', { name: 'Acme' })).getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    const dialog = screen.getByRole('dialog', { name: 'Acme' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await done).toBe(false);
  });
});

describe('useFormState: lo capturado no se pierde al cambiar el idioma', () => {
  const options = { serverErrors: () => ({}) };

  it('save: la confirmación abierta cambia de idioma y los valores siguen ahí', async () => {
    const { result } = renderHook(() => useFormState({ email: '' }, options), { wrapper });
    act(() => result.current.setValues({ email: 'ana@empresa.com' }));
    const task = vi.fn(() => Promise.resolve());
    act(() => {
      void result.current.save(task, say('No se pudo guardar', 'Could not save'), () => ({ kind: 'create', title: say('¿Registrar a Ana?', 'Register Ana?')() }));
    });
    await screen.findByRole('dialog', { name: '¿Registrar a Ana?' });
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('dialog', { name: 'Register Ana?' })).toBeInTheDocument();
    expect(result.current.values).toEqual({ email: 'ana@empresa.com' });
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(task).toHaveBeenCalledOnce());
  });

  it('saveIfValid: el resumen de lo que falta (errores de una función) cambia de idioma y no se envía nada', async () => {
    const { result } = renderHook(() => useFormState({ email: '' }, options), { wrapper });
    const task = vi.fn(() => Promise.resolve());
    act(() => result.current.saveIfValid(() => ({ email: validateEmail(result.current.values.email) }), task, 'No se pudo', () => ({ title: '¿Guardar?' })));
    const summary = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(summary).toHaveTextContent('El correo es obligatorio');
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('alertdialog', { name: 'Check the details' })).toHaveTextContent('Email is required');
    expect(task).not.toHaveBeenCalled();
    expect(result.current.visibleErrors({ email: validateEmail('') })).toEqual({ email: 'Email is required' });
  });

  it('saveIfValid con todo correcto pregunta con la confirmación (armada al dibujarse) y reset vuelve al inicio', async () => {
    const { result } = renderHook(() => useFormState({ email: '' }, options), { wrapper });
    act(() => result.current.setValues({ email: 'ana@empresa.com' }));
    const task = vi.fn(() => Promise.resolve());
    act(() => result.current.saveIfValid({}, task, 'No se pudo', () => ({ kind: 'edit', title: say('¿Guardar el correo?', 'Save the email?')() })));
    await screen.findByRole('dialog', { name: '¿Guardar el correo?' });
    await act(() => setLocale('en-US'));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Save the email?' })).getByRole('button', { name: 'Cancel' }));
    expect(task).not.toHaveBeenCalled();
    expect(result.current.values).toEqual({ email: 'ana@empresa.com' });
    act(() => result.current.reset());
    expect(result.current.values).toEqual({ email: '' });
  });
});

describe('listas y recursos: el popup de la carga que falló sigue al idioma', () => {
  const failingPage = () => Promise.reject<Page<string>>(serverError());

  it('useResource: título de una función y "Reintentar" cambian; reintentar sigue funcionando', async () => {
    const fetch = vi.fn<(signal: AbortSignal) => Promise<string>>().mockRejectedValueOnce(serverError()).mockResolvedValue('empresa');
    const { result } = renderHook(() => useResource(fetch, 1, say('No se pudo cargar la empresa', 'Could not load the company')), { wrapper });
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar la empresa' });
    expect(within(popup).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    const english = screen.getByRole('alertdialog', { name: 'Could not load the company' });
    await userEvent.click(within(english).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(result.current.data).toBe('empresa'));
  });

  it('usePagedList: el popup cambia de idioma sin perder la página ni el tamaño elegidos', async () => {
    const { result } = renderHook(() => usePagedList(failingPage, { errorTitle: say('No se pudieron cargar las bitácoras', 'Could not load the logs'), pageSize: 20 }), { wrapper });
    await screen.findByRole('alertdialog', { name: 'No se pudieron cargar las bitácoras' });
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('alertdialog', { name: 'Could not load the logs' })).toBeInTheDocument();
    expect(result.current).toMatchObject({ page: 1, size: 20 });
  });

  it('useSearchList: el popup cambia de idioma y la búsqueda escrita se conserva', async () => {
    const { result } = renderHook(() => useSearchList(failingPage, { errorTitle: say('No se pudieron cargar los empleados', 'Could not load the employees') }), { wrapper });
    await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los empleados' });
    act(() => result.current.setSearch('Ana'));
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('alertdialog', { name: 'Could not load the employees' })).toBeInTheDocument();
    expect(result.current.search).toBe('Ana');
  });
});
