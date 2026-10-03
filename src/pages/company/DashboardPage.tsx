import { ArrowRight, ClipboardCheck, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useErrorPopup } from '../../hooks/useFeedback';
import { RetryState } from '../../components/ui/RetryState';
import { ButtonLink } from '../../components/ui/Button';
import { KpiCard, KpiValue, type Kpi } from '../../components/ui/KpiCard';
import { usePendingEnrollments } from '../../hooks/usePendingEnrollments';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import { businessHour } from '../../utils/format';

interface Stats {
  total: number;
  active: number;
  inactive: number;
}

function greeting() {
  const h = businessHour();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const retry = () => setReload((n) => n + 1);
  useErrorPopup(error, { title: 'No se pudo cargar el resumen', retry });
  const pending = usePendingEnrollments(true);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    Promise.all([employeeService.list({ size: 1 }, controller.signal), employeeService.list({ size: 1, active: true }, controller.signal)])
      .then(([all, active]) => setStats({ total: all.total, active: active.total, inactive: all.total - active.total }))
      .catch((e) => !controller.signal.aborted && setError(e));
    return () => controller.abort();
  }, [reload]);

  const kpis: Kpi[] = [
    { key: 'total', label: 'Empleados registrados', icon: Users, value: stats?.total, tile: '' },
    { key: 'active', label: 'Activos', icon: UserCheck, value: stats?.active, tile: 'icon-tile--success' },
    { key: 'inactive', label: 'Inactivos', icon: UserMinus, value: stats?.inactive, tile: 'icon-tile--warning' },
  ];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={greeting()}
          subtitle="Este es el resumen de tu organización."
          actions={
            <ButtonLink to={paths.company.newEmployee} variant="primary" icon={<UserPlus size={18} />}>
              Registrar empleado
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
                <strong>
                  {pending} {pending === 1 ? 'registro facial espera' : 'registros faciales esperan'} tu validación
                </strong>
                <p className="muted small">Confirma la identidad para que los empleados puedan identificarse.</p>
              </div>
              <ButtonLink to={paths.company.validations} variant="primary" iconRight={<ArrowRight size={18} />}>
                Revisar ahora
              </ButtonLink>
            </div>
          ) : null}

          <div className="kpis stagger">
            <Link to={paths.company.validations} className={`kpi ${pending ? 'kpi--accent' : ''}`}>
              <span className="icon-tile">
                <ClipboardCheck size={22} />
              </span>
              <span>
                <span className="kpi__label">Validaciones pendientes</span>
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
                Empleados <ArrowRight size={18} />
              </span>
              <span className="muted">Consulta, edita, activa o desactiva empleados y administra sus códigos QR.</span>
            </Link>
            <Link to={paths.company.newEmployee} className="action-card">
              <span className="icon-tile">
                <UserPlus size={22} />
              </span>
              <span className="action-card__title">
                Registrar empleado <ArrowRight size={18} />
              </span>
              <span className="muted">Captura sus datos; el rostro se registra al iniciar sesión.</span>
            </Link>
            <Link to={paths.company.validations} className="action-card">
              <span className="icon-tile">
                <ClipboardCheck size={22} />
              </span>
              <span className="action-card__title">
                Validaciones <ArrowRight size={18} />
              </span>
              <span className="muted">Acepta o rechaza los registros faciales de tus empleados.</span>
            </Link>
          </div>
        </PanelSection>
      </Panel>
    </div>
  );
}
