import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import * as versionService from '../services/versionService';
import { deployedBuild, isOutdated } from '../services/versionService';
import { jsonResponse, mockFetch } from '../test/http';
import { VersionWatcher } from './VersionWatcher';

describe('versionService', () => {
  it('lee la compilación publicada sin caché', async () => {
    const { calls } = mockFetch(jsonResponse({ build: 'b2' }));
    await expect(deployedBuild()).resolves.toBe('b2');
    expect(calls[0].url).toMatch(/\/version\.json\?t=\d+$/);
    expect(calls[0].init.cache).toBe('no-store');
  });

  it('sin version.json, respuesta extraña o sin red: no se considera desactualizada', async () => {
    mockFetch(jsonResponse({ nada: 1 }));
    await expect(deployedBuild()).resolves.toBeNull();
    mockFetch(jsonResponse(null, 404));
    await expect(isOutdated('b1')).resolves.toBe(false);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    await expect(isOutdated('b1')).resolves.toBe(false);
  });

  it('compara con la compilación en ejecución', async () => {
    mockFetch(jsonResponse({ build: 'test-build' }));
    await expect(isOutdated()).resolves.toBe(false);
    mockFetch(jsonResponse({ build: 'nueva' }));
    await expect(isOutdated()).resolves.toBe(true);
  });
});

describe('VersionWatcher', () => {
  let reload: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    reload = vi.spyOn(versionService, 'reloadApp').mockImplementation(() => undefined);
  });
  afterEach(() => vi.useRealTimers());

  const renderAt = (route: string) =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <FeedbackProvider>
          <VersionWatcher />
        </FeedbackProvider>
      </MemoryRouter>,
    );

  it('en el login recarga sola al detectar una versión nueva', async () => {
    mockFetch(jsonResponse({ build: 'nueva' }));
    renderAt('/login');
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('en otras pantallas pregunta; "Actualizar ahora" recarga', async () => {
    mockFetch(jsonResponse({ build: 'nueva' }));
    renderAt('/company/employees');
    const popup = await screen.findByRole('dialog', { name: 'Hay una nueva versión de la aplicación' });
    expect(reload).not.toHaveBeenCalled();
    await userEvent.click(within(popup).getByRole('button', { name: 'Actualizar ahora' }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('"Más tarde" pospone la pregunta y sin cambios no muestra nada', async () => {
    mockFetch(jsonResponse({ build: 'nueva' }));
    renderAt('/company/employees');
    await userEvent.click(await screen.findByRole('button', { name: 'Más tarde' }));
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it('misma versión: no hace nada', async () => {
    const { calls } = mockFetch(jsonResponse({ build: 'test-build' }));
    renderAt('/company/employees');
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});
