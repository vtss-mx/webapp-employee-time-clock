import { Building2, Gauge, KeyRound, Pencil, Power, PowerOff, Trash2, UserCog, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { CompanyAdmin, CompanyDetail } from '../../types';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatPhone } from '../../utils/phone';

type Pending = { kind: 'company' } | { kind: 'delete' } | { kind: 'admin'; admin: CompanyAdmin } | null;
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

/** Detalle de una empresa: datos, uso del plan, administradores y estado. */
export function CompanyDetailPage() {
  const companyId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { data: company, setData: setCompany, error, retry: load } = useResource(() => adminService.get(companyId), companyId, 'No se pudo cargar la empresa');
  const [confirm, setConfirm] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<CompanyDetail>, success: string, detail?: string) => {
    setBusy(true);
    try {
      setCompany(await action());
      void feedback.success(success, detail);
    } catch (e) {
      void feedback.fromError(e, { title: 'No se pudo completar la acción' });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

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
  const remove = async () => {
    setBusy(true);
    try {
      await adminService.remove(company.id);
      void navigate(paths.admin.companies, { replace: true });
      void feedback.success('Empresa eliminada', `${company.name} y sus cuentas de acceso se eliminaron.`);
    } catch (e) {
      setBusy(false);
      setConfirm(null);
      void feedback.fromError(e, { title: 'No se pudo eliminar la empresa' });
    }
  };
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
              toggling={busy && confirm === null}
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

          <PanelSection title="Uso del plan" icon={<Gauge size={20} />}>
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
          title="Administradores"
          icon={<UserCog size={20} />}
          aside={
            <ButtonLink to={paths.admin.newCompanyAdmin(company.id)} size="sm" variant="primary" icon={<UserPlus size={16} />}>
              Agregar administrador
            </ButtonLink>
          }
        >
          <ul className="company-admins">
            {company.admins.map((admin) => (
              <li key={admin.id}>
                <span className="avatar">{admin.email.slice(0, 2).toUpperCase()}</span>
                <span className="company-admins__info">
                  <strong className="truncate">{admin.email}</strong>
                  <small className="muted">
                    {admin.last_login_at ? `Último acceso: ${formatDateTime(admin.last_login_at)}` : 'Aún no inicia sesión'}
                  </small>
                </span>
                <StatusBadge active={admin.active} />
                <ButtonLink to={paths.admin.companyAdminPassword(company.id, admin.id)} size="sm" variant="ghost" icon={<KeyRound size={16} />}>
                  Restablecer contraseña
                </ButtonLink>
                <Button
                  size="sm"
                  variant={admin.active ? 'ghost' : 'secondary'}
                  disabled={busy}
                  onClick={() =>
                    admin.active
                      ? setConfirm({ kind: 'admin', admin })
                      : void run(() => adminService.setAdminStatus(company.id, admin.id, true), 'Administrador activado')
                  }
                >
                  {admin.active ? 'Desactivar' : 'Activar'}
                </Button>
              </li>
            ))}
          </ul>
        </PanelSection>
      </Panel>

      <ConfirmDialog
        open={confirm?.kind === 'company'}
        title={`Desactivar ${company.name}`}
        message="Se cerrará de inmediato la sesión de todo su personal (administradores y empleados) y nadie podrá iniciar sesión hasta que la actives de nuevo. Sus datos se conservan."
        confirmLabel="Desactivar empresa"
        tone="danger"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run(() => adminService.setStatus(company.id, false), 'Empresa desactivada', 'Su personal ya no puede iniciar sesión.')}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title={`Eliminar ${company.name}`}
        message="Se eliminan la empresa, sus administradores, sus validadores y su configuración. No se puede deshacer."
        confirmLabel="Eliminar empresa"
        confirmText={company.name}
        tone="danger"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void remove()}
      />
      <ConfirmDialog
        open={confirm?.kind === 'admin'}
        title="Desactivar administrador"
        message={confirm?.kind === 'admin' ? `${confirm.admin.email} ya no podrá iniciar sesión y su sesión actual se cerrará.` : ''}
        confirmLabel="Desactivar"
        tone="danger"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.kind === 'admin' && void run(() => adminService.setAdminStatus(company.id, confirm.admin.id, false), 'Administrador desactivado')}
      />
    </div>
  );
}
