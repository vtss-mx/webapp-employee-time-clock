import { ArrowRight, ClipboardCheck, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { ButtonLink } from '../../components/ui/Button';
import { KpiCard, KpiValue, type Kpi } from '../../components/ui/KpiCard';
import { usePendingEnrollmentsCount } from '../../hooks/usePendingEnrollments';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import { t, useT } from '../../i18n';
import { businessHour } from '../../utils/format';

function greeting() {
  const h = businessHour();
  return t(h < 12 ? 'companyHome.greeting.morning' : h < 19 ? 'companyHome.greeting.afternoon' : 'companyHome.greeting.evening');
}

const loadError = () => t('companyHome.loadError');

export function DashboardPage() {
  const t = useT();
  const { data: stats, error, retry } = useResource(
    (signal) =>
      Promise.all([employeeService.list({ size: 1 }, signal), employeeService.list({ size: 1, active: true }, signal)]).then(([all, active]) => ({
        total: all.total,
        active: active.total,
        inactive: all.total - active.total,
      })),
    'summary',
    loadError,
  );
  // La cola de validaciones la consulta una sola vez el layout (el mismo valor que el contador del menú).
  const pending = usePendingEnrollmentsCount();

  const kpis: Kpi[] = [
    { key: 'total', label: t('companyHome.kpis.total'), icon: Users, value: stats?.total, tile: '' },
    { key: 'active', label: t('companyHome.kpis.active'), icon: UserCheck, value: stats?.active, tile: 'icon-tile--success' },
    { key: 'inactive', label: t('companyHome.kpis.inactive'), icon: UserMinus, value: stats?.inactive, tile: 'icon-tile--warning' },
  ];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={greeting()}
          subtitle={t('companyHome.subtitle')}
          actions={
            <ButtonLink to={paths.company.newEmployee} variant="primary" icon={<UserPlus size={18} />}>
              {t('companyHome.registerEmployee')}
            </ButtonLink>
          }
        />
        <PanelSection>
          {Boolean(error) && !stats && <RetryState onRetry={retry} />}

          {pending ? (
            <div className="callout">
              <span className="icon-tile icon-tile--warning">
                <ClipboardCheck size={22} />
              </span>
              <div className="callout__body">
                <strong>{t('companyHome.pending.title', { count: pending })}</strong>
                <p className="muted small">{t('companyHome.pending.text')}</p>
              </div>
              <ButtonLink to={paths.company.validations} variant="primary" iconRight={<ArrowRight size={18} />}>
                {t('companyHome.pending.review')}
              </ButtonLink>
            </div>
          ) : null}

          <div className="kpis stagger">
            <Link to={paths.company.validations} className={`kpi ${pending ? 'kpi--accent' : ''}`}>
              <span className="icon-tile">
                <ClipboardCheck size={22} />
              </span>
              <span>
                <span className="kpi__label">{t('companyHome.kpis.pending')}</span>
                <KpiValue value={pending} />
              </span>
            </Link>
            {kpis.map(({ key, ...kpi }) => (
              <KpiCard key={key} {...kpi} />
            ))}
          </div>

          <div className="action-grid stagger">
            <Link to={paths.company.employees} className="action-card">
              <span className="icon-tile">
                <Users size={22} />
              </span>
              <span className="action-card__title">
                {t('companyHome.cards.employees.title')} <ArrowRight size={18} />
              </span>
              <span className="muted">{t('companyHome.cards.employees.text')}</span>
            </Link>
            <Link to={paths.company.newEmployee} className="action-card">
              <span className="icon-tile">
                <UserPlus size={22} />
              </span>
              <span className="action-card__title">
                {t('companyHome.cards.newEmployee.title')} <ArrowRight size={18} />
              </span>
              <span className="muted">{t('companyHome.cards.newEmployee.text')}</span>
            </Link>
            <Link to={paths.company.validations} className="action-card">
              <span className="icon-tile">
                <ClipboardCheck size={22} />
              </span>
              <span className="action-card__title">
                {t('companyHome.cards.validations.title')} <ArrowRight size={18} />
              </span>
              <span className="muted">{t('companyHome.cards.validations.text')}</span>
            </Link>
          </div>
        </PanelSection>
      </Panel>
    </div>
  );
}
