import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { siteService } from '../../services/siteService';
import type { WorkSite } from '../../types';
import { addressLine } from '../../utils/address';
import { metersText } from '../../utils/numbers';
import { DeletedRecordPage } from '../trash/TrashParts';
import type { RestoreQuestion } from '../trash/useRestore';

/** Restaurar un sitio: cuál regresa (su domicilio y su radio). */
export const siteRestore = (site: WorkSite): RestoreQuestion => ({
  title: t('sites.trash.restoreTitle', { name: site.name }),
  details: [
    { label: t('sites.list.columns.address'), value: addressLine(site.address) },
    { label: t('sites.list.columns.radius'), value: metersText(site.radius_m) },
  ],
});

interface DeletedSiteProps {
  record: WorkSite;
  /** Al restaurarlo: la pantalla muestra su edición vigente. */
  onRestored: (record: WorkSite) => void;
}

/**
 * Un sitio eliminado (su edición es su detalle): el aviso con cuándo y quién lo eliminó, y «Restaurar»; sin el
 * formulario, el estado ni eliminar.
 */
export function DeletedSite({ record: site, onRestored }: DeletedSiteProps) {
  const t = useT();
  return (
    <DeletedRecordPage
      record={site}
      name={site.name}
      subtitle={addressLine(site.address)}
      backTo={paths.company.sites}
      backLabel={t('sites.list.title')}
      banner={t('sites.trash.banner')}
      restore={() => siteService.restore(site.id)}
      question={() => siteRestore(site)}
      onRestored={onRestored}
    />
  );
}
