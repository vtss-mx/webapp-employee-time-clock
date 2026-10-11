import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CapturedFace, FlowAlternative } from '../../components/LiveFaceFlow';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { setLocale } from '../../i18n/core';
import { identifiedResult, sampleCheckpoint, samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { catalogsWith } from '../../test/catalogs';
import { renderWithProviders } from '../../test/render';
import type { CheckpointProfile, ValidatorModeItem } from '../../types';
import { CheckpointPage } from './CheckpointPage';

// La cámara (getUserMedia, MediaPipe, jsQR) se prueba en navegador real (E2E); aquí, los flujos.
vi.mock('../../components/QrScanPanel', () => ({
  QrScanPanel: ({ title, onScan, onCancel }: { title: string; onScan: (code: string) => Promise<void>; onCancel: () => void }) => (
    <div>
      <h1>{title}</h1>
      <button onClick={() => void onScan('TCQR1:abc')}>leer QR</button>
      <button onClick={onCancel}>cancelar</button>
    </div>
  ),
}));
interface FlowProps {
  title: string;
  onSubmit: (c: CapturedFace) => Promise<void>;
  onFatal: (error: unknown) => void;
  alternative?: FlowAlternative;
}
vi.mock('../../components/LiveFaceFlow', () => ({
  LiveFaceFlow: ({ title, onSubmit, onFatal, alternative }: FlowProps) => (
    <div>
      <h1>{title}</h1>
      <button onClick={() => void onSubmit({ frontal: [new Blob(['x'])] })}>capturar rostro</button>
      <button onClick={() => onFatal(new Error('La cámara se desconectó'))}>falla de cámara</button>
      {alternative && <button onClick={alternative.onSelect}>{alternative.label}</button>}
    </div>
  ),
}));

const events = [
  { id: 2, created_at: new Date().toISOString(), method: 'QR', success: true, reason: null, confidence: null, employee_name: 'Ana Ruiz', employee_number: 'EMP-7' },
  { id: 1, created_at: new Date().toISOString(), method: 'FACE', success: false, reason: 'NO_MATCH', confidence: null, employee_name: null, employee_number: null },
];

function server(profile: CheckpointProfile, overrides: Record<string, () => Response | Promise<Response>> = {}) {
  return mockFetch((call: MockCall) => {
    const path = call.url.split('?')[0];
    if (overrides[path]) return overrides[path]();
    if (path === '/api/checkpoint/me') return apiOk(profile);
    if (path === '/api/checkpoint/recent') return apiOk({ items: events, total: events.length, page: 1, size: 10 });
    if (path === '/api/settings/verification') return apiOk(samplePolicy);
    if (path === '/api/checkpoint/qr/inspect') return apiOk({ employee_id: 7, name: 'Ana Ruiz', employee_number: 'EMP-7' });
    return apiOk(identifiedResult);
  });
}

afterEach(() => resetPolicyCache());

// Tarjetas de método: título y descripción del catálogo verification_methods.
const FACE_CARD = /Rostro.*se busca entre todo el personal/;
const QR_CARD = /QR.*Código dinámico en el teléfono/;
const QR_FACE_CARD = /QR \+ rostro.*confirma que el rostro es de su dueño/;

describe('CheckpointPage (VALIDATOR)', () => {
  it('inicio: empresa, validador, métodos de su modo y últimas identificaciones', async () => {
    server(sampleCheckpoint);
    renderWithProviders(<CheckpointPage />);
    expect(await screen.findByRole('heading', { name: 'Recepción planta 1' })).toBeInTheDocument();
    expect(screen.getAllByText('Mi empresa').length).toBeGreaterThan(0);
    expect(screen.getByText('QR o rostro')).toBeInTheDocument(); // modo del validador
    expect(screen.getAllByRole('button', { name: /Comenzar/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: FACE_CARD })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: QR_CARD })).toBeInTheDocument();
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByText('No identificado')).toBeInTheDocument();
    expect(screen.getByText('Rostro · Rostro no coincide')).toBeInTheDocument();
  });

  it('sin identificaciones: estado vacío y sin paginador', async () => {
    server(sampleCheckpoint, { '/api/checkpoint/recent': () => apiOk({ items: [], total: 0, page: 1, size: 10 }) });
    renderWithProviders(<CheckpointPage />);
    expect(await screen.findByText('Sin identificaciones')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });

  it('QR: identifica, muestra el resultado para el operador y refresca la bitácora', async () => {
    const { calls } = server(sampleCheckpoint);
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: QR_CARD }));
    await userEvent.click(screen.getByRole('button', { name: 'leer QR' }));
    expect(await screen.findByText('Empleado identificado')).toBeInTheDocument();
    expect(calls.find((c) => c.url === '/api/checkpoint/identify/qr')?.init.body).toBe(JSON.stringify({ qr_content: 'TCQR1:abc' }));
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/api/checkpoint/recent'))).toHaveLength(2));
    await userEvent.click(screen.getByRole('button', { name: /Siguiente persona/ }));
    expect(await screen.findByRole('button', { name: QR_CARD })).toBeInTheDocument();
  });

  it('rostro: puede cambiar a QR; un QR rechazado muestra el motivo', async () => {
    server(sampleCheckpoint, { '/api/checkpoint/identify/qr': () => apiFail(403, 'QR_DISABLED', 'La verificación con QR está desactivada') });
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: FACE_CARD }));
    expect(screen.getByRole('heading', { name: 'Reconocer rostro' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Usar su código QR' }));
    await userEvent.click(screen.getByRole('button', { name: 'leer QR' }));
    expect(await screen.findByText('No se pudo identificar')).toBeInTheDocument();
    expect(screen.getAllByText('La verificación con QR está desactivada').length).toBeGreaterThan(0);
  });

  it('QR y rostro: primero el QR (de quién es) y luego su rostro con ese QR', async () => {
    const { calls } = server({ ...sampleCheckpoint, mode: 'QR_AND_FACE' });
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: QR_FACE_CARD }));
    expect(screen.getByRole('heading', { name: 'Paso 1 de 2 · Código QR' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'leer QR' }));
    expect(await screen.findByRole('heading', { name: 'Paso 2 de 2 · Ana Ruiz' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));
    expect(await screen.findByText('Empleado identificado')).toBeInTheDocument();
    const face = calls.find((c) => c.url === '/api/checkpoint/identify/face');
    expect((face?.init.body as FormData).get('qr_content')).toBe('TCQR1:abc');
  });

  it('modo solo QR con el QR desactivado por la empresa: lo explica', async () => {
    server({ ...sampleCheckpoint, mode: 'QR', qr_enabled: false });
    renderWithProviders(<CheckpointPage />);
    expect(await screen.findByText('Identificación con QR desactivada')).toBeInTheDocument();
    expect(screen.getByText(/usa el modo «Solo QR»/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: QR_CARD })).not.toBeInTheDocument();
  });

  it('sin conexión al cargar: ofrece reintentar', async () => {
    server(sampleCheckpoint, { '/api/checkpoint/me': () => apiFail(500, 'INTERNAL_ERROR', 'Error') });
    renderWithProviders(<CheckpointPage />);
    expect(await screen.findByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('solo rostro: sin alternativa de QR; una falla de la cámara se muestra como resultado', async () => {
    server({ ...sampleCheckpoint, mode: 'FACE' });
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: FACE_CARD }));
    expect(screen.queryByRole('button', { name: 'Usar su código QR' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'falla de cámara' }));
    expect(await screen.findByText('No se pudo identificar')).toBeInTheDocument();
    expect(screen.getByText('La cámara se desconectó')).toBeInTheDocument();
  });

  it('QR y rostro: un QR que no es de un empleado activo termina con su motivo (sin pedir el rostro)', async () => {
    const { calls } = server(
      { ...sampleCheckpoint, mode: 'QR_AND_FACE' },
      { '/api/checkpoint/qr/inspect': () => apiFail(404, 'QR_INVALID', 'El código QR no es válido o ya se usó') },
    );
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: QR_FACE_CARD }));
    await userEvent.click(screen.getByRole('button', { name: 'leer QR' }));
    expect(await screen.findByText('No se pudo identificar')).toBeInTheDocument();
    expect(screen.getAllByText('El código QR no es válido o ya se usó').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: /Paso 2 de 2/ })).toBeNull();
    expect(calls.some((c) => c.url === '/api/checkpoint/identify/face')).toBe(false);
  });

  it('mientras se vuelve a pedir la bitácora, la lista se atenúa', async () => {
    let release: (response: Response) => void = () => undefined;
    let requests = 0;
    server(sampleCheckpoint, {
      '/api/checkpoint/recent': () => (requests++ === 0 ? apiOk({ items: events, total: 15, page: 1, size: 10 }) : new Promise<Response>((resolve) => (release = resolve))),
    });
    renderWithProviders(<CheckpointPage />);
    const list = (await screen.findByText('Ana Ruiz')).closest('ul');
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(list).toHaveClass('is-loading'));
    release(apiOk({ items: events, total: 15, page: 2, size: 10 }));
    await waitFor(() => expect(list).not.toHaveClass('is-loading'));
  });

  it('un método nuevo del catálogo: ícono genérico y su código mientras el catálogo no lo describe', async () => {
    const modes = catalogsWith({}).validator_modes.map((mode): ValidatorModeItem => (mode.code === 'FACE' ? { ...mode, methods: ['FACE', 'NFC' as ValidatorModeItem['methods'][number]] } : mode));
    server({ ...sampleCheckpoint, mode: 'FACE' });
    renderWithProviders(<CheckpointPage />, { catalogs: catalogsWith({ validator_modes: modes }) });
    const card = await screen.findByRole('button', { name: /^NFC/ });
    expect(card.querySelector('.lucide-shield-check')).not.toBeNull(); // ícono genérico
    expect(screen.getByRole('button', { name: FACE_CARD })).toBeInTheDocument();
  });
});

describe('CheckpointPage en inglés (en-US) y cambio de idioma en caliente', () => {
  it('inicio y QR + rostro en inglés (los nombres del catálogo llegan del servidor tal cual)', async () => {
    await setLocale('en-US');
    server({ ...sampleCheckpoint, mode: 'QR_AND_FACE' });
    renderWithProviders(<CheckpointPage />);
    expect(await screen.findByText('Choose how to identify the next person.')).toBeInTheDocument();
    expect(screen.getByText('Latest identifications')).toBeInTheDocument();
    expect(await screen.findByText('Not identified')).toBeInTheDocument();
    expect(screen.getByText(/Only active employees of Mi empresa are identified/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: QR_FACE_CARD }));
    expect(screen.getByRole('heading', { name: 'Step 1 of 2 · QR code' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'leer QR' }));
    expect(await screen.findByRole('heading', { name: 'Step 2 of 2 · Ana Ruiz' })).toBeInTheDocument();
  });

  it('si las identificaciones recientes no cargan, el popup lo explica (en inglés)', async () => {
    await setLocale('en-US');
    server(sampleCheckpoint, { '/api/checkpoint/recent': () => apiFail(500, 'INTERNAL_ERROR', 'Error') });
    renderWithProviders(<CheckpointPage />);
    expect(await screen.findByRole('alertdialog', { name: "Couldn't load recent identifications" })).toBeInTheDocument();
  });

  it('modo solo QR desactivado, en inglés', async () => {
    await setLocale('en-US');
    server({ ...sampleCheckpoint, mode: 'QR', qr_enabled: false });
    renderWithProviders(<CheckpointPage />);
    expect(await screen.findByText('QR identification turned off')).toBeInTheDocument();
    expect(screen.getByText(/uses the “Solo QR” mode/)).toBeInTheDocument();
  });

  it('el resultado en pantalla (identificado o con su motivo) cambia de idioma sin perderse', async () => {
    server(sampleCheckpoint, { '/api/checkpoint/identify/qr': () => apiFail(403, 'QR_DISABLED', 'La verificación con QR está desactivada') });
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: FACE_CARD }));
    await userEvent.click(screen.getByRole('button', { name: 'capturar rostro' }));
    expect(await screen.findByText('Empleado identificado')).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    expect(screen.getByText('Employee identified')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Next person/ }));

    await userEvent.click(await screen.findByRole('button', { name: QR_CARD }));
    expect(screen.getByRole('heading', { name: 'Scan QR' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'leer QR' }));
    expect(await screen.findByText("Couldn't identify")).toBeInTheDocument();
    await act(() => setLocale('es-MX'));
    expect(screen.getByText('No se pudo identificar')).toBeInTheDocument();
    expect(screen.getAllByText('La verificación con QR está desactivada').length).toBeGreaterThan(0); // texto del servidor
  });
});
