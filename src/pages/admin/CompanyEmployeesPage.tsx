import { Eraser, SearchX, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { FaceStatusBadge, StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/Button';
import { ListToolbar } from '../../components/ui/ListControls';
import { ListResults } from '../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { CompanyDetail, CompanyEmployee } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { timeAgo } from '../../utils/format';
import { formatPhone } from '../../utils/phone';
import { Avatar } from '../../components/ui/Avatar';

/* Títulos y avisos que se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const loadError = () => t('admin.shared.loadCompanyError');
const listError = () => t('admin.employees.loadError');
const forgetError = () => t('admin.employees.forget.error');
const forgotten = () => [t('admin.employees.forget.done'), t('admin.employees.forget.doneText')] as const;

/**
 * Empleados de una empresa vistos por el ADMIN de la plataforma (/admin/companies/:id/employees):
 * paginados, con búsqueda y filtro. Su ficha de trabajo es de solo lectura (sin datos fiscales ni
 * biometría): el ADMIN da soporte, no administra al personal de la empresa. Lo único que administra
 * aquí es el aprendizaje del reconocimiento facial (la empresa no lo ve): cuánto aprendió de cada uno
 * y "Olvidar lo aprendido".
 */
export function CompanyEmployeesPage() {
  const companyId = Number(useParams().id);
  // Primero la empresa (su nombre da contexto); la lista se pide después: si el servidor no
  // responde, la persona ve un solo aviso y no dos.
  const { data: company, error, retry } = useResource((signal) => adminService.get(companyId, signal), companyId, loadError);

  if (!company) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={6} />;
  return <CompanyEmployees company={company} />;
}

function CompanyEmployees({ company }: { company: CompanyDetail }) {
  const t = useT();
  const list = useSearchList((query, signal) => adminService.employees(company.id, query, signal), {
    errorTitle: listError,
    filterKey: String(company.id),
  });
  const { data } = list;
  const action = useAction<number>();
  // Se confirma antes de borrar: cancelar no envía nada.
  const forget = (employee: CompanyEmployee) =>
    void action.run(() => adminService.forgetLearnedFace(company.id, employee.id), {
      busy: employee.id,
      confirm: () => forgetConfirm(employee),
      errorTitle: forgetError,
      success: forgotten,
      // El backend devuelve su ficha ya sin lo aprendido: se reemplaza en la página sin volver a pedirla.
      onSuccess: (updated) => list.updateItems((items) => items.map((item) => (item.id === updated.id ? updated : item))),
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('admin.employees.title', { name: company.name })}
          subtitle={data ? t('admin.employees.subtitle', { count: data.total }) : t('common.states.loading')}
          backTo={paths.admin.company(company.id)}
          backLabel={company.name}
        />
        <PanelSection>
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder={t('admin.employees.searchPlaceholder')}
            label={t('admin.employees.searchLabel')}
            filter={list.filter}
            onFilter={list.setFilter}
          />

          <ListResults
            list={list}
            pager={{ noun: { one: t('admin.employees.noun.one'), other: t('admin.employees.noun.other') } }}
            columns={[
              t('common.fields.employee'),
              t('admin.shared.email'),
              t('common.fields.phone'),
              t('common.fields.department'),
              t('admin.employees.face'),
              t('admin.employees.learning'),
              t('common.fields.status'),
            ]}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: t('admin.employees.noMatchTitle'), description: t('admin.employees.noMatchDescription') }
                : { icon: <Users />, title: t('admin.employees.emptyTitle'), description: t('admin.employees.emptyDescription') }
            }
            renderCells={(emp) => {
              const name = `${emp.first_name} ${emp.last_name}`;
              return (
                <>
                  <td className="table__primary">
                    <span className="person">
                      <Avatar name={name} decorative />
                      <span className="person__info">
                        <strong className="truncate">{name}</strong>
                        <small>{emp.employee_number}</small>
                      </span>
                    </span>
                  </td>
                  <td data-label={t('admin.shared.email')} className="table__wide">
                    <span className="truncate">{emp.email}</span>
                  </td>
                  <td data-label={t('common.fields.phone')}>{emp.phone ? formatPhone(emp.phone) : <span className="muted">{t('admin.employees.noPhone')}</span>}</td>
                  <td data-label={t('common.fields.department')}>{emp.department_name ?? <span className="muted">{t('admin.employees.noDepartment')}</span>}</td>
                  <td data-label={t('admin.employees.face')}>
                    <FaceStatusBadge status={emp.face_status} />
                  </td>
                  <td data-label={t('admin.employees.learning')}>
                    <Learned employee={emp} busy={action.busy} onForget={() => forget(emp)} />
                  </td>
                  <td data-label={t('common.fields.status')}>
                    <StatusBadge active={emp.active} />
                  </td>
                </>
              );
            }}
          />
        </PanelSection>
      </Panel>

    </div>
  );
}

/** "1 muestra" / "3 muestras". */
const samples = (count: number) => t('admin.employees.forget.samples', { count });

/** Olvidar lo aprendido de un empleado: qué se borra y que no tendrá que registrarse de nuevo. */
function forgetConfirm(employee: CompanyEmployee): ConfirmInput {
  const name = `${employee.first_name} ${employee.last_name}`;
  return {
    kind: 'delete',
    icon: <Eraser size={30} />,
    eyebrow: t('admin.employees.forget.eyebrow'),
    title: t('admin.employees.forget.title', { name }),
    message: t('admin.employees.forget.message'),
    detailsTitle: t('admin.employees.forget.detailsTitle'),
    details: [
      { label: t('common.fields.employee'), value: `${name} · ${employee.employee_number}` },
      { label: t('admin.employees.forget.learned'), value: `${samples(employee.face_learned_samples)} · ${timeAgo(employee.face_last_learned_at)}` },
    ],
    note: t('admin.employees.forget.note'),
    confirmLabel: t('admin.employees.forget.confirmLabel'),
    confirmIcon: <Eraser size={18} />,
  };
}

interface LearnedProps {
  employee: CompanyEmployee;
  /** Empleado cuyo aprendizaje se está olvidando (su botón muestra el progreso; los demás esperan). */
  busy: number | null;
  onForget: () => void;
}

/** Cuánto aprendió el reconocimiento de sus identificaciones y, si aprendió algo, "Olvidar". */
function Learned({ employee, busy, onForget }: LearnedProps) {
  const t = useT();
  const learned = employee.face_learned_samples;
  if (learned === 0) return <span className="muted">{t('admin.employees.forget.none')}</span>;
  return (
    <span className="learned-cell">
      <span>
        {t('admin.employees.forget.samples', { count: learned })}
        <small className="muted"> · {timeAgo(employee.face_last_learned_at)}</small>
      </span>
      <Button variant="ghost" size="sm" icon={<Eraser size={16} />} loading={busy === employee.id} disabled={busy !== null} onClick={onForget}>
        {t('admin.employees.forget.button')}
      </Button>
    </span>
  );
}
