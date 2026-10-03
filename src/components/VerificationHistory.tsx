import { History, ScanFace, ShieldCheck } from 'lucide-react';
import { useCatalogs } from '../hooks/useCatalogs';
import { usePagedList } from '../hooks/usePagedList';
import { employeeService } from '../services/employeeService';
import { formatConfidence, formatDateTime } from '../utils/format';
import { PagedItems } from './ui/PagedItems';

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
  return (
    <PagedItems
      list={list}
      skeletonRows={3}
      empty={{ compact: true, icon: <History />, title: 'No hay verificaciones registradas', description: 'Cada intento de identificación de este empleado quedará registrado aquí.' }}
      pager={{ variant: 'compact', siblings: 0, noun: { one: 'intento', other: 'intentos' } }}
    >
      {(items) => (
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
      )}
    </PagedItems>
  );
}
