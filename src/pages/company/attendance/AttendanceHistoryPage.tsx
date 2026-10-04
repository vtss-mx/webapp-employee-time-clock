import { History, SearchX } from 'lucide-react';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MinutesBadge } from '../../../components/attendance/MinutesBadge';
import { usePlaceLabel } from '../../../components/attendance/SessionTimeline';
import { clockOn, scheduleRange } from '../../../components/attendance/sessionFacts';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { DateField, parseIso } from '../../../components/ui/DateField';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { Select } from '../../../components/ui/Select';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { usePagedList } from '../../../hooks/usePagedList';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import type { CompanySession, WorkSessionStatus } from '../../../types';
import { businessToday, formatDate, formatMinutes, initials } from '../../../utils/format';
import { quickRanges } from '../../../utils/dateRanges';

type StatusChoice = WorkSessionStatus | 'all';

interface Range {
  start: string;
  end: string;
}

/** Sin fechas: todo el historial (la jornada más reciente primero). */
const ALL_DATES: Range = { start: '', end: '' };

/** Una fecha escrita a medias no filtra; una que no existe (31/02) se marca y tampoco filtra. */
const applied = (value: string) => (parseIso(value) ? value : undefined);
const invalid = (value: string) => (value && !parseIso(value) ? 'Escribe una fecha válida' : undefined);

interface FiltersProps {
  range: Range;
  onRange: (range: Range) => void;
  status: StatusChoice;
  onStatus: (status: StatusChoice) => void;
}

/** Filtros del historial: rangos de un clic, las dos fechas a mano y el estado. */
function HistoryFilters({ range, onRange, status, onStatus }: FiltersProps) {
  const { active } = useCatalogs();
  const statusId = useId();
  const today = businessToday();
  const options = [{ key: 'all', label: 'Todas las fechas', ...ALL_DATES }, ...quickRanges()];
  return (
    <div className="att-filters">
      <div className="chips" role="group" aria-label="Rangos rápidos">
        {options.map((option) => {
          const selected = option.start === range.start && option.end === range.end;
          return (
            <button key={option.key} type="button" className={`chip ${selected ? 'is-active' : ''}`} aria-pressed={selected} onClick={() => onRange({ start: option.start, end: option.end })}>
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="att-fields">
        <DateField label="Desde" name="start" value={range.start} max={today} error={invalid(range.start)} onChange={(start) => onRange({ ...range, start })} />
        <DateField label="Hasta" name="end" value={range.end} min={applied(range.start)} max={today} error={invalid(range.end)} onChange={(end) => onRange({ ...range, end })} />
        <div className="field">
          <label id={`${statusId}-label`} htmlFor={statusId}>
            Estado
          </label>
          <Select<StatusChoice>
            id={statusId}
            aria-labelledby={`${statusId}-label`}
            value={status}
            onChange={onStatus}
            options={[{ value: 'all', label: 'Todas' }, ...active('work_session_statuses').map((item) => ({ value: item.code, label: item.name }))]}
          />
        </div>
      </div>
    </div>
  );
}

function SessionCells({ session }: { session: CompanySession }) {
  const place = usePlaceLabel();
  const { employee } = session;
  return (
    <>
      <td className="table__primary">
        <span className="person">
          <span className="avatar">{initials(employee.full_name)}</span>
          <span className="person__info">
            <strong className="truncate">{employee.full_name}</strong>
            <small>{employee.employee_number}</small>
          </span>
        </span>
      </td>
      <td data-label="Fecha">{formatDate(session.work_date)}</td>
      <td data-label="Turno">
        <span className="att-cell">
          <strong>{session.shift_name}</strong>
          <small>{scheduleRange(session.scheduled_start, session.scheduled_end)}</small>
        </span>
      </td>
      <td data-label="Entrada">
        <span className="att-cell">
          <span className="att-cell__value">
            {clockOn(session.check_in_at, session.work_date)} <MinutesBadge kind="late" minutes={session.late_minutes} />
          </span>
          <small>{place(session.check_in_mode, session.check_in_site)}</small>
        </span>
      </td>
      <td data-label="Salida">
        {session.check_out_at ? (
          <span className="att-cell">
            <span className="att-cell__value">
              {clockOn(session.check_out_at, session.work_date)} <MinutesBadge kind="early" minutes={session.early_leave_minutes} />
            </span>
            <small>{place(session.check_out_mode, session.check_out_site)}</small>
          </span>
        ) : (
          '—'
        )}
      </td>
      <td data-label="Trabajado">{formatMinutes(session.worked_minutes)}</td>
      <td data-label="Estado">
        <CatalogStatusBadge catalog="work_session_statuses" code={session.status} />
      </td>
    </>
  );
}

/**
 * Historial de asistencia (COMPANY): las jornadas de la empresa, la más reciente primero, con su
 * entrada y salida (hora, modalidad y sitio), retardo y salida anticipada, tiempo trabajado y estado.
 * Se filtra por fechas y por estado; el rango lo valida el backend (en orden y de hasta 366 días) y
 * su rechazo se explica en el popup. Cada fila abre la jornada con su evidencia.
 */
export function AttendanceHistoryPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>(ALL_DATES);
  const [status, setStatus] = useState<StatusChoice>('all');
  const start = applied(range.start);
  const end = applied(range.end);
  const list = usePagedList(
    (page, signal) => attendanceService.sessions({ ...page, start, end, status: status === 'all' ? undefined : status }, signal),
    { errorTitle: 'No se pudo cargar el historial de asistencia', filterKey: `${start}|${end}|${status}` },
  );
  const filtered = Boolean(start ?? end) || status !== 'all';

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Historial de asistencia"
          subtitle={list.data ? `${list.data.total.toLocaleString('es-MX')} ${list.data.total === 1 ? 'jornada' : 'jornadas'}` : 'Cargando...'}
          backTo={paths.company.attendance}
          backLabel="Asistencia del día"
        />
        <PanelSection>
          <HistoryFilters range={range} onRange={setRange} status={status} onStatus={setStatus} />
          <ListResults
            // Si el backend rechaza los filtros (p. ej. un rango al revés), no se muestran las jornadas
            // de los filtros anteriores como si fueran de los nuevos: queda "Volver a cargar".
            list={list.error ? { ...list, data: null } : list}
            pager={{ noun: { one: 'jornada', other: 'jornadas' } }}
            columns={['Empleado', 'Fecha', 'Turno', 'Entrada', 'Salida', 'Trabajado', 'Estado']}
            onOpen={(session) => void navigate(paths.company.attendanceSession(session.id), { state: { from: 'history' } })}
            empty={
              filtered
                ? { icon: <SearchX />, title: 'Ninguna jornada coincide con los filtros', description: 'Cambia las fechas o el estado.' }
                : {
                    icon: <History />,
                    title: 'Aún no hay jornadas registradas',
                    description: 'Cada vez que un empleado checa su entrada se abre una jornada; aquí verás todas, con la evidencia de cada registro.',
                  }
            }
            renderCells={(session) => <SessionCells session={session} />}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
