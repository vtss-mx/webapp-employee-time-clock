import { Blocks, Building2, Gauge, KeyRound, Pencil, Power, PowerOff, Trash2, UserCog, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { PagedItems } from '../../components/ui/PagedItems';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { useAction } from '../../hooks/useAction';
import { usePagedList, type PagedList } from '../../hooks/usePagedList';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { CompanyAdmin, CompanyDetail } from '../../types';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatPhone } from '../../utils/phone';

type Pending = { kind: 'company' } | { kind: 'delete' } | { kind: 'api' } | { kind: 'admin'; admin: CompanyAdmin } | null;
const orMissing = (value: string | null | undefined) => value || <span className="muted">Sin capturar</span>;

interface CompanyActionsProps {
  company: CompanyDetail;
  busy: boolean;
  toggling: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

/** Editar, activar o desactivar y eliminar (solo sin empleados: con empleados, se desactiva). */
function CompanyActions({ company, busy, toggling, onToggle, onDelete }: CompanyActionsProps) {
  const removable = company.employee_count === 0;
  return (
    <>
      <ButtonLink to={paths.admin.editCompany(company.id)} variant="secondary" icon={<Pencil size={18} />}>
        Editar
      </ButtonLink>
      <Button
        variant={company.active ? 'danger-outline' : 'success'}
        icon={company.active ? <PowerOff size={18} /> : <Power size={18} />}
        loading={toggling}
        onClick={onToggle}
      >
        {company.active ? 'Desactivar' : 'Activar'}
      </Button>
      <Button
        variant="danger-outline"
        icon={<Trash2 size={18} />}
        disabled={!removable || busy}
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
  busy: boolean;
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
              <Button size="sm" variant={admin.active ? 'ghost' : 'secondary'} disabled={busy} onClick={() => onToggle(admin)}>
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
  const [confirm, setConfirm] = useState<Pending>(null);
  // Qué se procesa: el acceso a la API muestra su propio interruptor ocupado; lo demás, `true`.
  const action = useAction<'api' | true>();
  const busy = action.busy !== null;
  const close = () => setConfirm(null);

  /** Cambio que devuelve la empresa actualizada (estado o módulos de la empresa, o de un administrador). */
  const run = (task: () => Promise<CompanyDetail>, success: string, detail?: string, what: 'api' | true = true) =>
    action.run(task, { errorTitle: 'No se pudo completar la acción', success: [success, detail], onSuccess: setCompany, onSettled: close, busy: what });
  /** Cambia el estado de un administrador y vuelve a pedir la página (el backend decide el resultado). */
  const setAdminActive = (admin: CompanyAdmin, active: boolean) =>
    run(() => adminService.setAdminStatus(companyId, admin.id, active), active ? 'Administrador activado' : 'Administrador desactivado').then(admins.retry);
  const toggleAdmin = (admin: CompanyAdmin) => (admin.active ? setConfirm({ kind: 'admin', admin }) : void setAdminActive(admin, true));

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
    company.active
      ? setConfirm({ kind: 'company' })
      : void run(() => adminService.setStatus(company.id, true), 'Empresa activada', 'Su personal ya puede iniciar sesión.');
  const setApiAccess = (enabled: boolean) =>
    enabled
      ? void run(() => adminService.setApiAccess(company.id, true), 'Integraciones activadas', 'La empresa ya ve la pantalla Integraciones (API) y sus llaves funcionan.', 'api')
      : setConfirm({ kind: 'api' });
  const remove = () =>
    action.run(() => adminService.remove(company.id), {
      errorTitle: 'No se pudo eliminar la empresa',
      success: ['Empresa eliminada', `${company.name} y sus cuentas de acceso se eliminaron.`],
      onSuccess: () => void navigate(paths.admin.companies, { replace: true }),
      onError: close,
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
            <CompanyActions
              company={company}
              busy={busy}
              toggling={action.busy === true && confirm === null}
              onToggle={toggleCompany}
              onDelete={() => setConfirm({ kind: 'delete' })}
            />
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

        <PanelSection title="Módulos" icon={<Blocks size={20} />}>
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
          <CompanyAdmins list={admins} companyId={company.id} busy={busy} onToggle={toggleAdmin} />
        </PanelSection>
      </Panel>

      <ConfirmDialog
        open={confirm?.kind === 'company'}
        title={`Desactivar ${company.name}`}
        message="Se cerrará de inmediato la sesión de todo su personal (administradores y empleados) y nadie podrá iniciar sesión hasta que la actives de nuevo. Sus datos se conservan."
        confirmLabel="Desactivar empresa"
        tone="danger"
        loading={busy}
        onCancel={close}
        onConfirm={() => void run(() => adminService.setStatus(company.id, false), 'Empresa desactivada', 'Su personal ya no puede iniciar sesión.')}
      />
      <ConfirmDialog
        open={confirm?.kind === 'api'}
        title={`Quitar Integraciones a ${company.name}`}
        message="Sus sistemas conectados dejarán de recibir información de inmediato: el backend rechazará sus llaves y la pantalla Integraciones (API) desaparecerá de su menú. Las llaves se conservan y vuelven a funcionar si le devuelves el acceso."
        confirmLabel="Quitar acceso"
        tone="danger"
        loading={busy}
        onCancel={close}
        onConfirm={() => void run(() => adminService.setApiAccess(company.id, false), 'Integraciones desactivadas', 'Sus llaves ya no funcionan hasta que le devuelvas el acceso.', 'api')}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title={`Eliminar ${company.name}`}
        message="Se eliminan la empresa, sus administradores, sus validadores y su configuración. No se puede deshacer."
        confirmLabel="Eliminar empresa"
        confirmText={company.name}
        tone="danger"
        loading={busy}
        onCancel={close}
        onConfirm={() => void remove()}
      />
      <ConfirmDialog
        open={confirm?.kind === 'admin'}
        title="Desactivar administrador"
        message={confirm?.kind === 'admin' ? `${confirm.admin.email} ya no podrá iniciar sesión y su sesión actual se cerrará.` : ''}
        confirmLabel="Desactivar"
        tone="danger"
        loading={busy}
        onCancel={close}
        onConfirm={() => confirm?.kind === 'admin' && void setAdminActive(confirm.admin, false)}
      />
    </div>
  );
}
