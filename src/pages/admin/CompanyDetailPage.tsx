import { Blocks, IdCard, KeyRound, Pencil, Power, PowerOff, ShieldCheck, Trash2, Unplug, UserCheck, UserCog, UserPlus, UserX } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { CompanyBillingSection } from '../../components/billing/CompanyBillingSection';
import { LoadFailed } from '../../components/ui/PageStates';
import { deleteNote } from '../../components/trash/TrashParts';
import { StatusBadge } from '../../components/StatusBadge';
import { Avatar } from '../../components/ui/Avatar';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { PagedItems } from '../../components/ui/PagedItems';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList, type PagedList } from '../../hooks/usePagedList';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { adminService } from '../../services/adminService';
import type { CompanyAdmin, CompanyDetail } from '../../types';
import type { ConfirmInput, ConfirmSource } from '../../types/confirm';
import type { CatalogApi } from '../../utils/catalogs';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatCount } from '../../utils/numbers';
import { CompanyDocumentsSection } from './CompanyDocumentsSection';
import { CompanyPlanUsage } from './CompanyPlanUsage';
import { CompanyDataSection, companyFacts, DeletedCompany, taxIdLine } from './CompanyRecord';

/** Qué se está procesando: el estado, el acceso a la API o los documentos del onboarding, eliminarla o un administrador (su id). */
type Busy = 'status' | 'api' | 'documents' | 'delete' | number;
/** Estado de la empresa (femenino: "Activa" / "Inactiva"). */
const companyState = (active: boolean) => t(active ? 'admin.shared.active' : 'admin.shared.inactive');
const adminState = (active: boolean) => t(active ? 'common.states.active' : 'common.states.inactive');
const apiAccess = (enabled: boolean) => t(enabled ? 'admin.detail.api.withAccess' : 'admin.detail.api.withoutAccess');

/** Activar o desactivar la empresa: qué pasa con su personal y el estado "antes → después". */
function statusConfirm(company: CompanyDetail): ConfirmInput {
  const state = { label: t('common.fields.status'), before: companyState(company.active), after: companyState(!company.active) };
  const staff = [
    { label: t('admin.shared.admins'), value: formatCount(company.admin_count) },
    { label: t('admin.shared.employees'), value: formatCount(company.employee_count) },
  ];
  return company.active
    ? {
        tone: 'danger',
        icon: <PowerOff size={30} />,
        eyebrow: t('common.actions.changeStatus'),
        title: t('admin.detail.status.deactivateTitle', { name: company.name }),
        message: t('admin.detail.status.deactivateMessage'),
        changes: [state],
        detailsTitle: t('admin.detail.status.affected'),
        details: staff,
        note: t('admin.detail.status.deactivateNote'),
        confirmLabel: t('admin.detail.status.deactivateLabel'),
        confirmIcon: <PowerOff size={18} />,
      }
    : {
        tone: 'success',
        icon: <Power size={30} />,
        eyebrow: t('common.actions.changeStatus'),
        title: t('admin.detail.status.activateTitle', { name: company.name }),
        message: t('admin.detail.status.activateMessage'),
        changes: [state],
        detailsTitle: t('admin.detail.status.recovers'),
        details: staff,
        confirmLabel: t('admin.detail.status.activateLabel'),
        confirmIcon: <Power size={18} />,
      };
}

/** Dar o quitar Integraciones (API): qué ve la empresa y qué pasa con sus llaves. */
function apiConfirm(company: CompanyDetail, enabled: boolean): ConfirmInput {
  const access = { label: t('admin.shared.api'), before: apiAccess(!enabled), after: apiAccess(enabled) };
  return enabled
    ? {
        tone: 'success',
        icon: <KeyRound size={30} />,
        eyebrow: t('admin.shared.modules'),
        title: t('admin.detail.api.giveTitle', { name: company.name }),
        message: t('admin.detail.api.giveMessage'),
        changes: [access],
        note: t('admin.detail.api.giveNote'),
        confirmLabel: t('admin.detail.api.giveLabel'),
        confirmIcon: <KeyRound size={18} />,
      }
    : {
        tone: 'danger',
        icon: <Unplug size={30} />,
        eyebrow: t('admin.shared.modules'),
        title: t('admin.detail.api.removeTitle', { name: company.name }),
        message: t('admin.detail.api.removeMessage'),
        changes: [access],
        note: t('admin.detail.api.removeNote'),
        confirmLabel: t('admin.detail.api.removeLabel'),
        confirmIcon: <Unplug size={18} />,
      };
}

/**
 * Eliminar (solo sin empleados): va a «Eliminadas» (se restaura durante 1 año), pero las fotos de sus cuentas se
 * borran para siempre; por eso se escribe su nombre para habilitarlo.
 */
function deleteConfirm(company: CompanyDetail, catalogs: CatalogApi): ConfirmInput {
  return {
    kind: 'delete',
    title: t('admin.detail.remove.title', { name: company.name }),
    message: t('admin.detail.remove.message'),
    detailsTitle: t('admin.detail.remove.detailsTitle'),
    details: companyFacts(company, catalogs),
    note: deleteNote({ person: true, trash: t('admin.trash.note') }),
    confirmText: company.name,
    confirmLabel: t('admin.detail.remove.confirmLabel'),
  };
}

/** Activar o desactivar a un administrador de la empresa: su acceso, "antes → después". */
function adminConfirm(admin: CompanyAdmin, company: CompanyDetail): ConfirmInput {
  const state = { label: t('common.fields.status'), before: adminState(admin.active), after: adminState(!admin.active) };
  return admin.active
    ? {
        tone: 'danger',
        icon: <UserX size={30} />,
        eyebrow: t('admin.detail.admin.eyebrow'),
        title: t('admin.detail.admin.deactivateTitle', { email: admin.email }),
        message: t('admin.detail.admin.deactivateMessage', { company: company.name }),
        changes: [state],
        note: t('admin.detail.admin.deactivateNote'),
        confirmLabel: t('admin.detail.admin.deactivateLabel'),
        confirmIcon: <UserX size={18} />,
      }
    : {
        tone: 'success',
        icon: <UserCheck size={30} />,
        eyebrow: t('admin.detail.admin.eyebrow'),
        title: t('admin.detail.admin.activateTitle', { email: admin.email }),
        message: t('admin.detail.admin.activateMessage', { company: company.name }),
        changes: [state],
        confirmLabel: t('admin.detail.admin.activateLabel'),
        confirmIcon: <UserCheck size={18} />,
      };
}

/*
 * Títulos y avisos de las acciones: se traducen al dibujarse (un popup abierto sigue al idioma
 * activo). Cada aviso de éxito es la función que da [título, detalle].
 */
const loadError = () => t('admin.shared.loadCompanyError');
const adminsError = () => t('admin.detail.adminsError');
const actionError = () => t('admin.detail.actionError');
/**
 * Códigos con los que el backend impide eliminar una empresa porque sigue en uso: tiene cobranza (cargos, pagos o
 * saldo) o empleados. El popup sugiere desactivarla en su lugar (el motivo exacto lo da el mensaje del servidor);
 * cualquier otra falla usa el título genérico.
 */
const COMPANY_IN_USE_CODES: ReadonlySet<string> = new Set(['COMPANY_HAS_BILLING', 'COMPANY_HAS_EMPLOYEES']);
const deleteError = (error: unknown) => (error instanceof ApiError && COMPANY_IN_USE_CODES.has(error.code) ? t('admin.detail.remove.inUse') : t('admin.detail.deleteError'));
const statusNotice = (wasActive: boolean) => (): SuccessNotice =>
  wasActive
    ? [t('admin.detail.done.deactivated'), t('admin.detail.done.deactivatedText')]
    : [t('admin.detail.done.activated'), t('admin.detail.done.activatedText')];
const apiNotice = (enabled: boolean) => (): SuccessNotice =>
  enabled ? [t('admin.detail.done.apiOn'), t('admin.detail.done.apiOnText')] : [t('admin.detail.done.apiOff'), t('admin.detail.done.apiOffText')];
const documentsNotice = (required: boolean) => (): SuccessNotice =>
  required
    ? [t('employeeDocuments.admin.onNotice'), t('employeeDocuments.admin.onText')]
    : [t('employeeDocuments.admin.offNotice'), t('employeeDocuments.admin.offText')];

/** Pedir o dejar de pedir documentos de identidad en el onboarding (módulo que concede el ADMIN; decisión 2026-10-07). */
function documentsConfirm(company: CompanyDetail, required: boolean): ConfirmInput {
  return {
    kind: 'edit',
    tone: required ? 'success' : 'danger',
    icon: <IdCard size={30} />,
    eyebrow: t('admin.shared.modules'),
    title: t(required ? 'employeeDocuments.admin.giveTitle' : 'employeeDocuments.admin.removeTitle', { name: company.name }),
    message: t(required ? 'employeeDocuments.admin.giveMessage' : 'employeeDocuments.admin.removeMessage'),
  };
}
const adminNotice = (wasActive: boolean) => (): SuccessNotice => [t(wasActive ? 'admin.detail.done.adminDeactivated' : 'admin.detail.done.adminActivated')];
const deletedNotice = (name: string) => (): SuccessNotice => [t('admin.detail.done.deleted'), t('admin.detail.done.deletedText', { name })];

interface CompanyActionsProps {
  company: CompanyDetail;
  busy: Busy | null;
  onToggle: () => void;
  onDelete: () => void;
}

/** Editar, activar o desactivar y eliminar (solo sin empleados: con empleados, se desactiva). */
function CompanyActions({ company, busy, onToggle, onDelete }: CompanyActionsProps) {
  const t = useT();
  const removable = company.employee_count === 0;
  return (
    <>
      <ButtonLink to={paths.admin.editCompany(company.id)} variant="secondary" icon={<Pencil size={18} />}>
        {t('common.actions.edit')}
      </ButtonLink>
      <Button
        variant={company.active ? 'danger-outline' : 'success'}
        icon={company.active ? <PowerOff size={18} /> : <Power size={18} />}
        loading={busy === 'status'}
        disabled={busy !== null}
        onClick={onToggle}
      >
        {t(company.active ? 'common.actions.deactivate' : 'common.actions.activate')}
      </Button>
      <Button
        variant="danger-outline"
        icon={<Trash2 size={18} />}
        loading={busy === 'delete'}
        disabled={!removable || busy !== null}
        title={removable ? undefined : t('admin.detail.hasEmployees')}
        onClick={onDelete}
      >
        {t('common.actions.delete')}
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
  const t = useT();
  return (
    <PagedItems
      list={list}
      skeletonRows={2}
      empty={{ compact: true, icon: <UserCog />, title: t('admin.detail.admins.emptyTitle'), description: t('admin.detail.admins.emptyDescription') }}
      pager={{ variant: 'compact', siblings: 0, noun: { one: t('admin.detail.admins.noun.one'), other: t('admin.detail.admins.noun.other') } }}
    >
      {(admins) => (
        <ul className={`company-admins ${list.loading ? 'is-loading' : ''}`}>
          {admins.map((admin) => (
            <li key={admin.id}>
              <Avatar name={admin.email} src={admin.avatar} decorative />
              <span className="company-admins__info">
                <strong className="truncate">{admin.email}</strong>
                <small className="muted">
                  {admin.last_login_at ? t('admin.detail.admins.lastLogin', { date: formatDateTime(admin.last_login_at) }) : t('admin.detail.admins.neverLogged')}
                </small>
              </span>
              <StatusBadge active={admin.active} />
              <ButtonLink to={paths.admin.companyAdminPassword(companyId, admin.id)} size="sm" variant="ghost" icon={<KeyRound size={16} />}>
                {t('admin.detail.admins.resetPassword')}
              </ButtonLink>
              <Button size="sm" variant={admin.active ? 'ghost' : 'secondary'} loading={busy === admin.id} disabled={busy !== null} onClick={() => onToggle(admin)}>
                {t(admin.active ? 'common.actions.deactivate' : 'common.actions.activate')}
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
  const t = useT();
  return (
    <Switch
      checked={enabled}
      onChange={onChange}
      icon={<KeyRound size={20} />}
      label={t('admin.shared.api')}
      description={t(enabled ? 'admin.detail.apiOn' : 'admin.detail.apiOff')}
      disabled={busy}
      busy={saving}
    />
  );
}

/** Documentos de identidad en el onboarding (módulo que decide el ADMIN; decisión del dueño, 2026-10-07). */
function DocumentsAccess({ required, busy, saving, onChange }: { required: boolean; busy: boolean; saving: boolean; onChange: (required: boolean) => void }) {
  const t = useT();
  return (
    <Switch
      checked={required}
      onChange={onChange}
      icon={<IdCard size={20} />}
      label={t('employeeDocuments.admin.label')}
      description={t(required ? 'employeeDocuments.admin.on' : 'employeeDocuments.admin.off')}
      disabled={busy}
      busy={saving}
    />
  );
}

/**
 * Detalle de una empresa: datos, uso del plan, cobranza, módulos, administradores y estado. En «Eliminadas» solo
 * sus datos y «Restaurar»: sus administradores, su cobranza y su política ya no existen para el backend (404).
 */
export function CompanyDetailPage() {
  const t = useT();
  const companyId = Number(useParams().id);
  const { data: company, setData, error, retry } = useResource((signal) => adminService.get(companyId, signal), companyId, loadError);
  if (!company) {
    return error ? <LoadFailed title={t('common.fields.company')} backTo={paths.admin.companies} backLabel={t('admin.shared.companies')} onRetry={retry} /> : <SkeletonCard lines={6} />;
  }
  if (company.deleted_at) return <DeletedCompany company={company} onRestored={setData} />;
  return <CompanyView company={company} setCompany={setData} />;
}

/** La ficha de una empresa vigente con sus acciones (cada cambio se confirma antes). */
function CompanyView({ company, setCompany }: { company: CompanyDetail; setCompany: (company: CompanyDetail) => void }) {
  const t = useT();
  const catalogs = useCatalogs();
  const navigate = useNavigate();
  const admins = usePagedList((page, signal) => adminService.admins(company.id, page, signal), {
    errorTitle: adminsError,
    filterKey: String(company.id),
  });
  // Qué se procesa (cada botón muestra su propio "ocupado"; los demás esperan). Cada cambio se
  // confirma antes: cancelar no envía nada y la pantalla queda como estaba.
  const action = useAction<Busy>();
  const busy = action.busy !== null;

  /**
   * Cambio confirmado que devuelve la empresa actualizada (su estado, sus módulos o un administrador).
   * La confirmación y el aviso son funciones: se arman al dibujarse y siguen al idioma activo.
   */
  const change = (task: () => Promise<CompanyDetail>, what: Busy, confirm: ConfirmSource, success: () => SuccessNotice, onSettled?: () => void) =>
    void action.run(task, { busy: what, confirm, errorTitle: actionError, success, onSuccess: setCompany, onSettled });

  const toggleCompany = () =>
    change(
      () => adminService.setStatus(company.id, !company.active),
      'status',
      () => statusConfirm(company),
      statusNotice(company.active),
    );
  const setApiAccess = (enabled: boolean) =>
    change(
      () => adminService.setApiAccess(company.id, enabled),
      'api',
      () => apiConfirm(company, enabled),
      apiNotice(enabled),
    );
  const setDocumentsRequired = (required: boolean) =>
    change(
      () => adminService.setDocumentsRequired(company.id, required),
      'documents',
      () => documentsConfirm(company, required),
      documentsNotice(required),
    );
  // Al terminar (bien o mal) se vuelve a pedir la página de administradores: el backend decide su estado.
  const toggleAdmin = (admin: CompanyAdmin) =>
    change(
      () => adminService.setAdminStatus(company.id, admin.id, !admin.active),
      admin.id,
      () => adminConfirm(admin, company),
      adminNotice(admin.active),
      admins.retry,
    );
  const remove = () =>
    void action.run(() => adminService.remove(company.id), {
      busy: 'delete',
      confirm: () => deleteConfirm(company, catalogs),
      errorTitle: deleteError,
      success: deletedNotice(company.name),
      onSuccess: () => void navigate(paths.admin.companies, { replace: true }),
      keepBusy: true,
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={company.name}
          backTo={paths.admin.companies}
          backLabel={t('admin.shared.companies')}
          subtitle={
            <>
              <StatusBadge active={company.active} /> {t('admin.detail.since', { taxId: taxIdLine(company, catalogs), date: formatDate(company.created_at) })}
            </>
          }
          actions={
            <CompanyActions company={company} busy={action.busy} onToggle={toggleCompany} onDelete={remove} />
          }
        />

        <PanelGrid>
          <CompanyDataSection company={company} />
          <CompanyPlanUsage company={company} />
        </PanelGrid>

        <CompanyBillingSection companyId={company.id} />
        <CompanyDocumentsSection companyId={company.id} />

        <PanelSection
          title={t('admin.detail.modulesSection')}
          icon={<Blocks size={20} />}
          aside={
            <ButtonLink to={paths.admin.companyPolicy(company.id)} size="sm" variant="secondary" icon={<ShieldCheck size={16} />}>
              {t('admin.detail.policy')}
            </ButtonLink>
          }
        >
          <ApiAccess enabled={company.api_enabled} busy={busy} saving={action.busy === 'api'} onChange={setApiAccess} />
          <DocumentsAccess required={company.require_employee_documents} busy={busy} saving={action.busy === 'documents'} onChange={setDocumentsRequired} />
        </PanelSection>

        <PanelSection
          title={t('admin.shared.admins')}
          icon={<UserCog size={20} />}
          aside={
            <ButtonLink to={paths.admin.newCompanyAdmin(company.id)} size="sm" variant="primary" icon={<UserPlus size={16} />}>
              {t('admin.detail.addAdmin')}
            </ButtonLink>
          }
        >
          <CompanyAdmins list={admins} companyId={company.id} busy={action.busy} onToggle={toggleAdmin} />
        </PanelSection>
      </Panel>
    </div>
  );
}
