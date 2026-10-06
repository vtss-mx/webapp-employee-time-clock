import { Coins, Receipt, Route, Users } from 'lucide-react';
import { useId } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { CostFigures, RoutesTab, TopRoutes, UsersTab } from '../../../components/usage/CompanyUsageParts';
import { DailySection, StorageSection, UsageSummary } from '../../../components/usage/UsageParts';
import { ButtonLink } from '../../../components/ui/Button';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { TabPanel, Tabs, type TabItem } from '../../../components/ui/Tabs';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useHasScreen } from '../../../hooks/useHasScreen';
import { useResource } from '../../../hooks/useResource';
import { useUsagePeriod } from '../../../hooks/useUsagePeriod';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { usageService } from '../../../services/usageService';
import { periodText } from '../../../utils/billing';

type UsageTab = 'users' | 'routes';

/** Pestañas del detalle (sus nombres se piden al dibujar: siguen al idioma activo). */
function usageTabs(): Array<TabItem<UsageTab>> {
  return [
    { key: 'users', label: t('usage.tabs.users'), icon: <Users size={16} /> },
    { key: 'routes', label: t('usage.tabs.routes'), icon: <Route size={16} /> },
  ];
}

const usageError = () => t('usage.company.loadError');

/**
 * Consumo de una empresa (ADMIN) en el rango elegido (`?start=&end=`): sus totales, día por día, las
 * rutas que más usa, su almacenamiento, su costo frente a su consumo (estimado) y, en pestañas
 * (`?tab=`), el consumo de cada usuario y de cada ruta. Se actualiza sola mientras se ve.
 */
export function CompanyUsagePage() {
  const t = useT();
  const companyId = Number(useParams().id);
  const idBase = useId();
  const [params, setParams] = useSearchParams();
  const tab: UsageTab = params.get('tab') === 'routes' ? 'routes' : 'users';
  const period = useUsagePeriod();
  const { range } = period;
  const canBill = useHasScreen('ADMIN_BILLING');
  const usage = useResource((signal) => usageService.company(companyId, range, signal), `${companyId}|${range.start}|${range.end}`, usageError);
  useAutoRefresh(usage.retry);
  const data = usage.data;
  // Volver al consumo general con el mismo rango (la pestaña es solo de esta pantalla).
  const back = new URLSearchParams(params);
  back.delete('tab');
  const backQuery = back.toString();
  const backTo = backQuery ? `${paths.admin.usage}?${backQuery}` : paths.admin.usage;

  const pickTab = (next: UsageTab) =>
    setParams(
      (current) => {
        const query = new URLSearchParams(current);
        if (next === 'users') query.delete('tab');
        else query.set('tab', next);
        return query;
      },
      { replace: true },
    );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={data?.name ?? t('usage.company.title')}
          backTo={backTo}
          backLabel={t('usage.title')}
          subtitle={
            data ? (
              <>
                <CatalogStatusBadge catalog="billing_statuses" code={data.status} /> {periodText(data.start, data.end)}
              </>
            ) : (
              t('common.states.loading')
            )
          }
          actions={
            canBill && (
              <ButtonLink to={paths.admin.companyBilling(companyId)} variant="secondary" icon={<Receipt size={18} />}>
                {t('billing.title')}
              </ButtonLink>
            )
          }
        />
        <UsageSummary period={period} data={data} error={usage.error} retry={usage.retry} />
        <DailySection data={data} />
        <PanelGrid>
          <PanelSection title={t('usage.routes.top')} icon={<Route size={20} />}>
            {data ? <TopRoutes usage={data} /> : <SkeletonCard lines={4} />}
          </PanelSection>
          <StorageSection data={data} />
        </PanelGrid>
        <PanelSection title={t('usage.cost.title')} icon={<Coins size={20} />}>
          {data ? <CostFigures usage={data} /> : <SkeletonCard lines={3} />}
        </PanelSection>
        <PanelSection>
          <Tabs items={usageTabs()} value={tab} onChange={pickTab} label={t('usage.tabs.label')} idBase={idBase} />
          <TabPanel idBase={idBase} tab={tab}>
            {tab === 'users' ? <UsersTab companyId={companyId} range={range} /> : <RoutesTab companyId={companyId} range={range} />}
          </TabPanel>
        </PanelSection>
      </Panel>
    </div>
  );
}
