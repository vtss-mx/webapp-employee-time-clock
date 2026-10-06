import { Briefcase, CalendarClock, CalendarOff, CircleCheck, CircleSlash, Coffee, History, RefreshCw, SearchX, ShieldQuestion, TreePalm } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BoardList } from '../../../components/attendance/BoardList';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { DateField, parseIso } from '../../../components/ui/DateField';
import { KpiGrid, type Kpi } from '../../../components/ui/KpiCard';
import { ListToolbar } from '../../../components/ui/ListControls';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useSearchList } from '../../../hooks/useSearchList';
import { useSyncOnChange } from '../../../hooks/useSyncOnChange';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import type { AttendanceBoard, BoardRow } from '../../../types';
import { businessToday, formatDate } from '../../../utils/format';
import { quickRanges } from '../../../utils/dateRanges';

/** Lo que el tablero agrega a la página: los conteos del día y si se pidió con una búsqueda. */
type BoardExtra = Omit<AttendanceBoard, 'items' | 'total' | 'page' | 'size'> & { searched: boolean };

/** El día de la URL (?date=AAAA-MM-DD) si es una fecha real; si no, hoy (en la hora del negocio). */
function dayFrom(value: string | null, today: string): string {
  return value && parseIso(value) ? value : today;
}

/** Indicadores del día (los conteos son de todo el día, no solo de la página visible). */
function useBoardKpis(board: (AttendanceBoard & { searched: boolean }) | null): Kpi[] {
  const t = useT();
  const { nameOf } = useCatalogs();
  return [
    { key: 'total', label: t(board?.searched ? 'attendance.board.kpis.matches' : 'attendance.board.kpis.withShift'), icon: CalendarClock, value: board?.total },
    { key: 'working', label: nameOf('board_states', 'WORKING'), icon: Briefcase, value: board?.working },
    { key: 'on_break', label: nameOf('board_states', 'ON_BREAK'), icon: Coffee, value: board?.on_break, tile: 'icon-tile--warning' },
    { key: 'done', label: t('attendance.board.kpis.done'), icon: CircleCheck, value: board?.done, tile: 'icon-tile--success' },
    { key: 'missed', label: nameOf('board_states', 'MISSED_CHECKOUT'), icon: CircleSlash, value: board?.missed_checkout, tile: 'icon-tile--danger' },
    // Festivo o ausencia aprobada: tienen turno pero no lo trabajan (no es una falta).
    { key: 'day_off', label: nameOf('board_states', 'DAY_OFF'), icon: TreePalm, value: board ? (board.day_off ?? 0) : undefined },
  ];
}

/** Título del popup si el tablero no carga (se arma al dibujarse: sigue al idioma activo). */
const boardLoadError = () => t('attendance.board.loadError');

/**
 * Asistencia (COMPANY): el tablero de un día. Quién tiene turno ese día y en qué va (programado, sin
 * entrada, en turno, en descanso, salió, sin salida, faltó o día libre), con los conteos del día,
 * búsqueda por nombre o número y el día en la URL (`?date=`; sin él, hoy en la hora del negocio) para
 * volver al mismo día desde el detalle. Desde cada fila la empresa corrige una jornada o registra la
 * asistencia de quien no checó. Se actualiza a mano ("Actualizar"): sin temporizadores que redibujen
 * la pantalla.
 */
export function AttendancePage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const today = businessToday();
  const day = dayFrom(params.get('date'), today);
  // Lo escrito en el campo (vacío o inválido mientras se escribe); solo una fecha real cambia el día.
  const [input, setInput] = useState(day);
  useSyncOnChange(day, setInput);
  const quick = quickRanges().filter((range) => range.key === 'yesterday' || range.key === 'today');

  const list = useSearchList<BoardRow, BoardExtra>(
    (query, signal) =>
      attendanceService.board({ page: query.page, size: query.size, search: query.search, date: day }, signal).then((board) => ({ ...board, searched: Boolean(query.search) })),
    { errorTitle: boardLoadError, filterKey: day },
  );
  const kpis = useBoardKpis(list.data);

  const pick = (next: string) => {
    setInput(next);
    setParams(next === today ? {} : { date: next }, { replace: true });
  };

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('attendance.board.title')}
          subtitle={day === today ? t('attendance.board.today', { date: formatDate(day) }) : formatDate(day)}
          actions={
            <>
              <ButtonLink to={paths.company.attendanceHistory} variant="ghost" icon={<History size={18} />}>
                {t('attendance.board.history')}
              </ButtonLink>
              <ButtonLink to={`${paths.company.attendanceHistory}?review`} variant="ghost" icon={<ShieldQuestion size={18} />}>
                {t('attendance.review.inReview')}
              </ButtonLink>
              <Button variant="secondary" icon={<RefreshCw size={18} />} loading={list.loading} onClick={list.retry}>
                {t('common.actions.refresh')}
              </Button>
            </>
          }
        />
        <PanelSection>
          <div className="att-filters att-filters--board">
            <div className="att-day">
              <DateField
                label={t('attendance.fields.day')}
                name="date"
                value={input}
                onChange={(value) => {
                  setInput(value);
                  if (parseIso(value)) pick(value);
                }}
              />
              <div className="chips att-day__quick" role="group" aria-label={t('attendance.board.quickDays')}>
                {quick.map((range) => (
                  <button key={range.key} type="button" className={`chip ${range.start === day ? 'is-active' : ''}`} aria-pressed={range.start === day} onClick={() => pick(range.start)}>
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
            <ListToolbar search={list.search} onSearch={list.setSearch} placeholder={t('attendance.board.searchPlaceholder')} label={t('attendance.board.searchLabel')} />
          </div>
          <KpiGrid kpis={kpis} />
          <PagedItems
            list={list}
            pager={{ noun: { one: t('attendance.board.noun.one'), other: t('attendance.board.noun.other') } }}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: t('attendance.board.emptySearch.title'), description: t('attendance.board.emptySearch.description') }
                : { icon: <CalendarOff />, title: t('attendance.board.empty.title'), description: t('attendance.board.empty.description') }
            }
          >
            {(rows) => <BoardList rows={rows} loading={list.loading} workDate={day} />}
          </PagedItems>
        </PanelSection>
      </Panel>
    </div>
  );
}
