import { CheckCircle2, ListChecks, MapPin, MapPinOff, ScanFace, XCircle } from 'lucide-react';
import { useState } from 'react';
import { VerificationMap } from '../../components/location/VerificationMap';
import { Avatar } from '../../components/ui/Avatar';
import { DateField } from '../../components/ui/DateField';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { reportMapsProblem } from '../../services/clientErrorService';
import { t, useT } from '../../i18n';
import { verificationsService } from '../../services/verificationsService';
import type { CompanyVerification } from '../../types';
import type { GeoPoint } from '../../utils/address';
import { formatDateTime, timeAgo } from '../../utils/format';
import { formatDistance } from '../../utils/numbers';

/** Filtro de resultado del catálogo implícito (todas / solo exitosas / solo fallidas). */
type ResultFilter = 'all' | 'success' | 'failed';

const loadError = () => t('verification.company.loadError');
/** `success` para la consulta según el filtro de resultado (sin él = todas). */
const successOf = (result: ResultFilter): boolean | undefined => (result === 'all' ? undefined : result === 'success');
/** La fila tiene dónde se hizo (puede verse en el mapa). */
const hasLocation = (v: CompanyVerification): v is CompanyVerification & { latitude: number; longitude: number } =>
  v.latitude !== null && v.longitude !== null;

/**
 * Verificaciones de identidad de la empresa con DÓNDE se hicieron (pantalla «Verificaciones»). Lista paginada en el
 * backend (cada fila con la persona y su foto, fecha y hora en la zona del negocio, resultado, método y su punto) y un
 * mapa de Google Maps que centra el punto de la fila elegida. Una verificación sin ubicación lo dice y no pone marcador.
 * La empresa SIEMPRE sale de la sesión (aislamiento por empresa); nunca llegan fotos del registro facial.
 */
export function VerificationsPage() {
  const t = useT();
  const { nameOf } = useCatalogs();
  const [result, setResult] = useState<ResultFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // El punto de la fila elegida (lo que centra el mapa) y su id (para resaltarla). Se conservan al paginar o filtrar:
  // el mapa muestra la última verificación elegida hasta que se elija otra.
  const [selected, setSelected] = useState<{ id: number; point: GeoPoint } | null>(null);

  const list = usePagedList(
    (page, signal) => verificationsService.list({ ...page, success: successOf(result), start: from || undefined, end: to || undefined }, signal),
    { errorTitle: loadError, filterKey: `${result}|${from}|${to}` },
  );

  const filtered = result !== 'all' || Boolean(from) || Boolean(to);
  const tabs: { key: ResultFilter; label: string; Icon: typeof CheckCircle2 }[] = [
    { key: 'all', label: t('verification.company.filters.all'), Icon: ListChecks },
    { key: 'success', label: t('verification.company.filters.success'), Icon: CheckCircle2 },
    { key: 'failed', label: t('verification.company.filters.failed'), Icon: XCircle },
  ];

  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('verification.company.title')} subtitle={t('verification.company.subtitle')} />
        <PanelSection>
          <div className="verifications__map">
            <VerificationMap point={selected?.point ?? null} onFailure={reportMapsProblem} />
          </div>
          <p className="muted small">{t('verification.company.mapHint')}</p>

          <div className="tabs" role="tablist" aria-label={t('verification.company.columns.result')}>
            {tabs.map(({ key, label, Icon }) => (
              <button key={key} role="tab" aria-selected={result === key} className={`tab ${result === key ? 'is-active' : ''}`} onClick={() => setResult(key)}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          <div className="verifications__filters">
            <DateField label={t('verification.company.filters.from')} value={from} onChange={setFrom} max={to || undefined} />
            <DateField label={t('verification.company.filters.to')} value={to} onChange={setTo} min={from || undefined} />
          </div>

          <PagedItems
            list={list}
            skeletonRows={5}
            empty={
              filtered
                ? { icon: <ScanFace />, title: t('verification.company.noMatch.title'), description: t('verification.company.noMatch.description') }
                : { icon: <MapPin />, title: t('verification.company.empty.title'), description: t('verification.company.empty.description') }
            }
            pager={{ noun: { one: t('verification.company.noun.one'), other: t('verification.company.noun.other') } }}
          >
            {(items) => (
              <div className={`table-wrap ${list.loading ? 'is-loading' : ''}`}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('common.fields.employee')}</th>
                      <th>{t('verification.company.columns.when')}</th>
                      <th>{t('verification.company.columns.result')}</th>
                      <th>{t('verification.company.columns.method')}</th>
                      <th>{t('verification.company.columns.place')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((v) => (
                      <tr key={v.id} className={selected?.id === v.id ? 'is-selected' : ''}>
                        <td className="table__primary">
                          {v.employee_name ? (
                            <span className="person">
                              <Avatar name={v.employee_name} src={v.avatar} decorative />
                              <span className="person__info">
                                <strong className="truncate">{v.employee_name}</strong>
                                {v.employee_number && <small>{v.employee_number}</small>}
                              </span>
                            </span>
                          ) : (
                            <span className="muted">{t('verification.company.notIdentified')}</span>
                          )}
                        </td>
                        <td data-label={t('verification.company.columns.when')} title={formatDateTime(v.created_at)}>
                          {timeAgo(v.created_at)}
                        </td>
                        <td data-label={t('verification.company.columns.result')}>
                          {v.success ? (
                            <span className="badge badge--success">{t('verification.outcome.success')}</span>
                          ) : (
                            <span className="badge badge--muted">{nameOf('verification_reasons', v.reason, t('verification.outcome.failed'))}</span>
                          )}
                        </td>
                        <td data-label={t('verification.company.columns.method')}>{nameOf('verification_methods', v.method)}</td>
                        <td data-label={t('verification.company.columns.place')}>
                          {hasLocation(v) ? (
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              aria-pressed={selected?.id === v.id}
                              onClick={() => setSelected({ id: v.id, point: { lat: v.latitude, lng: v.longitude } })}
                            >
                              <MapPin size={16} /> {t('verification.company.place.show')}
                              {v.location_accuracy_m !== null && <small className="muted">{t('verification.company.place.accuracy', { distance: formatDistance(v.location_accuracy_m) })}</small>}
                            </button>
                          ) : (
                            <span className="muted inline-note">
                              <MapPinOff size={16} /> {t('verification.company.place.none')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PagedItems>
        </PanelSection>
      </Panel>
    </div>
  );
}
