import { ScanFace, ShieldCheck } from 'lucide-react';
import { useCatalogs } from '../hooks/useCatalogs';
import { usePagedList } from '../hooks/usePagedList';
import { employeeService } from '../services/employeeService';
import { formatConfidence, formatDateTime } from '../utils/format';
import { ListPaginator } from './ui/Paginator';
import { RetryState } from './ui/RetryState';
import { SkeletonRows } from './ui/Skeleton';

/**
 * Bitácora de verificaciones de un empleado, paginada (la más reciente primero): método y motivo
 * de cada intento con sus nombres del catálogo.
 */
export function VerificationHistory({ employeeId }: { employeeId: number }) {
  const { nameOf } = useCatalogs();
  const list = usePagedList((page, signal) => employeeService.history(employeeId, page, signal), {
    errorTitle: 'No se pudo cargar la bitácora',
    filterKey: String(employeeId),
  });
  const items = list.data?.items;

  if (!items) return list.error ? <RetryState onRetry={list.retry} /> : <SkeletonRows rows={3} />;
  if (items.length === 0) return <p className="muted">Sin registros todavía.</p>;
  return (
    <>
      <ul className={`log-list ${list.loading ? 'is-loading' : ''}`}>
        {items.map((log) => (
          <li key={log.id}>
            <span className={`icon-tile ${log.success ? 'icon-tile--success' : 'icon-tile--danger'}`} style={{ width: 36, height: 36 }}>
              {log.method === 'FACE' ? <ScanFace size={18} /> : <ShieldCheck size={18} />}
            </span>
            <div style={{ flex: 1 }}>
              <strong>{nameOf('verification_methods', log.method)}</strong> ·{' '}
              {log.success ? 'Exitosa' : nameOf('verification_reasons', log.reason, 'Fallida')}
              {log.score != null && <span className="muted"> · Confianza {formatConfidence(log.score)}</span>}
              <div className="muted small">{formatDateTime(log.created_at)}</div>
            </div>
          </li>
        ))}
      </ul>
      <ListPaginator list={list} variant="compact" siblings={0} noun={{ one: 'intento', other: 'intentos' }} />
    </>
  );
}
