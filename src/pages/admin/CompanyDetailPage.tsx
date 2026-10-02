import { Building2, Gauge, KeyRound, Pencil, Power, PowerOff, UserCog, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CompanyAdminModal } from '../../components/CompanyAdminModal';
import { ConfirmDialog } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useErrorPopup, useFeedback } from '../../hooks/useFeedback';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { CompanyAdmin, CompanyDetail } from '../../types';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatPhone } from '../../utils/phone';

type Pending = { kind: 'company' } | { kind: 'admin'; admin: CompanyAdmin } | null;
const orMissing = (value: string | null | undefined) => value || <span className="muted">Sin capturar</span>;

/** Detalle de una empresa: datos, uso del plan, administradores y estado. */
export function CompanyDetailPage() {
  const companyId = Number(useParams().id);
  const feedback = useFeedback();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirm, setConfirm] = useState<Pending>(null);
  // Modal de administradores: agregar (admin null) o restablecer la contraseña de uno.
  const [adminModal, setAdminModal] = useState<{ admin: CompanyAdmin | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    adminService.get(companyId).then(setCompany).catch(setError);
  }, [companyId]);
  useEffect(load, [load]);
  useErrorPopup(error, { title: 'No se pudo cargar la empresa', retry: load });

  const run = async (action: () => Promise<CompanyDetail>, success: string, detail?: string) => {
    setBusy(true);
    try {
      setCompany(await action());
      feedback.success(success, detail);
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
            <>
              <ButtonLink to={paths.admin.editCompany(company.id)} variant="secondary" icon={<Pencil size={18} />}>
                Editar
              </ButtonLink>
              <Button
                variant={company.active ? 'danger-outline' : 'success'}
                icon={company.active ? <PowerOff size={18} /> : <Power size={18} />}
                loading={busy && confirm === null}
                onClick={toggleCompany}
              >
                {company.active ? 'Desactivar' : 'Activar'}
              </Button>
            </>
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
                <dt>Correo de contacto</dt>
                <dd>{orMissing(company.contact_email)}</dd>
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
            <Button size="sm" variant="primary" icon={<UserPlus size={16} />} onClick={() => setAdminModal({ admin: null })}>
              Agregar administrador
            </Button>
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
                <Button size="sm" variant="ghost" icon={<KeyRound size={16} />} disabled={busy} onClick={() => setAdminModal({ admin })}>
                  Restablecer contraseña
                </Button>
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
        open={confirm?.kind === 'admin'}
        title="Desactivar administrador"
        message={confirm?.kind === 'admin' ? `${confirm.admin.email} ya no podrá iniciar sesión y su sesión actual se cerrará.` : ''}
        confirmLabel="Desactivar"
        tone="danger"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.kind === 'admin' && void run(() => adminService.setAdminStatus(company.id, confirm.admin.id, false), 'Administrador desactivado')}
      />
      <CompanyAdminModal
        open={adminModal !== null}
        company={company}
        admin={adminModal?.admin}
        onClose={() => setAdminModal(null)}
        onSaved={setCompany}
      />
    </div>
  );
}
