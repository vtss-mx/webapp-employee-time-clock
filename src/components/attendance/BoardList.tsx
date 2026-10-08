import { ChevronRight, ClipboardPen, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT, type MessageKey } from '../../i18n';
import { paths } from '../../routes/paths';
import type { BoardRow } from '../../types';
import { CatalogStatusBadge } from '../StatusBadge';
import { ButtonLink } from '../ui/Button';
import { newSessionPath } from './manualSession';
import { MinutesBadge } from './MinutesBadge';
import { ReviewBadge } from './ReviewParts';
import { breaksUsed, clockOn, scheduleRange } from './sessionFacts';
import { Avatar } from '../ui/Avatar';
import { DeletedMark } from '../ui/DeletedMark';

/** Encabezados de las columnas (solo en contenedores anchos; en tarjetas cada dato lleva su etiqueta). */
const COLUMNS = [
  'common.fields.employee',
  'attendance.fields.shift',
  'common.fields.status',
  'attendance.fields.checkIn',
  'attendance.fields.breaks',
  'attendance.fields.checkOut',
] as const satisfies readonly MessageKey[];

function Cell({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <span className={`att-cell ${className}`.trim()}>
      <span className="att-cell__label">{label}</span>
      {children}
    </span>
  );
}

/** En qué va (catálogo board_states); un día libre dice por qué ("Día libre" · "Vacaciones"), no es una falta. */
function RowState({ row }: { row: BoardRow }) {
  return (
    <span className="att-row__state">
      <CatalogStatusBadge catalog="board_states" code={row.state} />
      {row.session && <ReviewBadge session={row.session} />}
      {row.state === 'DAY_OFF' && row.day_off && <small className="att-row__reason">{row.day_off.name}</small>}
    </span>
  );
}

/** Lo que se ve de un empleado en el tablero: quién es, su turno, en qué va y sus registros del día. */
function RowContent({ row }: { row: BoardRow }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const { employee, session } = row;
  return (
    <>
      <span className="person att-row__person">
        <Avatar name={employee.full_name} src={employee.avatar} decorative />
        <span className="person__info">
          <strong className="truncate">{employee.full_name}</strong>
          <small className="truncate">
            {[employee.employee_number, row.department].filter(Boolean).join(' · ')}
            <DeletedMark deleted={employee.deleted} />
          </small>
        </span>
      </span>
      <RowState row={row} />
      {session && <ChevronRight className="att-row__chevron" size={18} aria-hidden="true" />}
      <span className="att-row__facts">
        <Cell label={t('attendance.fields.shift')} className="att-cell--shift">
          <strong className="truncate">{row.shift_name}</strong>
          <small>{scheduleRange(row.scheduled_start, row.scheduled_end)}</small>
        </Cell>
        <Cell label={t('attendance.fields.checkIn')}>
          {session ? (
            <>
              <span className="att-cell__value">
                {clockOn(session.check_in_at, session.work_date)} <MinutesBadge kind="late" minutes={session.late_minutes} />
              </span>
              <small>{nameOf('work_modes', session.check_in_mode)}</small>
            </>
          ) : (
            '—'
          )}
        </Cell>
        <Cell label={t('attendance.fields.breaks')}>{session ? breaksUsed(session) : '—'}</Cell>
        <Cell label={t('attendance.fields.checkOut')}>
          {session?.check_out_at ? (
            <span className="att-cell__value">
              {clockOn(session.check_out_at, session.work_date)} <MinutesBadge kind="early" minutes={session.early_leave_minutes} />
            </span>
          ) : (
            '—'
          )}
        </Cell>
      </span>
    </>
  );
}

/** Quien debía entrar y no checó (sin entrada o faltó): la empresa puede registrar su asistencia. */
const canRegister = (row: BoardRow) => !row.session && (row.state === 'MISSING' || row.state === 'ABSENT');

/**
 * Lo que la empresa puede hacer con la fila (solo la empresa registra o corrige asistencia): corregir
 * una jornada o registrar la de quien no checó. Un día libre o un turno que aún no empieza no tienen
 * nada que registrar. En un contenedor ancho el botón queda solo con su ícono (el nombre sigue siendo
 * su texto para el lector de pantalla y su globo de ayuda).
 */
function RowActions({ row, workDate }: { row: BoardRow; workDate: string }) {
  const t = useT();
  const { employee, session } = row;
  const name = employee.full_name;
  let action: ReactNode = null;
  if (session) {
    action = (
      <ButtonLink to={paths.company.correctAttendanceSession(session.id)} variant="secondary" size="sm" icon={<PencilLine size={16} aria-hidden />} title={t('attendance.board.correctTitle', { name })}>
        <span className="att-board__action-text">{t('attendance.board.correct')}</span>
      </ButtonLink>
    );
  } else if (canRegister(row)) {
    action = (
      <ButtonLink to={newSessionPath(employee.id, workDate)} variant="secondary" size="sm" icon={<ClipboardPen size={16} aria-hidden />} title={t('attendance.board.recordTitle', { name })}>
        <span className="att-board__action-text">{t('attendance.record')}</span>
      </ButtonLink>
    );
  }
  return <div className="att-board__actions">{action}</div>;
}

/**
 * Filas del tablero del día (una tarjeta por empleado en pantallas angostas; columnas alineadas en un
 * contenedor ancho). Quien ya tiene jornada abre su detalle con la evidencia; quien aún no checa
 * (programado, sin entrada, faltó, día libre) no tiene nada que abrir y su fila no aparenta ser un
 * enlace. Las acciones de la empresa (corregir, registrar) van a un lado, fuera del enlace de la fila.
 */
export function BoardList({ rows, loading, workDate }: { rows: BoardRow[]; loading: boolean; workDate: string }) {
  const t = useT();
  return (
    <div className={`table-wrap att-board ${loading ? 'is-loading' : ''}`}>
      <div className="att-board__head" aria-hidden="true">
        {COLUMNS.map((column) => (
          <span key={column}>{t(column)}</span>
        ))}
      </div>
      <ul className="att-board__list">
        {rows.map((row) => (
          <li key={row.employee.id} className="att-board__item">
            {row.session ? (
              <Link className="att-row att-row--link" to={paths.company.attendanceSession(row.session.id)}>
                <RowContent row={row} />
              </Link>
            ) : (
              <div className="att-row">
                <RowContent row={row} />
              </div>
            )}
            <RowActions row={row} workDate={workDate} />
          </li>
        ))}
      </ul>
    </div>
  );
}
