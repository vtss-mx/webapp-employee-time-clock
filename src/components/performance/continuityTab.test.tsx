import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Continuity, RestoreDrill } from '../../types/continuity';
import { ContinuityTab } from './ContinuityTab';

const pitr: RestoreDrill = {
  id: 1,
  kind: 'PITR',
  started_at: '2026-10-01T02:00:00Z',
  finished_at: '2026-10-01T02:12:00Z',
  success: true,
  rto_seconds: 720,
  rpo_seconds: 45,
  dataset_mb: 2048,
  target_rto_minutes: 30,
  target_rpo_seconds: 60,
  met_targets: true,
  actor: 'scripts/db_pitr_check.sh',
  notes: null,
  recorded_at: '2026-10-01T02:12:30Z',
};
/** Un ensayo que restauró pero fuera de la meta, y otro que falló: los dos hay que verlos. */
const missed: RestoreDrill = { ...pitr, id: 2, met_targets: false, rpo_seconds: 120, notes: 'La red del bucket estuvo lenta.' };
const failed: RestoreDrill = { ...pitr, id: 3, kind: 'BUCKET_DUMP', success: false, finished_at: null, rto_seconds: null, rpo_seconds: null, dataset_mb: null, met_targets: false };
/** Un mecanismo que esta versión no conoce: su código es un dato y se dibuja tal cual. */
const unknownKind = { ...pitr, id: 4, kind: 'MECANISMO_NUEVO' } as unknown as RestoreDrill;

const data: Continuity = {
  rto_minutes: 30,
  rpo_seconds: 60,
  drill_interval_days: 90,
  backup_upload_enabled: true,
  pitr_enabled: true,
  backup_interval_hours: 24,
  backup_retention_days: 30,
  pitr_archive_timeout_seconds: 60,
  pitr_retention_days: 14,
  drills: [
    { kind: 'PITR', last_attempt: pitr, last_success: pitr, days_since_success: 4, overdue: false, due_on: '2026-12-30T02:00:00Z' },
    { kind: 'BUCKET_DUMP', last_attempt: null, last_success: null, days_since_success: null, overdue: true, due_on: null },
  ],
  overdue_count: 1,
};

const render = (overview: Continuity | null = data, error: unknown = null, drills: RestoreDrill[] = [pitr, missed, failed, unknownKind]) => {
  mockFetch(apiOk({ items: drills, total: drills.length, page: 1, size: 10 }));
  return renderWithProviders(<ContinuityTab data={overview} error={error} retry={() => undefined} />);
};

describe('ContinuityTab (continuidad del servicio, ADMIN)', () => {
  it('el compromiso declarado y lo que está encendido hoy', async () => {
    render();
    expect(await screen.findByText('Compromiso de recuperación')).toBeInTheDocument();
    expect(screen.getByText('Tiempo máximo para volver (RTO)').nextElementSibling).toHaveTextContent('30 min');
    expect(screen.getByText('Pérdida máxima de datos (RPO)').nextElementSibling).toHaveTextContent('1 min');
    expect(screen.getByText('Copia del respaldo al almacenamiento').nextElementSibling).toHaveTextContent('Encendida');
    expect(screen.getByText('Cada cuánto hay que ensayar').nextElementSibling).toHaveTextContent('90 días');
  });

  it('«nunca ensayado» cuenta como vencido y se ve: su estado, su borde y el contador de la sección', async () => {
    const { container } = render();
    expect(await screen.findByText('1 mecanismo está vencido o nunca se ha ensayado.')).toBeInTheDocument();
    const never = screen.getByText('Nunca ensayado').closest('li') as HTMLElement;
    expect(never).toHaveClass('drill--never');
    expect(never).toHaveTextContent('Nunca se ha ensayado: toca hacerlo.');
    expect(within(never).getByText('Nunca ensayado')).toHaveClass('badge--danger');
    const ok = screen.getByText('Al día').closest('li') as HTMLElement;
    expect(ok).toHaveTextContent('Volvió en 12 min');
    expect(ok).toHaveTextContent('Se perdieron 45 s');
    expect(ok).toHaveTextContent('Con 2,048.00 MB');
    expect(container.querySelectorAll('.drill-list li')).toHaveLength(2);
  });

  it('el historial lleva lo medido frente a lo comprometido entonces, los fallidos y un mecanismo desconocido', async () => {
    render();
    const rows = await waitFor(() => {
      const found = [...document.querySelectorAll('.table tbody tr')];
      expect(found).toHaveLength(4);
      return found;
    });
    expect(within(rows[0] as HTMLElement).getByText('Cumplió')).toHaveClass('badge--success');
    expect(rows[0]).toHaveTextContent('Comprometido entonces: 30 min y 1 min');
    expect(rows[0]).toHaveTextContent('scripts/db_pitr_check.sh');
    expect(within(rows[1] as HTMLElement).getByText('Restauró, fuera de meta')).toHaveClass('badge--warning');
    expect(rows[1]).toHaveTextContent('La red del bucket estuvo lenta.');
    expect(within(rows[2] as HTMLElement).getByText('Falló')).toHaveClass('badge--danger');
    expect(rows[2]).toHaveTextContent('Sin medir');
    expect(rows[3]).toHaveTextContent('MECANISMO_NUEVO');
  });

  it('un último intento fallido se señala aunque el último éxito siga vigente', async () => {
    render({ ...data, drills: [{ kind: 'PITR', last_attempt: { ...pitr, id: 9, success: false }, last_success: pitr, days_since_success: 4, overdue: false, due_on: null }], overdue_count: 0 });
    expect(await screen.findByText('El último falló')).toBeInTheDocument();
    expect(screen.getByText(/El intento del .* falló\./)).toBeInTheDocument();
    expect(screen.getByText(/toca ahora/)).toBeInTheDocument();
  });

  it('un RPO que no se puede cumplir se advierte en lugar de mostrar un número bonito', async () => {
    render({ ...data, rpo_seconds: 30 });
    expect(await screen.findByText(/El RPO prometido es menor que el tiempo con que se archiva la bitácora/)).toBeInTheDocument();
  });

  it('sin mecanismos y sin ensayos, cada vacío lo dice; sin datos y con error, se reintenta', async () => {
    const { unmount } = render({ ...data, drills: [], overdue_count: 0 }, null, []);
    expect(await screen.findByText('Sin mecanismos')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Sin ensayos')).toBeInTheDocument());
    unmount();
    render(null, new Error('falló'));
    expect(screen.getByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
  });

  it('sin datos y sin error no dibuja nada (aún está cargando el resumen de la pantalla)', () => {
    const { container } = render(null, null);
    expect(container).toBeEmptyDOMElement();
  });

  it('si el historial falla se puede reintentar sin perder el compromiso', async () => {
    mockFetch(apiFail(503, 'SERVICE_UNAVAILABLE'));
    renderWithProviders(<ContinuityTab data={data} error={null} retry={() => undefined} />);
    expect(await screen.findByText('Compromiso de recuperación')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
  });

  it('en inglés, el compromiso y los estados salen en el idioma activo', async () => {
    await setLocale('en-US');
    render();
    expect(await screen.findByText('Recovery commitment')).toBeInTheDocument();
    expect(screen.getByText('Never drilled')).toBeInTheDocument();
    expect(screen.getByText('Backup copy to storage').nextElementSibling).toHaveTextContent('On');
  });
});
