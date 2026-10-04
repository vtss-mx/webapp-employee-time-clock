import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { ApiError } from '../services/apiClient';
import type { Page } from '../types';
import { usePagedList } from './usePagedList';
import { useResource } from './useResource';

const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;
const offline = () => new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'No fue posible conectar con el servidor.' });
const notFound = () => new ApiError({ statusCode: 404, code: 'NOT_FOUND', message: 'No existe' });
const reconnect = () => act(() => void window.dispatchEvent(new Event('online')));
const page = (items: string[]): Page<string> => ({ items, total: items.length, page: 1, size: 10 });

describe('lo que no cargó por falta de conexión se pide de nuevo al recuperarla', () => {
  it('useResource: vuelve a pedir solo al volver la red (y ya cargado no repite)', async () => {
    const fetch = vi.fn<(signal: AbortSignal) => Promise<string>>().mockRejectedValueOnce(offline()).mockResolvedValue('empresa');
    const { result } = renderHook(() => useResource(fetch, 1, 'No se pudo cargar la empresa'), { wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    reconnect();
    await waitFor(() => expect(result.current.data).toBe('empresa'));
    reconnect();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('useResource: un error que no es de conexión (no encontrado) no se repite al reconectar', async () => {
    const fetch = vi.fn<(signal: AbortSignal) => Promise<string>>().mockRejectedValue(notFound());
    const { result } = renderHook(() => useResource(fetch, 1, 'No se pudo cargar la empresa'), { wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    reconnect();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('usePagedList: el listado que falló sin red se vuelve a pedir al reconectar', async () => {
    const fetchPage = vi.fn<() => Promise<Page<string>>>().mockRejectedValueOnce(offline()).mockResolvedValue(page(['Ana', 'Luis']));
    const { result } = renderHook(() => usePagedList(fetchPage, { errorTitle: 'No se pudo cargar el listado' }), { wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    reconnect();
    await waitFor(() => expect(result.current.data?.items).toEqual(['Ana', 'Luis']));
    expect(result.current.error).toBeNull();
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
