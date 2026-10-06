import { KeyRound, QrCode, Tablet, TabletSmartphone, Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { deleteKioskConfirm, kioskRestore, pairedText, repairKioskConfirm } from '../../../components/kiosks/kioskConfirms';
import { kioskPairingMessage } from '../../../components/kiosks/kioskPairing';
import { listEmpty, listSubtitle, TrashCells, trashColumns } from '../../../components/trash/TrashParts';
import { useRestore } from '../../../components/trash/useRestore';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { ListToolbar } from '../../../components/ui/ListControls';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useAction } from '../../../hooks/useAction';
import { useFeedback } from '../../../hooks/useFeedback';
import { useResource } from '../../../hooks/useResource';
import { useSearchList } from '../../../hooks/useSearchList';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { siteService } from '../../../services/siteService';
import type { Kiosk } from '../../../types';
import { timeAgo } from '../../../utils/format';

/** Qué kiosco se está procesando y con qué botón (cada uno muestra su propio "ocupado"). */
type Busy = `${'repair' | 'delete'}:${number}`;

const siteError = () => t('sites.form.loadError');
const listError = () => t('kiosk.manage.loadError');

/**
 * Kioscos de un sitio (/company/sites/:id/kiosks, dentro de la pantalla de sitios): la tableta que muestra el código
 * que el personal escanea o escribe al checar en el sitio (antifraude 2b). Cada uno dice si ya tiene una tableta
 * vinculada, cuál y cuándo se vio; «Nuevo código de vinculación» deja sin servicio a la tableta anterior y «Eliminar»
 * lo pasa a «Eliminados» (se restaura durante 1 año). El código de vinculación se muestra UNA sola vez.
 */
export function SiteKiosksPage() {
  const t = useT();
  const siteId = Number(useParams().id);
  const feedback = useFeedback();
  const { data: site } = useResource((signal) => siteService.get(siteId, signal), siteId, siteError);
  const list = useSearchList((query, signal) => siteService.kiosks(siteId, { page: query.page, size: query.size, deleted: query.deleted }, signal), {
    errorTitle: listError,
    filterKey: String(siteId),
  });
  const { busy, run } = useAction<Busy>();
  const { restoring, restore } = useRestore();
  const siteName = site?.name ?? '';

  const repair = (kiosk: Kiosk) =>
    void run(() => siteService.repairKiosk(siteId, kiosk.id), {
      busy: `repair:${kiosk.id}`,
      confirm: () => repairKioskConfirm(kiosk, siteName),
      errorTitle: () => t('kiosk.manage.repairError'),
      onSuccess: (created) => {
        list.retry();
        void feedback.show(() => kioskPairingMessage(created, true));
      },
    });
  const remove = (kiosk: Kiosk) =>
    void run(() => siteService.removeKiosk(siteId, kiosk.id), {
      busy: `delete:${kiosk.id}`,
      confirm: () => deleteKioskConfirm(kiosk, siteName),
      errorTitle: () => t('kiosk.manage.deleteError'),
      success: () => [t('kiosk.manage.deleted')],
      onSuccess: list.retry,
    });
  const restoreKiosk = (kiosk: Kiosk) => void restore(kiosk.id, () => siteService.restoreKiosk(siteId, kiosk.id), () => kioskRestore(kiosk, siteName), list.retry);

  const create = (
    <ButtonLink to={paths.company.newSiteKiosk(siteId)} variant="primary" icon={<Tablet size={18} />}>
      {t('kiosk.manage.new')}
    </ButtonLink>
  );
  const columns = { state: t('kiosk.manage.columns.state'), seen: t('kiosk.manage.columns.seen') };

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('kiosk.manage.title')}
          subtitle={site ? `${site.name} · ${listSubtitle(list, (count) => t('kiosk.manage.subtitle', { count }))}` : t('common.states.loading')}
          backTo={paths.company.sites}
          backLabel={t('sites.list.title')}
          actions={create}
        />
        <PanelSection>
          <p className="muted small inline-note">
            <QrCode size={16} aria-hidden /> {t(site?.presence_code === false ? 'kiosk.manage.codeOff' : 'kiosk.manage.intro')}
          </p>
          <ListToolbar filter={list.filter} onFilter={list.setFilter} trash statuses={false} />
          <ListResults
            list={list}
            pager={{ noun: { one: t('kiosk.manage.noun.one'), other: t('kiosk.manage.noun.other') } }}
            columns={list.trash ? [t('kiosk.manage.columns.kiosk'), ...trashColumns()] : [t('kiosk.manage.columns.kiosk'), columns.state, columns.seen, t('ui.trash.actions')]}
            empty={listEmpty(list, { empty: { icon: <TabletSmartphone />, title: t('kiosk.manage.empty'), description: t('kiosk.manage.emptyDescription'), action: create } })}
            renderCells={(kiosk) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <span className="icon-tile">
                      <Tablet size={18} />
                    </span>
                    <span className="person__info">
                      <strong className="truncate">{kiosk.name}</strong>
                      {kiosk.device_name && <small className="truncate">{kiosk.device_name}</small>}
                    </span>
                  </span>
                </td>
                {list.trash ? (
                  <TrashCells record={kiosk} name={kiosk.name} busy={restoring === kiosk.id} disabled={restoring !== null} onRestore={() => restoreKiosk(kiosk)} />
                ) : (
                  <>
                    <td data-label={columns.state}>
                      <span className={`badge ${kiosk.paired ? 'badge--success' : 'badge--muted'}`}>{pairedText(kiosk)}</span>
                    </td>
                    <td data-label={columns.seen}>{kiosk.last_seen_at ? timeAgo(kiosk.last_seen_at) : t('kiosk.manage.neverSeen')}</td>
                    <td className="table__actions">
                      <Button size="sm" variant="secondary" icon={<KeyRound size={16} />} loading={busy === `repair:${kiosk.id}`} disabled={busy !== null} onClick={() => repair(kiosk)}>
                        {t('kiosk.manage.repair')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        icon={<Trash2 size={16} />}
                        title={t('common.actions.delete')}
                        aria-label={t('kiosk.manage.deleteOf', { name: kiosk.name })}
                        loading={busy === `delete:${kiosk.id}`}
                        disabled={busy !== null}
                        onClick={() => remove(kiosk)}
                      />
                    </td>
                  </>
                )}
              </>
            )}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
