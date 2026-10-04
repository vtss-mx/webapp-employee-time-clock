import { Blocks, Building2, Gauge, KeyRound, Pencil, Power, PowerOff, ShieldCheck, Trash2, Unplug, UserCheck, UserCog, UserPlus, UserX, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { PagedItems } from '../../components/ui/PagedItems';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { usePagedList, type PagedList } from '../../hooks/usePagedList';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { CompanyAdmin, CompanyDetail } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatPhone } from '../../utils/phone';

/** Qué se está procesando: el estado o el acceso a la API de la empresa, eliminarla o un administrador (su id). */
type Busy = 'status' | 'api' | 'delete' | number;
const orMissing = (value: string | null | undefined) => value || <span className="muted">Sin capturar</span>;

/** Activar o desactivar la empresa: qué pasa con su personal y el estado "antes → después". */
function statusConfirm(company: CompanyDetail): ConfirmInput {
  const state = { label: 'Estado', before: company.active ? 'Activa' : 'Inactiva', after: company.active ? 'Inactiva' : 'Activa' };
  const staff = [
    { label: 'Administradores', value: company.admin_count },
    { label: 'Empleados', value: company.employee_count },
  ];
  return company.active
    ? {
        tone: 'danger',
        icon: <PowerOff size={30} />,
        eyebrow: 'Cambiar estado',
        title: `¿Desactivar ${company.name}?`,
        message: 'Se cerrará de inmediato la sesión de todo su personal (administradores y empleados) y nadie podrá iniciar sesión hasta que la actives de nuevo.',
        changes: [state],
        detailsTitle: 'Personal afectado',
        details: staff,
        note: 'Sus datos se conservan: puedes activarla de nuevo cuando quieras.',
        confirmLabel: 'Desactivar empresa',
        confirmIcon: <PowerOff size={18} />,
      }
    : {
        tone: 'success',
        icon: <Power size={30} />,
        eyebrow: 'Cambiar estado',
        title: `¿Activar ${company.name}?`,
        message: 'Su personal (administradores y empleados activos) podrá volver a iniciar sesión de inmediato.',
        changes: [state],
        detailsTitle: 'Personal que recupera el acceso',
        details: staff,
        confirmLabel: 'Activar empresa',
        confirmIcon: <Power size={18} />,
      };
}

/** Dar o quitar Integraciones (API): qué ve la empresa y qué pasa con sus llaves. */
function apiConfirm(company: CompanyDetail, enabled: boolean): ConfirmInput {
  const access = { label: 'Integraciones (API)', before: enabled ? 'Sin acceso' : 'Con acceso', after: enabled ? 'Con acceso' : 'Sin acceso' };
  return enabled
    ? {
        tone: 'success',
        icon: <KeyRound size={30} />,
        eyebrow: 'Módulos',
        title: `¿Dar Integraciones a ${company.name}?`,
        message: 'La pantalla Integraciones (API) aparecerá en su menú: podrá crear llaves para conectar sus sistemas (nómina, ERP) con su información.',
        changes: [access],
        note: 'Si ya tenía llaves, vuelven a funcionar de inmediato.',
        confirmLabel: 'Dar acceso',
        confirmIcon: <KeyRound size={18} />,
      }
    : {
        tone: 'danger',
        icon: <Unplug size={30} />,
        eyebrow: 'Módulos',
        title: `¿Quitar Integraciones a ${company.name}?`,
        message: 'Sus sistemas conectados dejarán de recibir información de inmediato: el backend rechazará sus llaves y la pantalla Integraciones (API) desaparecerá de su menú.',
        changes: [access],
        note: 'Las llaves se conservan y vuelven a funcionar si le devuelves el acceso.',
        confirmLabel: 'Quitar acceso',
        confirmIcon: <Unplug size={18} />,
      };
}

/** Eliminar definitivamente (solo sin empleados): se escribe su nombre para habilitarlo. */
function deleteConfirm(company: CompanyDetail): ConfirmInput {
  return {
    kind: 'delete',
    title: `¿Eliminar ${company.name}?`,
    message: 'Se eliminan la empresa, sus administradores, sus validadores y su configuración.',
    detailsTitle: 'Se eliminará',
    details: [
      { label: 'Razón social', value: orMissing(company.legal_name) },
      { label: 'RFC', value: orMissing(company.rfc) },
      { label: 'Administradores', value: company.admin_count },
    ],
    note: 'Esta acción no se puede deshacer.',
    confirmText: company.name,
    confirmLabel: 'Eliminar empresa',
  };
}

/** Activar o desactivar a un administrador de la empresa: su acceso, "antes → después". */
function adminConfirm(admin: CompanyAdmin, company: CompanyDetail): ConfirmInput {
  const state = { label: 'Estado', before: admin.active ? 'Activo' : 'Inactivo', after: admin.active ? 'Inactivo' : 'Activo' };
  return admin.active
    ? {
        tone: 'danger',
        icon: <UserX size={30} />,
        eyebrow: 'Administrador de la empresa',
        title: `¿Desactivar a ${admin.email}?`,
        message: `Ya no podrá iniciar sesión en ${company.name} y su sesión actual se cerrará.`,
        changes: [state],
        note: 'Su cuenta se conserva: puedes activarla de nuevo cuando quieras.',
        confirmLabel: 'Desactivar administrador',
        confirmIcon: <UserX size={18} />,
      }
    : {
        tone: 'success',
        icon: <UserCheck size={30} />,
        eyebrow: 'Administrador de la empresa',
        title: `¿Activar a ${admin.email}?`,
        message: `Podrá volver a iniciar sesión en ${company.name} con su correo y contraseña.`,
        changes: [state],
        confirmLabel: 'Activar administrador',
        confirmIcon: <UserCheck size={18} />,
      };
}

interface CompanyActionsProps {
  company: CompanyDetail;
  busy: Busy | null;
  onToggle: () => void;
  onDelete: () => void;
}

/** Editar, activar o desactivar y eliminar (solo sin empleados: con empleados, se desactiva). */
function CompanyActions({ company, busy, onToggle, onDelete }: CompanyActionsProps) {
  const removable = company.employee_count === 0;
  return (
    <>
      <ButtonLink to={paths.admin.editCompany(company.id)} variant="secondary" icon={<Pencil size={18} />}>
        Editar
      </ButtonLink>
      <Button
        variant={company.active ? 'danger-outline' : 'success'}
        icon={company.active ? <PowerOff size={18} /> : <Power size={18} />}
        loading={busy === 'status'}
        disabled={busy !== null}
        onClick={onToggle}
      >
        {company.active ? 'Desactivar' : 'Activar'}
      </Button>
      <Button
        variant="danger-outline"
        icon={<Trash2 size={18} />}
        loading={busy === 'delete'}
        disabled={!removable || busy !== null}
        title={removable ? undefined : 'Tiene empleados registrados: desactívala en lugar de eliminarla'}
        onClick={onDelete}
      >
        Eliminar
      </Button>
    </>
  );
}

interface CompanyAdminsProps {
  list: PagedList<CompanyAdmin>;
  companyId: number;
  busy: Busy | null;
  onToggle: (admin: CompanyAdmin) => void;
}

/** Administradores de la empresa (paginados): último acceso, estado, contraseña y activación. */
function CompanyAdmins({ list, companyId, busy, onToggle }: CompanyAdminsProps) {
  return (
    <PagedItems
      list={list}
      skeletonRows={2}
      empty={{ compact: true, icon: <UserCog />, title: 'No hay administradores registrados', description: 'Agrega la cuenta de la persona que administrará la empresa.' }}
      pager={{ variant: 'compact', siblings: 0, noun: { one: 'administrador', other: 'administradores' } }}
    >
      {(admins) => (
        <ul className={`company-admins ${list.loading ? 'is-loading' : ''}`}>
          {admins.map((admin) => (
            <li key={admin.id}>
              <span className="avatar">{admin.email.slice(0, 2).toUpperCase()}</span>
              <span className="company-admins__info">
                <strong className="truncate">{admin.email}</strong>
                <small className="muted">{admin.last_login_at ? `Último acceso: ${formatDateTime(admin.last_login_at)}` : 'Aún no inicia sesión'}</small>
              </span>
              <StatusBadge active={admin.active} />
              <ButtonLink to={paths.admin.companyAdminPassword(companyId, admin.id)} size="sm" variant="ghost" icon={<KeyRound size={16} />}>
                Restablecer contraseña
              </ButtonLink>
              <Button size="sm" variant={admin.active ? 'ghost' : 'secondary'} loading={busy === admin.id} disabled={busy !== null} onClick={() => onToggle(admin)}>
                {admin.active ? 'Desactivar' : 'Activar'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </PagedItems>
  );
}

interface ApiAccessProps {
  enabled: boolean;
  busy: boolean;
  saving: boolean;
  onChange: (enabled: boolean) => void;
}

/**
 * Módulos de la empresa que decide el ADMIN de la plataforma. Integraciones (API): sin acceso, su
 * pantalla desaparece del menú y el backend rechaza sus llaves (se conservan: al devolverle el
 * acceso vuelven a funcionar).
 */
function ApiAccess({ enabled, busy, saving, onChange }: ApiAccessProps) {
  return (
    <Switch
      checked={enabled}
      onChange={onChange}
      icon={<KeyRound size={20} />}
      label="Integraciones (API)"
      description={
        enabled
          ? 'La empresa puede crear llaves y conectar sus sistemas (nómina, ERP) con su información.'
          : 'Sin acceso: la pantalla no aparece en su menú y sus llaves no funcionan.'
      }
      disabled={busy}
      busy={saving}
    />
  );
}

/** Detalle de una empresa: datos, uso del plan, módulos, administradores y estado. */
export function CompanyDetailPage() {
  const companyId = Number(useParams().id);
  const navigate = useNavigate();
  const { data: company, setData: setCompany, error, retry: load } = useResource((signal) => adminService.get(companyId, signal), companyId, 'No se pudo cargar la empresa');
  const admins = usePagedList((page, signal) => adminService.admins(companyId, page, signal), {
    errorTitle: 'No se pudieron cargar los administradores',
    filterKey: String(companyId),
  });
  // Qué se procesa (cada botón muestra su propio "ocupado"; los demás esperan). Cada cambio se
  // confirma antes: cancelar no envía nada y la pantalla queda como estaba.
  const action = useAction<Busy>();
  const busy = action.busy !== null;

  /** Cambio confirmado que devuelve la empresa actualizada (su estado, sus módulos o un administrador). */
  const change = (task: () => Promise<CompanyDetail>, what: Busy, confirm: ConfirmInput, success: SuccessNotice, onSettled?: () => void) =>
    void action.run(task, { busy: what, confirm, errorTitle: 'No se pudo completar la acción', success, onSuccess: setCompany, onSettled });

  if (!company) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title="Empresa" backTo={paths.admin.companies} backLabel="Empresas" />
          <PanelSection>
            <RetryState onRetry={load} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={6} />
    );
  }

  const toggleCompany = () =>
    change(
      () => adminService.setStatus(company.id, !company.active),
      'status',
      statusConfirm(company),
      company.active ? ['Empresa desactivada', 'Su personal ya no puede iniciar sesión.'] : ['Empresa activada', 'Su personal ya puede iniciar sesión.'],
    );
  const setApiAccess = (enabled: boolean) =>
    change(
      () => adminService.setApiAccess(company.id, enabled),
      'api',
      apiConfirm(company, enabled),
      enabled
        ? ['Integraciones activadas', 'La empresa ya ve la pantalla Integraciones (API) y sus llaves funcionan.']
        : ['Integraciones desactivadas', 'Sus llaves ya no funcionan hasta que le devuelvas el acceso.'],
    );
  // Al terminar (bien o mal) se vuelve a pedir la página de administradores: el backend decide su estado.
  const toggleAdmin = (admin: CompanyAdmin) =>
    change(
      () => adminService.setAdminStatus(company.id, admin.id, !admin.active),
      admin.id,
      adminConfirm(admin, company),
      [admin.active ? 'Administrador desactivado' : 'Administrador activado'],
      admins.retry,
    );
  const remove = () =>
    void action.run(() => adminService.remove(company.id), {
      busy: 'delete',
      confirm: deleteConfirm(company),
      errorTitle: 'No se pudo eliminar la empresa',
      success: ['Empresa eliminada', `${company.name} y sus cuentas de acceso se eliminaron.`],
      onSuccess: () => void navigate(paths.admin.companies, { replace: true }),
      keepBusy: true,
    });
  const usage = company.max_employees ? Math.min(100, Math.round((company.employee_count / company.max_employees) * 100)) : null;

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={company.name}
          backTo={paths.admin.companies}
          backLabel="Empresas"
          subtitle={
            <>
              <StatusBadge active={company.active} /> {company.rfc ?? 'Sin RFC'} · desde {formatDate(company.created_at)}
            </>
          }
          actions={
            <CompanyActions company={company} busy={action.busy} onToggle={toggleCompany} onDelete={remove} />
          }
        />

        <PanelGrid>
          <PanelSection title="Datos de la empresa" icon={<Building2 size={20} />}>
            <dl className="details">
              <div>
                <dt>Razón social</dt>
                <dd>{orMissing(company.legal_name)}</dd>
              </div>
              <div>
                <dt>RFC</dt>
                <dd>{orMissing(company.rfc)}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{orMissing(company.phone && formatPhone(company.phone))}</dd>
              </div>
              <div>
                <dt>Última actualización</dt>
                <dd>{formatDateTime(company.updated_at)}</dd>
              </div>
            </dl>
          </PanelSection>

          <PanelSection
            title="Uso del plan"
            icon={<Gauge size={20} />}
            aside={
              <ButtonLink to={paths.admin.companyEmployees(company.id)} size="sm" variant="ghost" icon={<Users size={16} />}>
                Ver empleados
              </ButtonLink>
            }
          >
            <div className="usage">
              <div className="usage__numbers">
                <strong>{company.employee_count}</strong>
                <span className="muted">{company.max_employees ? `de ${company.max_employees} empleados` : 'empleados · sin límite'}</span>
              </div>
              {usage !== null && (
                <div className={`usage__bar ${usage >= 90 ? 'is-high' : ''}`} role="meter" aria-valuenow={usage} aria-valuemin={0} aria-valuemax={100} aria-label="Uso del límite de empleados">
                  <span style={{ width: `${usage}%` }} />
                </div>
              )}
              <dl className="details">
                <div>
                  <dt>Administradores</dt>
                  <dd>{company.admin_count}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{company.active ? 'Operando' : 'Desactivada: su personal no puede iniciar sesión'}</dd>
                </div>
              </dl>
            </div>
          </PanelSection>
        </PanelGrid>

        <PanelSection
          title="Módulos y seguridad"
          icon={<Blocks size={20} />}
          aside={
            <ButtonLink to={paths.admin.companyPolicy(company.id)} size="sm" variant="secondary" icon={<ShieldCheck size={16} />}>
              Política de verificación
            </ButtonLink>
          }
        >
          <ApiAccess enabled={company.api_enabled} busy={busy} saving={action.busy === 'api'} onChange={setApiAccess} />
        </PanelSection>

        <PanelSection
          title="Administradores"
          icon={<UserCog size={20} />}
          aside={
            <ButtonLink to={paths.admin.newCompanyAdmin(company.id)} size="sm" variant="primary" icon={<UserPlus size={16} />}>
              Agregar administrador
            </ButtonLink>
          }
        >
          <CompanyAdmins list={admins} companyId={company.id} busy={action.busy} onToggle={toggleAdmin} />
        </PanelSection>
      </Panel>
    </div>
  );
}
