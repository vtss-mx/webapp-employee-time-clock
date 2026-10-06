import { ArrowRight, Building2, Building, CheckCircle2, Plus, UserCog, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { KpiCard, type Kpi } from '../../components/ui/KpiCard';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { config } from '../../utils/config';
import { adminService } from '../../services/adminService';
import { formatDate } from '../../utils/format';

/** Título del popup si el panel no carga (se traduce al dibujarse: sigue al idioma activo). */
const loadError = () => t('admin.dashboard.loadError');

/** Panel del administrador de la plataforma: indicadores y empresas recientes. */
export function AdminDashboardPage() {
  const t = useT();
  const { data, error, retry } = useResource(
    (signal) => Promise.all([adminService.stats(signal), adminService.list({ size: 5 }, signal)]),
    'platform',
    loadError,
  );
  const stats = data?.[0];
  const recent = data?.[1].items;

  const kpis: Kpi[] = [
    { key: 'companies', label: t('admin.shared.companies'), icon: Building2, value: stats?.companies, tile: '' },
    { key: 'active', label: t('admin.dashboard.activeCompanies'), icon: CheckCircle2, value: stats?.active_companies, tile: 'icon-tile--success' },
    { key: 'employees', label: t('admin.shared.employees'), icon: Users, value: stats?.employees, tile: '' },
    { key: 'admins', label: t('admin.shared.admins'), icon: UserCog, value: stats?.company_admins, tile: 'icon-tile--warning' },
  ];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('admin.dashboard.title')}
          subtitle={t('admin.dashboard.subtitle', { app: config.appName })}
          actions={
            <ButtonLink to={paths.admin.newCompany} variant="primary" icon={<Plus size={18} />}>
              {t('admin.shared.registerCompany')}
            </ButtonLink>
          }
        />
        <PanelSection>
          {Boolean(error) && !stats && <RetryState onRetry={retry} />}
          <div className="kpis stagger">
            {kpis.map(({ key, ...kpi }) => (
              <KpiCard key={key} {...kpi} />
            ))}
          </div>
        </PanelSection>

        <PanelSection
          title={t('admin.shared.companies')}
          icon={<Building size={20} />}
          aside={
            <Link to={paths.admin.companies} className="btn btn--link btn--sm">
              {t('admin.dashboard.viewAll')} <ArrowRight size={16} />
            </Link>
          }
        >
          {!recent && !error && <SkeletonRows rows={3} />}
          {recent && recent.length === 0 && (
            <EmptyState
              compact
              icon={<Building2 />}
              title={t('admin.dashboard.emptyTitle')}
              description={t('admin.dashboard.emptyDescription')}
            />
          )}
          {recent && recent.length > 0 && (
            <ul className="company-list">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link to={paths.admin.company(c.id)} className="company-row">
                    <span className="company-row__logo">{c.name.slice(0, 2).toUpperCase()}</span>
                    <span className="company-row__info">
                      <strong className="truncate">{c.name}</strong>
                      <small className="muted">{t('admin.dashboard.companyMeta', { count: c.employee_count, date: formatDate(c.created_at) })}</small>
                    </span>
                    <StatusBadge active={c.active} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PanelSection>
      </Panel>
    </div>
  );
}
