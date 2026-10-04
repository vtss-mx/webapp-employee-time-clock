import { CalendarClock, Inbox, Moon, Plus, SearchX, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { breaksText } from '../../../components/shifts/shiftRules';
import { StatusBadge } from '../../../components/StatusBadge';
import { ButtonLink } from '../../../components/ui/Button';
import { ListToolbar } from '../../../components/ui/ListControls';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useSearchList } from '../../../hooks/useSearchList';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import { formatMinutes } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';

/**
 * Turnos de la empresa: horario, días, descansos, tolerancia y cuántos empleados lo tienen hoy.
 * Desde aquí se crean, se editan (la fila abre la edición), se asigna uno a varios empleados a la vez
 * y se llega a las solicitudes de cambio.
 */
export function ShiftsPage() {
  const navigate = useNavigate();
  const list = useSearchList((query, signal) => shiftService.list(query, signal), { errorTitle: 'No se pudieron cargar los turnos' });
  const create = (
    <ButtonLink to={paths.company.newShift} variant="primary" icon={<Plus size={18} />}>
      Nuevo turno
    </ButtonLink>
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Turnos"
          subtitle={list.data ? `${list.total} ${list.total === 1 ? 'turno' : 'turnos'} · horario, días y tolerancias para checar` : 'Cargando...'}
          actions={
            <>
              <ButtonLink to={paths.company.shiftRequests} variant="ghost" icon={<Inbox size={18} />}>
                Solicitudes de cambio
              </ButtonLink>
              {list.data && list.total > 0 && (
                <ButtonLink to={paths.company.bulkAssignShift} variant="secondary" icon={<UsersRound size={18} />}>
                  Asignar a varios
                </ButtonLink>
              )}
              {create}
            </>
          }
        />
        <PanelSection>
          <ListToolbar search={list.search} onSearch={list.setSearch} placeholder="Buscar por nombre" label="Buscar turnos" filter={list.filter} onFilter={list.setFilter} />
          <ListResults
            list={list}
            pager={{ noun: { one: 'turno', other: 'turnos' } }}
            columns={['Turno', 'Días', 'Descansos', 'Tolerancia', 'Empleados hoy', 'Estado']}
            onOpen={(shift) => void navigate(paths.company.editShift(shift.id))}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: 'Ningún turno coincide con la búsqueda', description: 'Prueba con otra parte del nombre o cambia el filtro de estado.' }
                : {
                    icon: <CalendarClock />,
                    title: 'Aún no hay turnos',
                    description: 'Crea los horarios de tu empresa (matutino, vespertino, nocturno...) para asignarlos a tu personal y llevar su asistencia.',
                    action: create,
                  }
            }
            renderCells={(shift) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <span className="icon-tile">{shift.overnight ? <Moon size={18} /> : <CalendarClock size={18} />}</span>
                    <span className="person__info">
                      <strong className="truncate">{shift.name}</strong>
                      <small>
                        {shiftSchedule(shift)} · {formatMinutes(shift.duration_minutes)}
                      </small>
                    </span>
                  </span>
                </td>
                <td data-label="Días">{weekdaysLabel(shift.weekdays)}</td>
                <td data-label="Descansos">{breaksText(shift.breaks_count, shift.break_minutes)}</td>
                <td data-label="Tolerancia">{shift.late_tolerance_minutes ? `${shift.late_tolerance_minutes} min de retardo` : 'Sin retardo tolerado'}</td>
                <td data-label="Empleados hoy">
                  <span className="badge badge--info badge--plain">{shift.employees}</span>
                </td>
                <td data-label="Estado">
                  <StatusBadge active={shift.active} />
                </td>
              </>
            )}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
