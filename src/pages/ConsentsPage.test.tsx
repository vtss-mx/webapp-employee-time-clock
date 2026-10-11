import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/core';
import { biometricConsent, consentList, consentState, grantedConsent, SHA } from '../test/consents';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../test/http';
import { sampleUser, renderWithProviders } from '../test/render';
import { withScreens } from '../test/screens';
import type { User } from '../types';
import type { ConsentAsk } from '../types/consents';
import { ConsentsPage } from './ConsentsPage';

const session = vi.hoisted(() => ({ user: null as User | null, refreshUser: vi.fn<() => Promise<void>>() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => session }));

/** El paso del registro al que se vuelve: dice su ruta y si llegó ya confirmado (abre la cámara sin preguntar). */
function StepProbe() {
  const location = useLocation();
  return <p>{`Paso: ${location.pathname} confirmado=${String((location.state as { confirmed?: boolean } | null)?.confirmed ?? false)}`}</p>;
}

const STEP = '/employee/enroll/photo';

function renderPage(from?: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/profile" element={<p>Pantalla: Mi perfil</p>} />
      <Route path="/profile/consents" element={<ConsentsPage />} />
      <Route path={STEP} element={<StepProbe />} />
    </Routes>,
    { route: from ? { pathname: '/profile/consents', state: { from } } : '/profile/consents' },
  );
}

/** El servidor del caso feliz: la lista en el idioma de la petición y el otorgamiento aceptado. */
const server = (items: ConsentAsk[] = [biometricConsent], grant: (call: MockCall) => Response = () => apiOk(consentState(), { status: 201, code: 'CONSENT_GRANTED' })) =>
  mockFetch((call) => (call.init.method === 'POST' ? grant(call) : apiOk(consentList(items))));

const reads = (calls: MockCall[]) => calls.filter((call) => (call.init.method ?? 'GET') === 'GET').length;
const writes = (calls: MockCall[]) => calls.filter((call) => call.init.method === 'POST');

/** Pulsa «Otorgar mi consentimiento» y confirma. */
async function grant(label = 'Otorgar mi consentimiento', confirmLabel = 'Otorgar') {
  await userEvent.click((await screen.findAllByRole('button', { name: label }))[0]);
  // La confirmación de otorgar es `kind: 'create'` (tono primario): su popup es `dialog`, no `alertdialog`.
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: confirmLabel }));
}

beforeEach(() => {
  session.user = sampleUser;
  session.refreshUser.mockResolvedValue(undefined);
});

describe('ConsentsPage (consentimiento biométrico)', () => {
  it('dibuja el título y los CINCO párrafos del servidor tal como llegan, con la versión del texto', async () => {
    server();
    renderPage();
    expect(await screen.findByRole('heading', { name: biometricConsent.title })).toBeInTheDocument();
    for (const paragraph of biometricConsent.paragraphs) expect(screen.getByText(paragraph)).toBeInTheDocument();
    expect(screen.getByText('Versión 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Mi perfil' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('button', { name: 'Otorgar mi consentimiento' })).toBeInTheDocument();
  });

  it('otorgar pregunta con el texto y la versión; cancelar no envía nada; confirmar manda lo que mostró el servidor', async () => {
    const { calls } = server();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Otorgar mi consentimiento' }));
    const ask = await screen.findByRole('dialog', { name: '¿Otorgar tu consentimiento?' });
    expect(ask).toHaveTextContent(biometricConsent.title);
    expect(ask).toHaveTextContent('Versión 1');
    expect(ask).toHaveTextContent('Puedes revocarlo cuando quieras desde Mi perfil.');
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)).toHaveLength(0);

    await grant();
    expect(await screen.findByRole('dialog', { name: 'Consentimiento otorgado' })).toBeInTheDocument();
    const [post] = writes(calls);
    expect(JSON.parse(post.init.body as string)).toEqual({ type: 'BIOMETRIC_DATA', version: '1', text_sha256: SHA });
    expect(new Headers(post.init.headers).get('Accept-Language')).toBe('es-MX');
    // Sin paso del que venir se queda aquí y vuelve a pedir el estado (ya aparece otorgado).
    await waitFor(() => expect(reads(calls)).toBe(2));
  });

  it('al cambiar el idioma en caliente vuelve a pedir el texto y otorga con la huella de ESE idioma', async () => {
    const english: ConsentAsk = {
      ...biometricConsent,
      text_sha256: 'b'.repeat(64),
      title: 'Consent to process your biometric data',
      paragraphs: ['What is captured: an image of your face.', 'What it is for: confirming it is you.', 'How long it is kept: while you work there.', 'You can revoke this consent at any time.', 'If you revoke it, your data is deleted.'],
    };
    const { calls } = mockFetch((call) => {
      if (call.init.method === 'POST') return apiOk(consentState(), { status: 201 });
      return apiOk(consentList([new Headers(call.init.headers).get('Accept-Language') === 'en-US' ? english : biometricConsent]));
    });
    renderPage();
    expect(await screen.findByText(biometricConsent.paragraphs[0])).toBeInTheDocument();
    await act(async () => {
      await setLocale('en-US');
    });
    expect(await screen.findByText(english.paragraphs[0])).toBeInTheDocument();
    expect(screen.queryByText(biometricConsent.paragraphs[0])).toBeNull();
    await grant('Grant my consent', 'Grant');
    const [post] = writes(calls);
    expect((JSON.parse(post.init.body as string) as { text_sha256: string }).text_sha256).toBe('b'.repeat(64));
    expect(new Headers(post.init.headers).get('Accept-Language')).toBe('en-US');
  });

  it('ya otorgado: dice desde cuándo y no vuelve a ofrecer otorgarlo', async () => {
    server([grantedConsent]);
    renderPage();
    expect(await screen.findByText(/Otorgado el 1 oct 2026/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Otorgar mi consentimiento' })).toBeNull();
  });

  it('sin consentimientos que pedir: estado vacío', async () => {
    server([]);
    renderPage();
    expect(await screen.findByText('Sin consentimientos')).toBeInTheDocument();
    expect(screen.getByText('Aquí verás lo que tu empresa te pide autorizar.')).toBeInTheDocument();
  });

  it('si el texto no carga, el popup lo explica y «Reintentar» lo vuelve a pedir', async () => {
    let fail = true;
    const { calls } = mockFetch(() => (fail ? apiFail(409, 'CONFLICT', 'El servidor respondió con un conflicto') : apiOk(consentList())));
    renderPage();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar tu consentimiento' });
    expect(popup).toHaveTextContent('El servidor respondió con un conflicto');
    fail = false;
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(biometricConsent.paragraphs[0])).toBeInTheDocument();
    expect(reads(calls)).toBe(2);
  });

  it('una cuenta que no es de empleado ve el vacío y no pide nada al servidor', async () => {
    session.user = withScreens({ ...sampleUser, role: 'COMPANY', employee: null });
    const { calls } = server();
    renderPage();
    expect(await screen.findByText('Solo para empleados')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Mi perfil' })).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('422 CONSENT_TEXT_MISMATCH: lo explica y vuelve a mostrar el texto vigente para leerlo', async () => {
    let shown = biometricConsent;
    const changed = 'Si lo revocas, todo se borra al momento y para siempre.';
    const { calls } = mockFetch((call) => {
      if (call.init.method !== 'POST') return apiOk(consentList([shown]));
      shown = { ...biometricConsent, text_sha256: 'c'.repeat(64), version: '2', paragraphs: [...biometricConsent.paragraphs.slice(0, 4), changed] };
      return apiFail(422, 'CONSENT_TEXT_MISMATCH', 'El texto del consentimiento cambió. Vuelve a leerlo y otórgalo de nuevo.');
    });
    renderPage();
    await grant();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo otorgar tu consentimiento' })).toHaveTextContent('El texto del consentimiento cambió');
    expect(await screen.findByText(changed)).toBeInTheDocument();
    expect(screen.getByText('Versión 2')).toBeInTheDocument();
    expect(reads(calls)).toBe(2);
  });

  it('409 CONSENT_ALREADY_GRANTED: lo explica y refresca el estado (ya estaba otorgado)', async () => {
    let shown = biometricConsent;
    const { calls } = mockFetch((call) => {
      if (call.init.method !== 'POST') return apiOk(consentList([shown]));
      shown = grantedConsent;
      return apiFail(409, 'CONSENT_ALREADY_GRANTED', 'Ya otorgaste este consentimiento');
    });
    renderPage();
    await grant();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo otorgar tu consentimiento' })).toHaveTextContent('Ya otorgaste este consentimiento');
    expect(await screen.findByText(/Otorgado el 1 oct 2026/)).toBeInTheDocument();
    expect(reads(calls)).toBe(2);
  });

  it.each([
    [403, 'FORBIDDEN', 'No tienes permiso para esta pantalla'],
    [404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado'],
    [429, 'RATE_LIMITED', 'Demasiadas peticiones'],
    [500, 'INTERNAL_ERROR', 'Error interno del servidor'],
  ])('%s %s al otorgar: un popup con el motivo, un solo envío y sin volver a pedir el texto', async (status, code, message) => {
    const headers: Record<string, string> = status === 429 ? { 'Retry-After': '30' } : {};
    const { calls } = server([biometricConsent], () => apiFail(status, code, message, headers));
    renderPage();
    await grant();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo otorgar tu consentimiento' })).toHaveTextContent(message);
    expect(writes(calls)).toHaveLength(1);
    expect(reads(calls)).toBe(1);
  });

  it('422 por campo: el popup detalla qué campo rechazó el servidor', async () => {
    const body = envelope(null, {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Revisa los datos',
      errors: [{ code: 'STRING_PATTERN_MISMATCH', message: 'La huella del texto no es válida', field: 'text_sha256', details: null }],
    });
    server([biometricConsent], () => jsonResponse(body, 422));
    renderPage();
    await grant();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo otorgar tu consentimiento' });
    expect(popup).toHaveTextContent('Revisa los datos');
    expect(popup).toHaveTextContent('La huella del texto no es válida');
  });

  it('sin red al otorgar: el popup lo dice y deja volver a intentarlo', async () => {
    let offline = true;
    mockFetch((call) => (call.init.method === 'POST' && offline ? Promise.reject(new TypeError('Failed to fetch')) : apiOk(call.init.method === 'POST' ? consentState() : consentList())));
    renderPage();
    await grant();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo otorgar tu consentimiento' })).toBeInTheDocument();
    offline = false;
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cerrar' }));
    await grant();
    expect(await screen.findByRole('dialog', { name: 'Consentimiento otorgado' })).toBeInTheDocument();
  });

  it('llegando de un paso del registro: al otorgarlo reanuda ESE paso, ya confirmado', async () => {
    server();
    renderPage(STEP);
    expect(await screen.findByRole('link', { name: 'Volver a tu registro' })).toHaveAttribute('href', STEP);
    await grant();
    expect(await screen.findByText(`Paso: ${STEP} confirmado=true`)).toBeInTheDocument();
  });

  it('llegando de un paso, con otro consentimiento pendiente, se queda aquí hasta otorgarlos todos', async () => {
    const other: ConsentAsk = { ...biometricConsent, type: 'OTHER_DATA', title: 'Consentimiento para tratar tu voz' };
    server([biometricConsent, other]);
    renderPage(STEP);
    await screen.findByText(biometricConsent.title);
    await grant();
    expect(await screen.findByRole('dialog', { name: 'Consentimiento otorgado' })).toBeInTheDocument();
    expect(screen.queryByText(`Paso: ${STEP} confirmado=true`)).toBeNull();
  });
});
