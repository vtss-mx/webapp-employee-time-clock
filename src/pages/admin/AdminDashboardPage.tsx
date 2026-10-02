import { ArrowRight, Building2, Building, CheckCircle2, Plus, UserCog, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { ButtonLink } from '../../components/ui/Button';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { KpiCard, type Kpi } from '../../components/ui/KpiCard';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useErrorPopup } from '../../hooks/useFeedback';
import { paths } from '../../routes/paths';
import { config } from '../../utils/config';
import { adminService } from '../../services/adminService';
import type { Company, PlatformStats } from '../../types';
import { formatDate } from '../../utils/format';

/** Panel del administrador de la plataforma: indicadores y empresas recientes. */
export function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recent, setRecent] = useState<Company[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const retry = () => setReload((n) => n + 1);
  useErrorPopup(error, { title: 'No se pudo cargar el panel', retry });

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    Promise.all([adminService.stats(controller.signal), adminService.list({ size: 5 }, controller.signal)])
      .then(([s, list]) => {
        setStats(s);
        setRecent(list.items);
      })
      .catch((e: unknown) => !controller.signal.aborted && setError(e));
    return () => controller.abort();
  }, [reload]);

  const kpis: Kpi[] = [
    { key: 'companies', label: 'Empresas', icon: Building2, value: stats?.companies, tile: '' },
    { key: 'active', label: 'Empresas activas', icon: CheckCircle2, value: stats?.active_companies, tile: 'icon-tile--success' },
    { key: 'employees', label: 'Empleados', icon: Users, value: stats?.employees, tile: '' },
    { key: 'admins', label: 'Administradores', icon: UserCog, value: stats?.company_admins, tile: 'icon-tile--warning' },
  ];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Panel de la plataforma"
          subtitle={`Empresas que usan ${config.appName} y su actividad.`}
          actions={
            <ButtonLink to={paths.admin.newCompany} variant="primary" icon={<Plus size={18} />}>
              Registrar empresa
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
          title="Empresas"
          icon={<Building size={20} />}
          aside={
            <Link to={paths.admin.companies} className="btn btn--link btn--sm">
              Ver todas <ArrowRight size={16} />
            </Link>
          }
        >
          {!recent && !error && <SkeletonRows rows={3} />}
          {recent && recent.length === 0 && (
            <div className="empty">
              <span className="icon-tile icon-tile--lg">
                <Building2 size={30} />
              </span>
              <h2>Aún no hay empresas</h2>
            </div>
          )}
          {recent && recent.length > 0 && (
            <ul className="company-list">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link to={paths.admin.company(c.id)} className="company-row">
                    <span className="company-row__logo">{c.name.slice(0, 2).toUpperCase()}</span>
                    <span className="company-row__info">
                      <strong className="truncate">{c.name}</strong>
                      <small className="muted">
                        {c.employee_count} empleado(s) · desde {formatDate(c.created_at)}
                      </small>
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
