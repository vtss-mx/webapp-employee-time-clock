import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { renderWithProviders } from '../test/render';
import { ServerStatusPanel } from './ServerStatusPanel';

const status = {
  status: 'degraded',
  components: { database: { status: 'ok' }, cache_redis: { status: 'timeout', error: 'Sin respuesta en 2 s' } },
  admission: {
    limit: 40,
    bounds: [8, 200],
    in_flight: 3,
    waiting: 0,
    admitted: 900,
    shed: 0,
    latency_ratio: null,
    top_demand: [
      { api: 'POST checkpoint/identify/face', tier: 'CRITICAL', recent_requests: 1500, latency_ms: 210.5, shed: 3 },
      { api: 'GET reports', tier: 'BATCH', recent_requests: 12, latency_ms: null, shed: 0 },
    ],
  },
  storage: {
    configured: false,
    backend: 'disabled',
    bucket: null,
    prefix: 'local',
    reason: 'la llave de la cuenta de servicio aún no está montada (archivo vacío)',
    count_cap: 10000,
    images: [{ kind: 'face-enrollment', label: 'Fotos de referencia del registro facial', stored: 12 }],
    tasks: [
      {
        task: 'delete',
        label: 'Objetos por borrar del bucket',
        pending: 0,
        last_run_at: null,
        last_success_at: null,
        last_error_at: null,
        last_error: null,
      },
    ],
  },
};

const bucket = {
  ...status.storage,
  configured: true,
  backend: 'gcs',
  bucket: 'employee-time-clock-fb8ba.firebasestorage.app',
  reason: null,
  images: [
    { kind: 'face-enrollment', label: 'Fotos de referencia del registro facial', stored: 25000 },
    { kind: 'payment-receipt', label: 'Comprobantes de pago', stored: 3 },
  ],
  tasks: [
    {
      task: 'delete',
      label: 'Objetos por borrar del bucket',
      pending: 3,
      last_run_at: '2026-10-04T18:00:00Z',
      last_success_at: '2026-10-04T18:00:00Z',
      last_error_at: '2026-10-04T17:55:00Z',
      last_error: 'StorageUnavailable: ConnectionError',
    },
  ],
};

describe('ServerStatusPanel', () => {
  it('componentes y prioridades que la app aún no conoce se muestran con su nombre técnico', async () => {
    mockFetch(apiOk(status));
    renderWithProviders(<ServerStatusPanel />);
    expect(await screen.findByText('Funciones limitadas')).toBeInTheDocument();
    expect(screen.getByText('Base de datos: disponible')).toBeInTheDocument();
    expect(screen.getByText('cache_redis: timeout')).toBeInTheDocument();
    expect(screen.getByText('Sin respuesta en 2 s')).toBeInTheDocument();
    expect(screen.getByText('prioridad crítica · 1,500 peticiones recientes · 210.5 ms · 3 descartadas')).toBeInTheDocument();
    expect(screen.getByText('prioridad BATCH · 12 peticiones recientes')).toBeInTheDocument(); // sin latencia ni descartes
    expect(screen.getByText(/entre 8 y 200/)).toBeInTheDocument();
  });

  it('sin bucket configurado: por qué está apagado y qué hay en el almacenamiento (nada por migrar: las imágenes nunca viven en la base)', async () => {
    mockFetch(apiOk(status));
    renderWithProviders(<ServerStatusPanel />);
    expect(await screen.findByText('Almacenamiento de imágenes: apagado')).toBeInTheDocument();
    expect(screen.getByText(/aún no está montada \(archivo vacío\)\. Hasta configurarlo, no se pueden guardar registros faciales/)).toBeInTheDocument();
    expect(screen.getByText('12 en el almacenamiento')).toBeInTheDocument();
    expect(screen.getByText('0 por borrar')).toBeInTheDocument(); // el mantenimiento aún no corre
    expect(screen.queryByText(/por migrar/)).not.toBeInTheDocument();
  });

  it('sin bucket y sin motivo del backend: solo dice qué no es posible', async () => {
    mockFetch(apiOk({ ...status, storage: { ...status.storage, reason: null } }));
    renderWithProviders(<ServerStatusPanel />);
    expect(await screen.findByText('. Hasta configurarlo, no se pueden guardar registros faciales ni comprobantes')).toBeInTheDocument();
  });

  it('con el bucket: dónde guarda, conteos con tope, la última vuelta y el último error de cada tarea', async () => {
    mockFetch(apiOk({ ...status, storage: bucket }));
    renderWithProviders(<ServerStatusPanel />);
    expect(await screen.findByText('Almacenamiento de imágenes: gs://employee-time-clock-fb8ba.firebasestorage.app/local/')).toBeInTheDocument();
    expect(screen.getByText(/la base de datos solo guarda su referencia/)).toBeInTheDocument();
    expect(screen.getByText('10,000+ en el almacenamiento')).toBeInTheDocument();
    expect(screen.getByText('3 en el almacenamiento')).toBeInTheDocument();
    const deletions = screen.getByText(/^3 por borrar · última vuelta correcta/);
    expect(deletions).toHaveTextContent('último error');
    expect(deletions).toHaveTextContent('StorageUnavailable: ConnectionError');
  });

  it('si el estado no se pudo cargar: límites desconocidos y "Reintentar"', async () => {
    let attempts = 0;
    mockFetch(() => (++attempts === 1 ? apiFail(403, 'FORBIDDEN', 'Sin permiso') : apiOk(status)));
    renderWithProviders(<ServerStatusPanel />);
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el estado del servidor' });
    expect(screen.getByText(/entre … y …/)).toBeInTheDocument();
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Funciones limitadas')).toBeInTheDocument();
  });
});
