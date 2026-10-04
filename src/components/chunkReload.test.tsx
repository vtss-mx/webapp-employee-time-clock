import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense, type ComponentType } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { NotFoundPage } from '../routes/lazyPages';
import { clearReloadMark, reloadForNewVersion } from '../services/versionReload';
import * as versionService from '../services/versionService';
import { jsonResponse, mockFetch } from '../test/http';
import { importWithRetry } from '../utils/importRetry';
import { ErrorBoundary } from './ErrorBoundary';
import { GlobalErrorHandler } from './GlobalErrorHandler';
import { retryableLazy } from './retryableLazy';

/** La marca de recarga vive en el estado del historial de la pestaña (no en el almacenamiento). */
const mark = () => ((window.history.state as Record<string, unknown> | null)?.tcReloadedAt ?? null) as number | null;
const setMark = (value: number) => window.history.replaceState({ tcReloadedAt: value }, '');
const newVersion = () => mockFetch(jsonResponse({ build: 'nueva' }));
const sameVersion = () => mockFetch(jsonResponse({ build: 'test-build' }));
const chunkError = () => new TypeError('Failed to fetch dynamically imported module: /assets/Pantalla-abc.js');

let reload: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  reload = vi.spyOn(versionService, 'reloadApp').mockImplementation(() => undefined);
});
afterEach(() => vi.useRealTimers());

describe('reloadForNewVersion: recarga solo por una versión nueva, una vez', () => {
  it('sin versión nueva (falla de red) no recarga ni deja marca', async () => {
    sameVersion();
    await expect(reloadForNewVersion()).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(mark()).toBeNull();
  });

  it('con versión nueva recarga una vez y no vuelve a recargar mientras dura la marca', async () => {
    newVersion();
    await expect(reloadForNewVersion()).resolves.toBe(true);
    expect(mark()).toBeGreaterThan(0); // con la hora: la marca vence sola
    await expect(reloadForNewVersion()).resolves.toBe(false);
    expect(reload).toHaveBeenCalledOnce();
    // La app cargó bien después: otra publicación puede volver a recargar.
    clearReloadMark();
    await expect(reloadForNewVersion()).resolves.toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('una marca vieja (o de la versión anterior) no impide recargar', async () => {
    newVersion();
    setMark(Date.now() - 6 * 60_000);
    await expect(reloadForNewVersion()).resolves.toBe(true);
    setMark(1); // marca sin hora válida
    await expect(reloadForNewVersion()).resolves.toBe(true);
  });

  it('si el historial no se puede marcar, no recarga (no podría evitar un ciclo)', async () => {
    newVersion();
    const replace = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    await expect(reloadForNewVersion()).resolves.toBe(false);
    replace.mockImplementation(() => undefined); // el navegador ignora el cambio
    await expect(reloadForNewVersion()).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('respeta lo que el enrutador guarda en el historial', async () => {
    newVersion();
    window.history.replaceState({ key: 'ruta', idx: 3 }, '');
    await expect(reloadForNewVersion()).resolves.toBe(true);
    expect(window.history.state).toMatchObject({ key: 'ruta', idx: 3 });
    clearReloadMark();
    expect(window.history.state).toEqual({ key: 'ruta', idx: 3 });
  });
});

describe('GlobalErrorHandler: módulo que Vite no pudo descargar', () => {
  const preloadError = () => {
    const event = new Event('vite:preloadError', { cancelable: true });
    act(() => void window.dispatchEvent(event));
    return event;
  };
  const renderHandler = () =>
    render(
      <FeedbackProvider>
        <GlobalErrorHandler />
      </FeedbackProvider>,
    );

  it('con versión nueva recarga (una vez) y el error sigue hasta quien importó el módulo', async () => {
    newVersion();
    renderHandler();
    const event = preloadError();
    expect(event.defaultPrevented).toBe(false); // la pantalla o el detector manejan el error
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    preloadError();
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('sin versión nueva (red) no recarga', async () => {
    const { calls } = sameVersion();
    renderHandler();
    preloadError();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('pantallas de carga diferida', () => {
  it('una pantalla que no se descargó: "Reintentar" del ErrorBoundary la descarga de nuevo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sameVersion();
    const load = vi
      .fn<() => Promise<{ default: ComponentType }>>()
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValue({ default: () => <span>pantalla</span> });
    const Page = retryableLazy(load);
    render(
      <ErrorBoundary>
        <Suspense fallback={<span>cargando</span>}>
          <Page />
        </Suspense>
      </ErrorBoundary>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo no salió como esperábamos');
    expect(reload).not.toHaveBeenCalled(); // sin versión nueva: no recarga (podría no haber red)
    expect(load).toHaveBeenCalledOnce(); // tras fallar no vuelve a descargar solo (sin ciclos)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('pantalla')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('la pantalla no se descargó porque hay una versión nueva: recarga', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    newVersion();
    const Page = retryableLazy(() => Promise.reject(chunkError()));
    render(
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      </ErrorBoundary>,
    );
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
  });

  it('otro tipo de error no consulta la versión', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { calls } = sameVersion();
    function Bomb(): never {
      throw new Error('boom');
    }
    render(
      <ErrorBoundary inline>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('cargar bien una pantalla libera la marca de recarga', async () => {
    mockFetch(jsonResponse(null, 404));
    setMark(Date.now());
    render(
      <MemoryRouter>
        <FeedbackProvider>
          <AuthProvider>
            <Suspense fallback={null}>
              <NotFoundPage />
            </Suspense>
          </AuthProvider>
        </FeedbackProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument();
    expect(mark()).toBeNull();
  });
});

describe('importWithRetry', () => {
  it('repite una vez la descarga fallida tras una pausa', async () => {
    vi.useFakeTimers();
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(chunkError()).mockResolvedValue('módulo');
    const result = importWithRetry(load);
    expect(load).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBe('módulo');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('si vuelve a fallar, rechaza con el error (quien importó decide)', async () => {
    const error = chunkError();
    const load = vi.fn<() => Promise<string>>().mockRejectedValue(error);
    await expect(importWithRetry(load, 0)).rejects.toBe(error);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
