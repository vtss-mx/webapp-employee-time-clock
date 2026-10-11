import { MapPin, MapPinOff, ScanFace, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VerificationMap } from '../../components/location/VerificationMap';
import { ListResults } from '../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { VerificationBreakdown, VerificationKpis, VerificationOutcome, VerificationPerson } from '../../components/verifications/VerificationParts';
import { EMPTY_CHOICE, VerificationToolbar, choiceKey, filtersOf, isFiltered, type VerificationChoice } from '../../components/verifications/VerificationToolbar';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { reportMapsProblem } from '../../services/clientErrorService';
import { verificationsService } from '../../services/verificationsService';
import type { CompanyVerification } from '../../types';
import type { GeoPoint } from '../../utils/address';
import { formatDateTime, timeAgo } from '../../utils/format';
import { formatDistance } from '../../utils/numbers';

const COLUMNS = ['employee', 'when', 'result', 'method', 'place'] as const;
const loadError = () => t('verification.company.loadError');
const summaryError = () => t('verification.summary.loadError');

/** La fila tiene dónde se hizo (puede verse en el mapa). */
const hasLocation = (v: CompanyVerification): v is CompanyVerification & { latitude: number; longitude: number } => v.latitude !== null && v.longitude !== null;

/**
 * Verificaciones de identidad de la empresa con DÓNDE se hicieron (pantalla «Verificaciones»): el resumen del
 * periodo, el mapa de Google Maps que centra el punto de la fila elegida, la lista paginada en el backend con sus
 * filtros y, al abrir una fila, su detalle técnico completo.
 *
 * La empresa SIEMPRE sale de la sesión (aislamiento por empresa); nunca llegan fotos del registro facial ni datos
 * biométricos (regla 13): la foto que se ve es la de PERFIL. Los límites (el periodo por omisión, el tope del
 * conteo y los niveles de riesgo que se pueden filtrar) los envía el servidor (regla 25).
 */
export function VerificationsPage() {
  const t = useT();
  const { nameOf } = useCatalogs();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<VerificationChoice>(EMPTY_CHOICE);
  // El punto de la fila elegida (lo que centra el mapa) y su id (para resaltarla). Se conservan al paginar o filtrar:
  // el mapa muestra la última verificación elegida hasta que se elija otra.
  const [selected, setSelected] = useState<{ id: number; point: GeoPoint } | null>(null);
  const filters = useMemo(() => filtersOf(choice), [choice]);
  const filterKey = choiceKey(choice);

  const list = usePagedList<CompanyVerification, { since: string; until: string; count_cap: number }>(
    (page, signal) => verificationsService.list({ ...page, ...filters }, signal),
    { errorTitle: loadError, filterKey },
  );
  const summary = useResource((signal) => verificationsService.summary(filters, signal), filterKey, summaryError);
  const filtered = isFiltered(choice);

  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('verification.company.title')} subtitle={t('verification.company.subtitle')} />
        <PanelSection>
          {Boolean(summary.error) && !summary.data && <RetryState onRetry={summary.retry} />}
          <VerificationKpis summary={summary.data} />
          {summary.data && <VerificationBreakdown summary={summary.data} />}
        </PanelSection>
        <PanelSection>
          <div className="verifications__map">
            <VerificationMap point={selected?.point ?? null} onFailure={reportMapsProblem} />
          </div>
          <p className="muted small">{t('verification.company.mapHint')}</p>

          <VerificationToolbar choice={choice} onChange={setChoice} summary={summary.data} />

          <ListResults
            list={list}
            columns={COLUMNS.map((column) => (column === 'employee' ? t('common.fields.employee') : t(`verification.company.columns.${column}`)))}
            onOpen={(row) => void navigate(paths.company.verification(row.id))}
            pager={{ noun: { one: t('verification.company.noun.one'), other: t('verification.company.noun.other') } }}
            empty={
              filtered
                ? { icon: <SearchX />, title: t('verification.company.noMatch.title'), description: t('verification.company.noMatch.description') }
                : { icon: <ScanFace />, title: t('verification.company.empty.title'), description: t('verification.company.empty.description') }
            }
            renderCells={(row) => (
              <>
                <td className="table__primary">
                  <VerificationPerson row={row} />
                </td>
                <td data-label={t('verification.company.columns.when')} title={formatDateTime(row.created_at)}>
                  {timeAgo(row.created_at)}
                </td>
                <td data-label={t('verification.company.columns.result')}>
                  <VerificationOutcome success={row.success} reason={row.reason} />
                </td>
                <td data-label={t('verification.company.columns.method')}>{nameOf('verification_methods', row.method)}</td>
                <td data-label={t('verification.company.columns.place')}>
                  {hasLocation(row) ? (
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      aria-pressed={selected?.id === row.id}
                      onClick={(event) => {
                        // Ver el punto en el mapa no abre el detalle de la fila.
                        event.stopPropagation();
                        setSelected({ id: row.id, point: { lat: row.latitude, lng: row.longitude } });
                      }}
                    >
                      <MapPin size={16} /> {t('verification.company.place.show')}
                      {row.location_accuracy_m !== null && <small className="muted">{t('verification.company.place.accuracy', { distance: formatDistance(row.location_accuracy_m) })}</small>}
                    </button>
                  ) : (
                    <span className="muted inline-note">
                      <MapPinOff size={16} /> {t('verification.company.place.none')}
                    </span>
                  )}
                </td>
              </>
            )}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
