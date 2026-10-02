import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CapturedFace, FlowAlternative } from '../../components/LiveFaceFlow';
import { resetPolicyCache, STRICT_POLICY } from '../../hooks/useVerificationPolicy';
import { identifiedResult, sampleCheckpoint } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { CheckpointProfile } from '../../types';
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
vi.mock('../../components/LiveFaceFlow', () => ({
  LiveFaceFlow: ({ title, onSubmit, alternative }: { title: string; onSubmit: (c: CapturedFace) => Promise<void>; alternative?: FlowAlternative }) => (
    <div>
      <h1>{title}</h1>
      <button onClick={() => void onSubmit({ frontal: [new Blob(['x'])], accessoryReview: false })}>capturar rostro</button>
      {alternative && <button onClick={alternative.onSelect}>{alternative.label}</button>}
    </div>
  ),
}));

const events = [
  { id: 2, created_at: new Date().toISOString(), method: 'QR', success: true, reason: null, confidence: null, employee_name: 'Ana Ruiz', employee_number: 'EMP-7' },
  { id: 1, created_at: new Date().toISOString(), method: 'FACE', success: false, reason: 'NO_MATCH', confidence: null, employee_name: null, employee_number: null },
];

function server(profile: CheckpointProfile, overrides: Record<string, () => Response> = {}) {
  return mockFetch((call: MockCall) => {
    const path = call.url.split('?')[0];
    if (overrides[path]) return overrides[path]();
    if (path === '/api/checkpoint/me') return apiOk(profile);
    if (path === '/api/checkpoint/recent') return apiOk(events);
    if (path === '/api/settings/verification') return apiOk(STRICT_POLICY);
    if (path === '/api/checkpoint/qr/inspect') return apiOk({ employee_id: 7, name: 'Ana Ruiz', employee_number: 'EMP-7' });
    return apiOk(identifiedResult);
  });
}

afterEach(() => resetPolicyCache());

describe('CheckpointPage (VALIDATOR)', () => {
  it('inicio: empresa, validador, métodos de su modo y últimas identificaciones', async () => {
    server(sampleCheckpoint);
    renderWithProviders(<CheckpointPage />);
    expect(await screen.findByRole('heading', { name: 'Recepción planta 1' })).toBeInTheDocument();
    expect(screen.getAllByText('Mi empresa').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /RECONOCER ROSTRO/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ESCANEAR QR/ })).toBeInTheDocument();
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByText('No identificado')).toBeInTheDocument();
    expect(screen.getByText('Rostro · Rostro no coincide')).toBeInTheDocument();
  });

  it('QR: identifica, muestra el resultado para el operador y refresca la bitácora', async () => {
    const { calls } = server(sampleCheckpoint);
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: /ESCANEAR QR/ }));
    await userEvent.click(screen.getByRole('button', { name: 'leer QR' }));
    expect(await screen.findByText('Empleado identificado')).toBeInTheDocument();
    expect(calls.find((c) => c.url === '/api/checkpoint/identify/qr')?.init.body).toBe(JSON.stringify({ qr_content: 'TCQR1:abc' }));
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/api/checkpoint/recent'))).toHaveLength(2));
    await userEvent.click(screen.getByRole('button', { name: /Siguiente persona/ }));
    expect(await screen.findByRole('button', { name: /ESCANEAR QR/ })).toBeInTheDocument();
  });

  it('rostro: puede cambiar a QR; un QR rechazado muestra el motivo', async () => {
    server(sampleCheckpoint, { '/api/checkpoint/identify/qr': () => apiFail(403, 'QR_DISABLED', 'La verificación con QR está desactivada') });
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: /RECONOCER ROSTRO/ }));
    expect(screen.getByRole('heading', { name: 'Reconocer rostro' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Usar su código QR' }));
    await userEvent.click(screen.getByRole('button', { name: 'leer QR' }));
    expect(await screen.findByText('No fue posible identificar')).toBeInTheDocument();
    expect(screen.getAllByText('La verificación con QR está desactivada').length).toBeGreaterThan(0);
  });

  it('QR y rostro: primero el QR (de quién es) y luego su rostro con ese QR', async () => {
    const { calls } = server({ ...sampleCheckpoint, mode: 'QR_AND_FACE' });
    renderWithProviders(<CheckpointPage />);
    await userEvent.click(await screen.findByRole('button', { name: /QR \+ ROSTRO/ }));
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
    expect(screen.queryByRole('button', { name: /ESCANEAR QR/ })).not.toBeInTheDocument();
  });

  it('sin conexión al cargar: ofrece reintentar', async () => {
    server(sampleCheckpoint, { '/api/checkpoint/me': () => apiFail(500, 'INTERNAL_ERROR', 'Error') });
    renderWithProviders(<CheckpointPage />);
    expect(await screen.findByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });
});
