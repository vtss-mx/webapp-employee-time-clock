import { SearchX, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiskBadge } from '../../../components/fraud/RiskBadge';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { Select } from '../../../components/ui/Select';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { usePagedList } from '../../../hooks/usePagedList';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { fraudCaseService } from '../../../services/fraudCaseService';
import type { FraudCase } from '../../../types';
import { timeAgo } from '../../../utils/format';
import { formatCount } from '../../../utils/numbers';

/** Sin estado = los que esperan revisión (abiertos y en revisión); `ALL` = todos. */
const PENDING = 'pending';
const ALL = 'ALL';
const ANY_KIND = 'any';

const loadError = () => t('fraud.list.loadError');

/** Quién: la ficha de trabajo del empleado (nombre y número) o, sin persona identificada, la cuenta que operó. */
export function subjectOf(item: FraudCase): string {
  if (item.employee) return `${item.employee.full_name} · ${item.employee.employee_number}`;
  return item.actor ?? t('fraud.list.unknown');
}

/**
 * Casos de fraude (ADMIN de la plataforma, decisión D10): los intentos sospechosos y de riesgo alto de todas las
 * empresas, agrupados por persona. Por omisión, los que esperan revisión; se filtran por estado y por tipo de fraude
 * y cada fila abre su caso (intentos, señales, evidencia y su decisión).
 */
export function FraudCasesPage() {
  const t = useT();
  const navigate = useNavigate();
  const { active, nameOf } = useCatalogs();
  const [status, setStatus] = useState(PENDING);
  const [kind, setKind] = useState(ANY_KIND);
  const list = usePagedList(
    (query, signal) =>
      fraudCaseService.list({ ...query, status: status === PENDING ? undefined : status, kind: kind === ANY_KIND ? undefined : kind }, signal),
    { errorTitle: loadError, filterKey: `${status}|${kind}` },
  );
  const filtered = status !== PENDING || kind !== ANY_KIND;

  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('fraud.title')} subtitle={t('fraud.list.subtitle')} />
        <PanelSection>
          <div className="toolbar">
            <Select
              value={status}
              onChange={setStatus}
              aria-label={t('fraud.list.statusFilter')}
              options={[
                { value: PENDING, label: t('fraud.list.pending') },
                ...active('fraud_case_statuses').map((s) => ({ value: s.code, label: s.name })),
                { value: ALL, label: t('fraud.list.all') },
              ]}
            />
            <Select
              value={kind}
              onChange={setKind}
              aria-label={t('fraud.list.kindFilter')}
              options={[{ value: ANY_KIND, label: t('fraud.list.anyKind') }, ...active('fraud_kinds').map((k) => ({ value: k.code, label: k.name }))]}
            />
          </div>
          <ListResults
            list={list}
            pager={{ noun: { one: t('fraud.list.noun.one'), other: t('fraud.list.noun.other') } }}
            columns={[t('fraud.list.case'), t('fraud.list.company'), t('fraud.list.subject'), t('fraud.list.kind'), t('fraud.list.risk'), t('fraud.list.attempts'), t('fraud.list.last'), t('fraud.list.status')]}
            onOpen={(item) => void navigate(paths.admin.fraudCase(item.id))}
            empty={
              filtered
                ? { icon: <SearchX />, title: t('fraud.list.noMatchTitle'), description: t('fraud.list.noMatchDescription') }
                : { icon: <ShieldCheck />, tone: 'success', title: t('fraud.list.emptyTitle'), description: t('fraud.list.emptyDescription') }
            }
            renderCells={(item) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <span className="icon-tile">
                      <ShieldAlert size={18} />
                    </span>
                    <span className="person__info">
                      <strong className="truncate">{item.reason_name}</strong>
                      <small className="truncate">{t('fraud.list.number', { id: item.id })}</small>
                    </span>
                  </span>
                </td>
                <td data-label={t('fraud.list.company')}>{item.company_name}</td>
                <td data-label={t('fraud.list.subject')} className="table__wide">
                  <span className="truncate">{subjectOf(item)}</span>
                </td>
                <td data-label={t('fraud.list.kind')}>{nameOf('fraud_kinds', item.kind)}</td>
                <td data-label={t('fraud.list.risk')}>
                  <RiskBadge tier={item.tier} score={item.max_score} />
                </td>
                <td data-label={t('fraud.list.attempts')}>{formatCount(item.attempts)}</td>
                <td data-label={t('fraud.list.last')}>{timeAgo(item.last_attempt_at)}</td>
                <td data-label={t('fraud.list.status')}>
                  <CatalogStatusBadge catalog="fraud_case_statuses" code={item.status} />
                </td>
              </>
            )}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
