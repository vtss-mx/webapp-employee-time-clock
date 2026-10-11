import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { biometricConsent, consentList, consentState, grantedConsent, revokedConsent } from '../../test/consents';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { ConsentAsk } from '../../types/consents';
import { ConsentsSection } from './ConsentsSection';

const session = vi.hoisted(() => ({ refreshUser: vi.fn<() => Promise<void>>() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => session }));

const server = (items: ConsentAsk[] = [grantedConsent], revoke: Response | ((call: MockCall) => Response) = apiOk(consentState({ granted: false, revoked_at: '2026-10-07T09:00:00Z' }))) =>
  mockFetch((call) => (call.init.method === 'DELETE' ? (typeof revoke === 'function' ? revoke(call) : revoke) : apiOk(consentList(items))));

const renderSection = () =>
  renderWithProviders(
    <Routes>
      <Route path="/profile" element={<ConsentsSection />} />
      <Route path="/profile/consents" element={<p>Pantalla: consentimiento</p>} />
    </Routes>,
    { route: '/profile' },
  );

const reads = (calls: MockCall[]) => calls.filter((call) => (call.init.method ?? 'GET') === 'GET').length;

async function revoke() {
  await userEvent.click(await screen.findByRole('button', { name: 'Revocar' }));
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revocar' }));
}

beforeEach(() => {
  session.refreshUser.mockResolvedValue(undefined);
});

describe('ConsentsSection (Mi perfil → Datos biométricos)', () => {
  it('otorgado: lo dice con su fecha y ofrece ver el texto y revocar', async () => {
    server();
    renderSection();
    expect(await screen.findByText(grantedConsent.title)).toBeInTheDocument();
    expect(screen.getByText('Otorgado')).toBeInTheDocument();
    expect(screen.getByText(/Otorgado el 1 oct 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el texto' })).toHaveAttribute('href', '/profile/consents');
    expect(screen.getByRole('button', { name: 'Revocar' })).toBeInTheDocument();
  });

  it('sin otorgar: dice que su empresa lo pide y lleva a leerlo, sin ofrecer revocar', async () => {
    server([biometricConsent]);
    renderSection();
    expect(await screen.findByText('Sin otorgar')).toBeInTheDocument();
    expect(screen.getByText('Tu empresa lo pide')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Leer y otorgar' }));
    expect(await screen.findByText('Pantalla: consentimiento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revocar' })).toBeNull();
  });

  it('revocado: dice cuándo; uno opcional sin fechas no inventa ninguna línea', async () => {
    server([revokedConsent]);
    const { unmount } = renderSection();
    expect(await screen.findByText(/Revocado el 2 oct 2026/)).toBeInTheDocument();
    unmount();
    server([{ ...biometricConsent, required: false }]);
    renderSection();
    expect(await screen.findByText('Sin otorgar')).toBeInTheDocument();
    expect(screen.queryByText('Tu empresa lo pide')).toBeNull();
  });

  it('sin consentimientos: estado vacío dentro de la sección', async () => {
    server([]);
    renderSection();
    expect(await screen.findByText('Sin consentimientos')).toBeInTheDocument();
  });

  it('si no carga, lo explica con «Reintentar» y lo vuelve a pedir', async () => {
    let fail = true;
    const { calls } = mockFetch(() => (fail ? apiFail(409, 'CONFLICT', 'El servidor respondió con un conflicto') : apiOk(consentList())));
    renderSection();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar tu consentimiento' })).toHaveTextContent('El servidor respondió con un conflicto');
    fail = false;
    await userEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]);
    expect(await screen.findByText(biometricConsent.title)).toBeInTheDocument();
    expect(reads(calls)).toBe(2);
  });

  it('revocar pregunta con lo que se borra; cancelar no envía nada; confirmar borra, avisa y relee la sesión', async () => {
    const { calls } = server();
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar' }));
    const ask = await screen.findByRole('alertdialog', { name: '¿Revocar tu consentimiento biométrico?' });
    expect(ask).toHaveTextContent('Tu rostro, tus fotos y tu voz se borran de inmediato y tu registro facial deja de existir.');
    expect(ask).toHaveTextContent('No se puede deshacer. Tu empresa tendrá que verificar tu identidad de otra forma.');
    expect(ask).toHaveTextContent(grantedConsent.title);
    expect(ask).toHaveTextContent('Otorgado el 1 oct 2026');
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls.some((call) => call.init.method === 'DELETE')).toBe(false);

    await revoke();
    expect(await screen.findByRole('dialog', { name: 'Consentimiento revocado' })).toHaveTextContent('Tus datos biométricos se borraron.');
    expect(calls.find((call) => call.init.method === 'DELETE')?.url).toBe('/api/me/consents/BIOMETRIC_DATA');
    await waitFor(() => expect(reads(calls)).toBe(2));
    expect(session.refreshUser).toHaveBeenCalled();
  });

  it('un consentimiento otorgado sin fechas se puede revocar igual: la pregunta solo nombra el texto', async () => {
    server([{ ...biometricConsent, granted: true, required: false }]);
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar' }));
    const ask = await screen.findByRole('alertdialog', { name: '¿Revocar tu consentimiento biométrico?' });
    expect(ask).toHaveTextContent(biometricConsent.title);
    expect(ask).not.toHaveTextContent('Otorgado el');
  });

  it('revocado pero sin poder releer la sesión (sin red): el aviso sigue y nada se rompe', async () => {
    session.refreshUser.mockRejectedValue(new Error('sin red'));
    server();
    renderSection();
    await revoke();
    expect(await screen.findByRole('dialog', { name: 'Consentimiento revocado' })).toBeInTheDocument();
  });

  it('mientras vuelve a pedir el estado (cambio de idioma), la lista anterior se queda a la vista', async () => {
    let release: () => void = () => undefined;
    const slow = new Promise<void>((done) => {
      release = done;
    });
    let first = true;
    mockFetch(async () => {
      if (first) {
        first = false;
        return apiOk(consentList([grantedConsent]));
      }
      await slow;
      return apiOk(consentList([grantedConsent]));
    });
    renderSection();
    expect((await screen.findByText(grantedConsent.title)).closest('ul')).not.toHaveClass('is-loading');
    await act(async () => {
      await setLocale('en-US');
    });
    // Regla 16: el idioma es parte de la llave del recurso; mientras llega lo nuevo, lo anterior sigue (atenuado).
    expect(screen.getByText(grantedConsent.title).closest('ul')).toHaveClass('is-loading');
    expect(screen.getByText('Granted')).toBeInTheDocument();
    await act(async () => {
      release();
      await slow;
    });
    await waitFor(() => expect(screen.getByText(grantedConsent.title).closest('ul')).not.toHaveClass('is-loading'));
  });

  it('409 CONSENT_NOT_GRANTED al revocar: lo explica y refresca el estado', async () => {
    let items = [grantedConsent];
    const { calls } = mockFetch((call) => {
      if (call.init.method !== 'DELETE') return apiOk(consentList(items));
      items = [revokedConsent];
      return apiFail(409, 'CONSENT_NOT_GRANTED', 'No tienes este consentimiento vigente');
    });
    renderSection();
    await revoke();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo revocar tu consentimiento' })).toHaveTextContent('No tienes este consentimiento vigente');
    expect(await screen.findByText(/Revocado el 2 oct 2026/)).toBeInTheDocument();
    expect(reads(calls)).toBe(2);
  });

  it('otra falla al revocar: el popup lo dice y no refresca nada', async () => {
    const { calls } = server([grantedConsent], apiFail(500, 'INTERNAL_ERROR', 'Error interno del servidor'));
    renderSection();
    await revoke();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo revocar tu consentimiento' })).toHaveTextContent('Error interno del servidor');
    expect(reads(calls)).toBe(1);
    expect(session.refreshUser).not.toHaveBeenCalled();
  });
});
