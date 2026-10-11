import { Download, KeyRound, Lock, SearchX, UserCheck, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AccessControlsPanel, AccountCells, RoleCounts } from '../../../components/accessReview/AccessReviewParts';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { KpiGrid, type Kpi } from '../../../components/ui/KpiCard';
import { ListResults } from '../../../components/ui/ListResults';
import { ListToolbar } from '../../../components/ui/ListControls';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { Select } from '../../../components/ui/Select';
import { useAction } from '../../../hooks/useAction';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useResource } from '../../../hooks/useResource';
import { useSearchList } from '../../../hooks/useSearchList';
import { t, useT } from '../../../i18n';
import { accessReviewService } from '../../../services/accessReviewService';
import type { AccessReviewAccount, AccessReviewFilters, AccessReviewSummary } from '../../../types/accessReview';
import type { Role } from '../../../types';
import { isFiltered, reachedLimit } from '../../../utils/accessReview';
import { base64ToBlob, saveFile } from '../../../utils/download';
import { formatDateTime } from '../../../utils/format';

const COLUMNS = ['account', 'role', 'lastAccess', 'mfa', 'scope', 'flags'] as const;
const ROLES: readonly Role[] = ['ADMIN', 'COMPANY', 'VALIDATOR', 'EMPLOYEE'];
const loadError = () => t('accessReview.loadError');
const summaryError = () => t('accessReview.summaryError');

/** Los interruptores del informe: solo se envían encendidos (un informe sin filtros trae todas las cuentas). */
interface Toggles {
  role: Role | '';
  withoutMfa: boolean;
  stale: boolean;
  locked: boolean;
}

const EMPTY: Toggles = { role: '', withoutMfa: false, stale: false, locked: false };

function filtersOf(toggles: Toggles, search: string): AccessReviewFilters {
  return {
    role: toggles.role || undefined,
    without_mfa: toggles.withoutMfa || undefined,
    stale: toggles.stale || undefined,
    locked: toggles.locked || undefined,
    search: search || undefined,
  };
}

/** Lo que el auditor mira primero: cuentas, privilegiadas sin llave, inactivas, bloqueadas y llaves por vencer. */
function reviewKpis(summary: AccessReviewSummary | null): Kpi[] {
  const withoutMfa = summary?.privileged_without_mfa;
  const expiring = summary?.api_keys_expiring_soon;
  return [
    { key: 'accounts', label: t('accessReview.kpis.accounts'), icon: UserCheck, value: summary?.accounts, tile: '' },
    { key: 'withoutMfa', label: t('accessReview.kpis.withoutMfa'), icon: KeyRound, value: withoutMfa, tile: withoutMfa ? 'icon-tile--danger' : 'icon-tile--success' },
    { key: 'stale', label: t('accessReview.kpis.stale'), icon: UserX, value: summary?.stale, tile: summary?.stale ? 'icon-tile--warning' : '' },
    { key: 'locked', label: t('accessReview.kpis.locked'), icon: Lock, value: summary?.locked, tile: summary?.locked ? 'icon-tile--warning' : '' },
    { key: 'expiringKeys', label: t('accessReview.kpis.expiringKeys'), icon: KeyRound, value: expiring, tile: expiring ? 'icon-tile--warning' : '' },
  ];
}

/** Los interruptores del informe, con listas y casillas propias (nada nativo). */
function ReviewToggles({ toggles, onChange }: { toggles: Toggles; onChange: (next: Toggles) => void }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const set = <K extends keyof Toggles>(key: K, value: Toggles[K]) => onChange({ ...toggles, [key]: value });
  return (
    <div className="toolbar">
      <Select<Role | ''>
        value={toggles.role}
        onChange={(value) => set('role', value)}
        aria-label={t('accessReview.filters.role')}
        options={[{ value: '', label: t('accessReview.filters.allRoles') }, ...ROLES.map((role) => ({ value: role, label: nameOf('roles', role) }))]}
      />
      <Checkbox variant="inline" size="sm" label={t('accessReview.filters.withoutMfa')} checked={toggles.withoutMfa} onChange={(value) => set('withoutMfa', value)} />
      <Checkbox variant="inline" size="sm" label={t('accessReview.filters.stale')} checked={toggles.stale} onChange={(value) => set('stale', value)} />
      <Checkbox variant="inline" size="sm" label={t('accessReview.filters.locked')} checked={toggles.locked} onChange={(value) => set('locked', value)} />
    </div>
  );
}

/**
 * Revisión de accesos (ADMIN, migración 0096 del backend): el listado que un auditor pide cada trimestre —cada
 * cuenta con su rol, su empresa, su último acceso, su segundo factor, sus sesiones abiertas y sus empleos—, su
 * resumen fechado y los CONTROLES declarados que envía el servidor.
 *
 * Solo consulta y exporta: dar de baja una cuenta se hace en su módulo, no aquí. «Exportar» descarga el CSV que el
 * servidor arma con los MISMOS filtros del listado, tras confirmar.
 */
export function AccessReviewPage() {
  const t = useT();
  const [toggles, setToggles] = useState<Toggles>(EMPTY);
  const list = useSearchList<AccessReviewAccount>(
    (query, signal) => accessReviewService.list(filtersOf(toggles, query.search ?? ''), { page: query.page, size: query.size }, signal),
    { errorTitle: loadError, filterKey: `${toggles.role}|${toggles.withoutMfa}|${toggles.stale}|${toggles.locked}` },
  );
  const filters = useMemo(() => filtersOf(toggles, list.appliedSearch), [toggles, list.appliedSearch]);
  const filtered = isFiltered(filters);
  const summary = useResource((signal) => accessReviewService.summary(signal), 'access-review-summary', summaryError);
  const action = useAction();
  const data = summary.data;

  const exportCsv = () =>
    void action.run(() => accessReviewService.export(filters), {
      confirm: () => ({
        kind: 'action',
        eyebrow: t('accessReview.exportAsk.eyebrow'),
        title: t('accessReview.exportAsk.title'),
        message: t(filtered ? 'accessReview.exportAsk.filtered' : 'accessReview.exportAsk.message'),
        note: t('accessReview.exportAsk.note'),
        confirmLabel: t('accessReview.exportAsk.confirm'),
      }),
      errorTitle: () => t('accessReview.exportError'),
      onSuccess: (file) => saveFile(base64ToBlob(file.data, file.content_type), file.filename),
      success: (file) => [t('accessReview.exported'), reachedLimit(file.rows, file.limit) ? t('accessReview.exportedCapped', { count: file.limit }) : t('accessReview.exportedText', { count: file.rows })],
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('accessReview.title')}
          subtitle={t('accessReview.subtitle')}
          actions={
            <Button variant="primary" icon={<Download size={18} />} loading={action.busy !== null} onClick={exportCsv}>
              {t('accessReview.export')}
            </Button>
          }
        />
        <PanelSection>
          {Boolean(summary.error) && !data && <RetryState onRetry={summary.retry} />}
          <KpiGrid kpis={reviewKpis(data)} />
          {data && (
            <>
              <RoleCounts byRole={data.by_role} />
              <p className="muted small">
                {t('accessReview.generatedAt', { date: formatDateTime(data.generated_at) })} · {t('accessReview.neverSignedInCount', { count: data.never_signed_in })} ·{' '}
                {t('accessReview.inactiveCount', { count: data.inactive })} · {t('accessReview.activeKeys', { count: data.active_api_keys })}
              </p>
            </>
          )}
        </PanelSection>
        <PanelSection>
          <ReviewToggles toggles={toggles} onChange={setToggles} />
          <ListToolbar search={list.search} onSearch={list.setSearch} placeholder={t('accessReview.filters.searchPlaceholder')} label={t('accessReview.filters.search')} />
          <ListResults
            list={list}
            columns={COLUMNS.map((column) => t(`accessReview.columns.${column}`))}
            pager={{ noun: { one: t('accessReview.noun.one'), other: t('accessReview.noun.other') } }}
            empty={
              filtered
                ? { icon: <SearchX />, title: t('accessReview.noMatch.title'), description: t('accessReview.noMatch.description') }
                : { icon: <UserCheck />, title: t('accessReview.empty.title'), description: t('accessReview.empty.description') }
            }
            renderCells={(account) => <AccountCells account={account} />}
          />
        </PanelSection>
        {data && <AccessControlsPanel controls={data.controls} generatedAt={data.generated_at} />}
      </Panel>
    </div>
  );
}
