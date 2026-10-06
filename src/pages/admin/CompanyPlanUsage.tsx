import { Gauge, Users } from 'lucide-react';
import { ButtonLink } from '../../components/ui/Button';
import { PanelSection } from '../../components/ui/Panel';
import { useT } from '../../i18n';
import { paths } from '../../routes/paths';
import type { CompanyDetail } from '../../types';
import { formatCount } from '../../utils/numbers';

/** Porcentaje usado de un límite (tope 100); null sin límite. */
const usageOf = (used: number, limit: number | null) => (limit ? Math.min(100, Math.round((used / limit) * 100)) : null);

/** Barra del uso de un límite (en rojo desde el 90 %). */
function UsageBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div className={`usage__bar ${percent >= 90 ? 'is-high' : ''}`} role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * "Uso del plan" en la ficha de la empresa (consola del ADMIN): sus empleados frente a su límite y sus validadores
 * activos frente al límite que les dio el ADMIN (0 = sin el módulo; cada validador activo se cobra como un empleado),
 * más sus administradores y su estado.
 */
export function CompanyPlanUsage({ company }: { company: CompanyDetail }) {
  const t = useT();
  const employees = usageOf(company.employee_count, company.max_employees);
  const validators = usageOf(company.active_validators, company.max_validators);
  return (
    <PanelSection
      title={t('admin.detail.usage')}
      icon={<Gauge size={20} />}
      aside={
        <ButtonLink to={paths.admin.companyEmployees(company.id)} size="sm" variant="ghost" icon={<Users size={16} />}>
          {t('admin.detail.viewEmployees')}
        </ButtonLink>
      }
    >
      <div className="usage">
        <div className="usage__numbers">
          <strong>{formatCount(company.employee_count)}</strong>
          <span className="muted">
            {company.max_employees ? t('admin.detail.usageOf', { count: company.max_employees }) : t('admin.detail.usageNoLimit', { count: company.employee_count })}
          </span>
        </div>
        {employees !== null && <UsageBar percent={employees} label={t('admin.detail.usageMeter')} />}
        <dl className="details">
          <div>
            <dt>{t('admin.detail.validators')}</dt>
            <dd>
              {validators === null ? (
                <span className="muted">{t('admin.detail.validatorsOff')}</span>
              ) : (
                <>
                  {t('admin.detail.validatorsOf', { active: formatCount(company.active_validators), count: company.max_validators })}
                  <small className="muted"> · {t('admin.detail.validatorsBilled')}</small>
                </>
              )}
            </dd>
          </div>
        </dl>
        {validators !== null && <UsageBar percent={validators} label={t('admin.detail.validatorsMeter')} />}
        <dl className="details">
          <div>
            <dt>{t('admin.shared.admins')}</dt>
            <dd>{formatCount(company.admin_count)}</dd>
          </div>
          <div>
            <dt>{t('common.fields.status')}</dt>
            <dd>{t(company.active ? 'admin.detail.operating' : 'admin.detail.deactivated')}</dd>
          </div>
        </dl>
      </div>
    </PanelSection>
  );
}
