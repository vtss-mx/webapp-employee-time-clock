import { AlertTriangle, Download, ScrollText, SearchX, ShieldOff, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AuditCells } from '../../../components/audit/AuditParts';
import { AuditToolbar, EMPTY_CHOICE, type AuditChoice } from '../../../components/audit/AuditToolbar';
import { Button } from '../../../components/ui/Button';
import { KpiGrid, type Kpi } from '../../../components/ui/KpiCard';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { useAuditExport } from '../../../hooks/useAuditExport';
import { useResource } from '../../../hooks/useResource';
import { useSearchList } from '../../../hooks/useSearchList';
import { t, useT } from '../../../i18n';
import { auditService } from '../../../services/auditService';
import type { AuditEvent, AuditFilters, AuditSummary } from '../../../types/audit';
import { isFiltered, totalText } from '../../../utils/audit';
import { businessDayEnd, businessDayStart, businessToday, formatDateTime } from '../../../utils/format';

const COLUMNS = ['occurredAt', 'action', 'actor', 'entity', 'origin', 'outcome', 'details'] as const;
const loadError = () => t('audit.loadError');
const summaryError = () => t('audit.summaryError');

/** Lo elegido como filtros de la API: los días se vuelven el inicio y el fin del día EN LA ZONA DEL NEGOCIO. */
function filtersOf(choice: AuditChoice, search: string): AuditFilters {
  return {
    since: (choice.since && businessDayStart(choice.since)) || undefined,
    until: (choice.until && businessDayEnd(choice.until)) || undefined,
    action: choice.action || undefined,
    outcome: choice.outcome || undefined,
    search: search || undefined,
  };
}

/** Cuántos eventos del periodo terminaron con cada resultado (el resumen ya viene agrupado de la base). */
function countOf(summary: AuditSummary | null, outcome: string): number | undefined {
  return summary?.by_action.filter((row) => row.outcome === outcome).reduce((total, row) => total + row.total, 0);
}

/** Los indicadores del periodo: lo que un auditor mira primero (negados y fallidos solo se pintan si los hay). */
function auditKpis(summary: AuditSummary | null): Kpi[] {
  const denied = countOf(summary, 'DENIED');
  const failed = countOf(summary, 'FAILED');
  return [
    { key: 'total', label: t('audit.kpis.total'), icon: ScrollText, value: summary?.total, tile: '' },
    { key: 'denied', label: t('audit.kpis.denied'), icon: ShieldOff, value: denied, tile: denied ? 'icon-tile--warning' : '' },
    { key: 'failed', label: t('audit.kpis.failed'), icon: XCircle, value: failed, tile: failed ? 'icon-tile--danger' : '' },
    { key: 'pending', label: t('audit.kpis.pending'), icon: AlertTriangle, value: summary?.pending, tile: '' },
  ];
}

/**
 * Bitácora de auditoría (ADMIN, migración 0095 del backend): quién hizo qué, sobre qué y desde dónde, con los
 * accesos NEGADOS y las acciones que fallaron. No es la bandeja de errores y **no hay crear, editar ni borrar**:
 * es evidencia, así que la pantalla solo consulta y exporta.
 *
 * El periodo, la acción, el resultado y la búsqueda se envían al servidor (la lista se pagina allá); los nombres
 * de las acciones y de los resultados salen de sus catálogos. «Exportar» junta los tramos del periodo que se está
 * viendo y descarga un JSON (`useAuditExport`), tras confirmar.
 */
export function AuditPage() {
  const t = useT();
  const [choice, setChoice] = useState<AuditChoice>(EMPTY_CHOICE);
  const today = businessToday();
  const list = useSearchList<AuditEvent, { since: string; until: string; count_cap?: number }>(
    (query, signal) => auditService.list(filtersOf(choice, query.search ?? ''), { page: query.page, size: query.size }, signal),
    { errorTitle: loadError, filterKey: `${choice.since}|${choice.until}|${choice.action}|${choice.outcome}` },
  );
  const filters = useMemo(() => filtersOf(choice, list.appliedSearch), [choice, list.appliedSearch]);
  const filtered = isFiltered(filters);
  const summary = useResource((signal) => auditService.summary(filters, signal), JSON.stringify(filters), summaryError);
  const exporting = useAuditExport(filters, filtered);
  const data = summary.data;
  // Eventos que el servidor descartó por falta de memoria: un hueco en la evidencia nunca es silencioso.
  const dropped = data?.dropped ?? 0;

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('audit.title')}
          subtitle={t('audit.subtitle')}
          actions={
            <Button variant="primary" icon={<Download size={18} />} loading={exporting.busy} onClick={() => void exporting.run()}>
              {exporting.label}
            </Button>
          }
        />
        <PanelSection>
          {Boolean(summary.error) && !data && <RetryState onRetry={summary.retry} />}
          <KpiGrid kpis={auditKpis(data)} />
          {data && (
            <p className="muted small">
              {t('audit.period', { since: formatDateTime(data.since), until: formatDateTime(data.until) })} · {t('audit.retention', { count: data.retention_days })}
            </p>
          )}
          {dropped > 0 && (
            <p className="inline-note small">
              <AlertTriangle size={16} color="var(--danger)" /> {t('audit.dropped', { count: dropped })}
            </p>
          )}
        </PanelSection>
        <PanelSection>
          <AuditToolbar choice={choice} onChange={setChoice} search={list.search} onSearch={list.setSearch} filtered={filtered} today={today} />
          <p className="muted small">{t('audit.total', { value: totalText(list.total, list.data?.count_cap) })}</p>
          <ListResults
            list={list}
            columns={COLUMNS.map((column) => t(`audit.columns.${column}`))}
            pager={{ noun: { one: t('audit.noun.one'), other: t('audit.noun.other') } }}
            empty={
              filtered
                ? { icon: <SearchX />, title: t('audit.noMatch.title'), description: t('audit.noMatch.description') }
                : { icon: <ScrollText />, title: t('audit.empty.title'), description: t('audit.empty.description') }
            }
            renderCells={(event) => <AuditCells event={event} />}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
