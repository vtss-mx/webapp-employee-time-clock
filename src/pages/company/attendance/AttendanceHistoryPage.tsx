import { History, SearchX } from 'lucide-react';
import { useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MinutesBadge } from '../../../components/attendance/MinutesBadge';
import { usePlaceLabel } from '../../../components/attendance/SessionTimeline';
import { clockOn, scheduleRange } from '../../../components/attendance/sessionFacts';
import { ReviewBadge } from '../../../components/attendance/ReviewParts';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { Checkbox } from '../../../components/ui/Checkbox';
import { DateField, parseIso } from '../../../components/ui/DateField';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { Select } from '../../../components/ui/Select';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { usePagedList } from '../../../hooks/usePagedList';
import { t, useT, type MessageKey } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import type { CompanySession, WorkSessionStatus } from '../../../types';
import { businessToday, formatDate, formatMinutes } from '../../../utils/format';
import { quickRanges } from '../../../utils/dateRanges';
import { Avatar } from '../../../components/ui/Avatar';
import { DeletedMark } from '../../../components/ui/DeletedMark';

type StatusChoice = WorkSessionStatus | 'all';

interface Range {
  start: string;
  end: string;
}

/** Sin fechas: todo el historial (la jornada más reciente primero). */
const ALL_DATES: Range = { start: '', end: '' };

/** Una fecha escrita a medias no filtra; una que no existe (31/02) se marca y tampoco filtra. */
const applied = (value: string) => (parseIso(value) ? value : undefined);
const invalid = (value: string) => (value && !parseIso(value) ? t('attendance.history.invalidDate') : undefined);

/** Columnas de la tabla (y la etiqueta de cada dato en las tarjetas del teléfono). */
const COLUMNS = [
  'common.fields.employee',
  'common.fields.date',
  'attendance.fields.shift',
  'attendance.fields.checkIn',
  'attendance.fields.checkOut',
  'attendance.fields.worked',
  'common.fields.status',
] as const satisfies readonly MessageKey[];

/** Título del popup si el historial no carga (se arma al dibujarse: sigue al idioma activo). */
const historyLoadError = () => t('attendance.history.loadError');

interface FiltersProps {
  range: Range;
  onRange: (range: Range) => void;
  status: StatusChoice;
  onStatus: (status: StatusChoice) => void;
  /** Solo las jornadas "en revisión" que esperan la decisión de la empresa. */
  inReview: boolean;
  onInReview: (value: boolean) => void;
}

/** Filtros del historial: rangos de un clic, las dos fechas a mano, el estado y "solo en revisión". */
function HistoryFilters({ range, onRange, status, onStatus, inReview, onInReview }: FiltersProps) {
  const t = useT();
  const { active } = useCatalogs();
  const statusId = useId();
  const today = businessToday();
  const options = [{ key: 'all', label: t('attendance.history.allDates'), ...ALL_DATES }, ...quickRanges()];
  return (
    <div className="att-filters">
      <div className="chips" role="group" aria-label={t('attendance.history.quickRanges')}>
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
        <DateField label={t('attendance.history.from')} name="start" value={range.start} max={today} error={invalid(range.start)} onChange={(start) => onRange({ ...range, start })} />
        <DateField label={t('attendance.history.to')} name="end" value={range.end} min={applied(range.start)} max={today} error={invalid(range.end)} onChange={(end) => onRange({ ...range, end })} />
        <div className="field">
          <label id={`${statusId}-label`} htmlFor={statusId}>
            {t('common.fields.status')}
          </label>
          <Select<StatusChoice>
            id={statusId}
            aria-labelledby={`${statusId}-label`}
            value={status}
            onChange={onStatus}
            options={[{ value: 'all', label: t('attendance.history.allStatuses') }, ...active('work_session_statuses').map((item) => ({ value: item.code, label: item.name }))]}
          />
        </div>
      </div>
      <Checkbox checked={inReview} onChange={onInReview} label={t('attendance.review.onlyPending')} description={t('attendance.review.onlyPendingHint')} />
    </div>
  );
}

function SessionCells({ session }: { session: CompanySession }) {
  const t = useT();
  const place = usePlaceLabel();
  const { employee } = session;
  return (
    <>
      <td className="table__primary">
        <span className="person">
          <Avatar name={employee.full_name} decorative />
          <span className="person__info">
            <strong className="truncate">{employee.full_name}</strong>
            <small>
              {employee.employee_number}
              <DeletedMark deleted={employee.deleted} />
            </small>
          </span>
        </span>
      </td>
      <td data-label={t('common.fields.date')}>{formatDate(session.work_date)}</td>
      <td data-label={t('attendance.fields.shift')}>
        <span className="att-cell">
          <strong>{session.shift_name}</strong>
          <small>{scheduleRange(session.scheduled_start, session.scheduled_end)}</small>
        </span>
      </td>
      <td data-label={t('attendance.fields.checkIn')}>
        <span className="att-cell">
          <span className="att-cell__value">
            {clockOn(session.check_in_at, session.work_date)} <MinutesBadge kind="late" minutes={session.late_minutes} />
          </span>
          <small>{place(session.check_in_mode, session.check_in_site)}</small>
        </span>
      </td>
      <td data-label={t('attendance.fields.checkOut')}>
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
      <td data-label={t('attendance.fields.worked')}>{formatMinutes(session.worked_minutes)}</td>
      <td data-label={t('common.fields.status')}>
        <span className="badge-row">
          <CatalogStatusBadge catalog="work_session_statuses" code={session.status} />
          <ReviewBadge session={session} />
        </span>
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
  const t = useT();
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>(ALL_DATES);
  const [status, setStatus] = useState<StatusChoice>('all');
  // `?review` (el enlace del tablero): abre ya filtrado en lo que espera la decisión de la empresa.
  const { search } = useLocation();
  const [inReview, setInReview] = useState(() => new URLSearchParams(search).has('review'));
  const start = applied(range.start);
  const end = applied(range.end);
  const list = usePagedList(
    (page, signal) => attendanceService.sessions({ ...page, start, end, status: status === 'all' ? undefined : status, in_review: inReview || undefined }, signal),
    { errorTitle: historyLoadError, filterKey: `${start}|${end}|${status}|${inReview}` },
  );
  const filtered = Boolean(start ?? end) || status !== 'all' || inReview;

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('attendance.nav.history')}
          subtitle={list.data ? t('attendance.history.count', { count: list.data.total }) : t('common.states.loading')}
          backTo={paths.company.attendance}
          backLabel={t('attendance.nav.dayBoard')}
        />
        <PanelSection>
          <HistoryFilters range={range} onRange={setRange} status={status} onStatus={setStatus} inReview={inReview} onInReview={setInReview} />
          <ListResults
            // Si el backend rechaza los filtros (p. ej. un rango al revés), no se muestran las jornadas
            // de los filtros anteriores como si fueran de los nuevos: queda "Volver a cargar".
            list={list.error ? { ...list, data: null } : list}
            pager={{ noun: { one: t('attendance.history.noun.one'), other: t('attendance.history.noun.other') } }}
            columns={COLUMNS.map((column) => t(column))}
            onOpen={(session) => void navigate(paths.company.attendanceSession(session.id), { state: { from: 'history' } })}
            empty={
              filtered
                ? { icon: <SearchX />, title: t('attendance.history.emptyFiltered.title'), description: t('attendance.history.emptyFiltered.description') }
                : { icon: <History />, title: t('attendance.history.empty.title'), description: t('attendance.history.empty.description') }
            }
            renderCells={(session) => <SessionCells session={session} />}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
