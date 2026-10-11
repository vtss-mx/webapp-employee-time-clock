import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapturedFace } from '../../components/LiveFaceFlow';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { setLocale } from '../../i18n/core';
import { signingNonce } from '../../services/http/requestSigning';
import { identifiedResult, sampleCheckpoint, samplePolicy } from '../../test/fixtures';
import { apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { CheckpointProfile } from '../../types';
import { CheckpointPage } from './CheckpointPage';

// La cámara se prueba en navegador real (E2E); aquí, qué viaja con cada identificación (antifraude 2b).
vi.mock('../../components/QrScanPanel', () => ({
  QrScanPanel: ({ title, onScan }: { title: string; onScan: (code: string) => Promise<void> }) => (
    <div>
      <h1>{title}</h1>
      <button onClick={() => void onScan('TCQR2:abc')}>leer QR</button>
    </div>
  ),
}));
vi.mock('../../components/LiveFaceFlow', () => ({
  LiveFaceFlow: ({ title, onSubmit, onFatal }: { title: string; onSubmit: (c: CapturedFace) => Promise<void>; onFatal: (error: unknown) => void }) => (
    <div>
      <h1>{title}</h1>
      <button onClick={() => void onSubmit({ frontal: [new Blob(['x'])] }).catch(onFatal)}>capturar rostro</button>
    </div>
  ),
}));

const QR_CARD = /QR.*Código dinámico en el teléfono/;
const FACE_CARD = /Rostro.*se busca entre todo el personal/;
const watchers: Array<{ ok: PositionCallback; fail: PositionErrorCallback }> = [];
const located: CheckpointProfile = { ...sampleCheckpoint, location_required: true };

function server(profile: CheckpointProfile, identify: (call: MockCall) => Response = () => apiOk(identifiedResult)) {
  return mockFetch((call) => {
    if (call.url.endsWith('/checkpoint/me')) return apiOk(profile);
    if (call.url.startsWith('/api/checkpoint/recent')) return apiOk({ items: [], total: 0, page: 1, size: 10 });
    if (call.url.includes('/settings/verification')) return apiOk(samplePolicy);
    return identify(call);
  });
}

beforeEach(() => {
  watchers.length = 0;
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition: (ok: PositionCallback, fail: PositionErrorCallback) => watchers.push({ ok, fail }), clearWatch: vi.fn() },
    configurable: true,
  });
});
afterEach(() => {
  resetPolicyCache();
  signingNonce.reset();
  Reflect.deleteProperty(navigator, 'geolocation');
});

const fix = (accuracy: number) => act(() => watchers.forEach((w) => w.ok({ coords: { latitude: 29.1, longitude: -110.9, accuracy } } as GeolocationPosition)));

describe('punto de control: prueba de presencia (antifraude 2b)', () => {
  it('validador que requiere ubicación: la mantiene caliente y cada identificación (QR o rostro) la lleva', async () => {
    const { calls } = server(located);
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: QR_CARD }));
    fix(18);
    await userEvent.click(screen.getByRole('button', { name: 'leer QR' }));
    expect(await screen.findByText('Empleado identificado')).toBeInTheDocument();
    const qr = JSON.parse(calls.find((c) => c.url.endsWith('/identify/qr'))?.init.body as string) as Record<string, unknown>;
    expect(qr).toEqual({ qr_content: 'TCQR2:abc', location: { latitude: 29.1, longitude: -110.9, accuracy: 18 }, location_samples: [{ latitude: 29.1, longitude: -110.9, accuracy: 18 }] });

    await userEvent.click(screen.getByRole('button', { name: /Siguiente persona/ }));
    await userEvent.click(await screen.findByRole('button', { name: FACE_CARD }));
    await userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));
    expect(await screen.findByText('Empleado identificado')).toBeInTheDocument();
    const face = calls.find((c) => c.url.endsWith('/identify/face'))?.init.body as FormData;
    expect([face.get('latitude'), face.get('accuracy')]).toEqual(['29.1', '18']);
    expect(face.has('signature')).toBe(false); // la empresa no pide firma (device_nonce null)
  });

  it('permiso bloqueado: lo explica una vez y aun así identifica (decide el servidor, con su mensaje)', async () => {
    const { calls } = server(located, () =>
      jsonResponse(envelope(null, { status: 403, code: 'LOCATION_REQUIRED', message: 'Este validador debe enviar su ubicación.', errors: [{ code: 'LOCATION_REQUIRED', message: 'x', field: null, details: { radius_m: 100 } }] }), 403),
    );
    renderWithProviders(<CheckpointPage />);
    await screen.findByRole('button', { name: QR_CARD });
    // El botón puede existir antes del efecto que registra el observador: esperar ese estado real.
    await waitFor(() => expect(watchers).toHaveLength(1));
    act(() => watchers.forEach((w) => w.fail({ code: 1 } as GeolocationPositionError)));
    const popup = await screen.findByRole('alertdialog', { name: 'Permite el acceso a tu ubicación' });
    expect(popup).toHaveTextContent('Este validador envía su ubicación en cada identificación');
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    await userEvent.click(screen.getByRole('button', { name: QR_CARD }));
    await userEvent.click(screen.getByRole('button', { name: 'leer QR' }));
    expect(await screen.findByText('No se pudo identificar')).toBeInTheDocument();
    expect(screen.getAllByText('Este validador debe enviar su ubicación.').length).toBeGreaterThan(0);
    expect(JSON.parse(calls.find((c) => c.url.endsWith('/identify/qr'))?.init.body as string)).toEqual({ qr_content: 'TCQR2:abc' });
  });

  it('firma de otro dispositivo: el resultado de la identificación muestra el mensaje del servidor', async () => {
    server({ ...sampleCheckpoint, mode: 'FACE' }, () =>
      jsonResponse(envelope(null, { status: 403, code: 'SIGNATURE_KEY_MISMATCH', message: 'Inicia sesión de nuevo en este dispositivo.', errors: [] }), 403),
    );
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: FACE_CARD }));
    await userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));
    expect(await screen.findByText('No se pudo identificar')).toBeInTheDocument();
    expect(screen.getAllByText('Inicia sesión de nuevo en este dispositivo.').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Intentar de nuevo' })).not.toBeInTheDocument();
  });

  it('en inglés: el aviso del permiso bloqueado', async () => {
    await setLocale('en-US');
    server(located);
    renderWithProviders(<CheckpointPage />);
    await screen.findAllByRole('button', { name: /Start/ });
    // El botón puede existir antes del efecto que registra el observador: esperar ese estado real.
    await waitFor(() => expect(watchers).toHaveLength(1));
    act(() => watchers.forEach((w) => w.fail({ code: 1 } as GeolocationPositionError)));
    expect(await screen.findByRole('alertdialog', { name: /location/i })).toHaveTextContent('This validator sends its location with each identification');
  });
});
