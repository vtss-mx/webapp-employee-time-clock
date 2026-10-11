import { History, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VerificationBreakdown, VerificationKpis, VerificationOutcome, VerificationPerson, VerificationWhere } from '../../../components/verifications/VerificationParts';
import { EMPTY_CHOICE, VerificationToolbar, choiceKey, filtersOf, isFiltered, type VerificationChoice } from '../../../components/verifications/VerificationToolbar';
import { Button } from '../../../components/ui/Button';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { usePagedList } from '../../../hooks/usePagedList';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { adminVerificationsService } from '../../../services/verificationsService';
import type { VerificationHistoryRow } from '../../../types';
import { formatDateTime, timeAgo } from '../../../utils/format';
import { totalText } from '../../../utils/audit';

const COLUMNS = ['company', 'person', 'when', 'result', 'method', 'place'] as const;
const loadError = () => t('verification.admin.loadError');
const summaryError = () => t('verification.summary.loadError');

/** La empresa que llega en la URL (`?company_id=`), para abrir el historial de una empresa desde otra pantalla. */
function companyOf(params: URLSearchParams): number | undefined {
  const value = Number(params.get('company_id'));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

/**
 * Historial de verificaciones de TODAS las empresas (pantalla `ADMIN_VERIFICATIONS`, migración 0106 del backend):
 * el listado con sus filtros, el resumen del periodo y, al abrir una fila, su detalle técnico.
 *
 * Todo lo decide el servidor: el periodo por omisión, el tope del conteo, los niveles de riesgo que se pueden
 * filtrar y los nombres de cada catálogo (reglas 1 y 25). **Nunca llegan datos biométricos** (regla 13): los
 * fotogramas de un intento solo existen como evidencia de un caso de fraude, en su propia pantalla.
 */
export function AdminVerificationsPage() {
  const t = useT();
  const { nameOf } = useCatalogs();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [choice, setChoice] = useState<VerificationChoice>(EMPTY_CHOICE);
  const company = companyOf(params);
  const filters = useMemo(() => ({ ...filtersOf(choice), company_id: company }), [choice, company]);
  const filterKey = `${choiceKey(choice)}|${company ?? ''}`;

  const list = usePagedList<VerificationHistoryRow, { since: string; until: string; count_cap: number }>(
    (page, signal) => adminVerificationsService.list({ ...page, ...filters }, signal),
    { errorTitle: loadError, filterKey },
  );
  const summary = useResource((signal) => adminVerificationsService.summary(filters, signal), filterKey, summaryError);
  const data = summary.data;
  const filtered = isFiltered(choice) || company !== undefined;

  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('verification.admin.title')} subtitle={t('verification.admin.subtitle')} />
        <PanelSection>
          {Boolean(summary.error) && !data && <RetryState onRetry={summary.retry} />}
          <VerificationKpis summary={data} />
          {data && <VerificationBreakdown summary={data} />}
          {data && <p className="muted small">{t('verification.admin.window', { count: data.window_days })}</p>}
          {company !== undefined && (
            <p className="inline-note small">
              {t('verification.admin.companyFilter', { company: list.data?.items[0]?.company_name ?? String(company) })}{' '}
              <Button variant="ghost" size="sm" onClick={() => setParams({})}>
                {t('verification.admin.clearCompany')}
              </Button>
            </p>
          )}
        </PanelSection>
        <PanelSection>
          <VerificationToolbar choice={choice} onChange={setChoice} summary={data} />
          <p className="muted small">{t('verification.admin.total', { value: totalText(list.total, list.data?.count_cap) })}</p>
          <ListResults
            list={list}
            columns={COLUMNS.map((column) => t(`verification.admin.columns.${column}`))}
            onOpen={(row) => void navigate(paths.admin.verification(row.id))}
            pager={{ noun: { one: t('verification.company.noun.one'), other: t('verification.company.noun.other') } }}
            empty={
              filtered
                ? { icon: <SearchX />, title: t('verification.company.noMatch.title'), description: t('verification.company.noMatch.description') }
                : { icon: <History />, title: t('verification.admin.empty.title'), description: t('verification.admin.empty.description') }
            }
            renderCells={(row) => (
              <>
                <td className="table__primary">{row.company_name}</td>
                <td data-label={t('verification.admin.columns.person')}>
                  <VerificationPerson row={row} />
                </td>
                <td data-label={t('verification.admin.columns.when')} title={formatDateTime(row.created_at)}>
                  {timeAgo(row.created_at)}
                </td>
                <td data-label={t('verification.admin.columns.result')}>
                  <VerificationOutcome success={row.success} reason={row.reason} />
                </td>
                <td data-label={t('verification.admin.columns.method')}>{nameOf('verification_methods', row.method)}</td>
                <td data-label={t('verification.admin.columns.place')}>
                  <VerificationWhere latitude={row.latitude} accuracy={row.location_accuracy_m} />
                </td>
              </>
            )}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
