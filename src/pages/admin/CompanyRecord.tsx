import { Building2 } from 'lucide-react';
import { DeletedRecordPage } from '../../components/trash/TrashParts';
import type { RestoreQuestion } from '../../components/trash/useRestore';
import { PanelSection } from '../../components/ui/Panel';
import { useCatalogs } from '../../hooks/useCatalogs';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { Company, CompanyDetail } from '../../types';
import type { ConfirmDetail } from '../../types/confirm';
import type { CatalogApi } from '../../utils/catalogs';
import { formatDate, formatDateTime } from '../../utils/format';
import { formatCount } from '../../utils/numbers';
import { formatPhone } from '../../utils/phone';
import { formatTaxId } from '../../utils/taxId';

/** Lo que se lee de los catálogos para mostrar el identificador fiscal (la sigla del tipo y el nombre del país). */
type TaxIdCatalogs = Pick<CatalogApi, 'byCode' | 'nameOf'>;

/** Un dato sin capturar, en gris ("Sin capturar"). */
export const orMissing = (value: string | null | undefined) => value || <span className="muted">{t('common.values.empty')}</span>;

/** Bajo el nombre y en la lista: «RFC · PNO120315AB1 · México» o, sin capturar, «Sin identificador fiscal». */
export const taxIdLine = (company: Company, catalogs: TaxIdCatalogs) => formatTaxId(company, catalogs) ?? t('admin.shared.noTaxId');

/**
 * "Datos de la empresa" (razón social, identificador fiscal, teléfono y su último cambio): en su ficha vigente y en la
 * eliminada.
 */
export function CompanyDataSection({ company }: { company: CompanyDetail }) {
  const t = useT();
  const catalogs = useCatalogs();
  return (
    <PanelSection title={t('admin.shared.companyData')} icon={<Building2 size={20} />}>
      <dl className="details">
        <div>
          <dt>{t('admin.form.legalName')}</dt>
          <dd>{orMissing(company.legal_name)}</dd>
        </div>
        <div>
          <dt>{t('admin.form.taxId.number')}</dt>
          <dd>{orMissing(formatTaxId(company, catalogs))}</dd>
        </div>
        <div>
          <dt>{t('common.fields.phone')}</dt>
          <dd>{orMissing(company.phone && formatPhone(company.phone))}</dd>
        </div>
        <div>
          <dt>{t('admin.detail.updatedAt')}</dt>
          <dd>{formatDateTime(company.updated_at)}</dd>
        </div>
      </dl>
    </PanelSection>
  );
}

/**
 * La empresa en una confirmación (eliminarla o restaurarla): razón social, identificador fiscal y cuántos
 * administradores tiene.
 */
export const companyFacts = (company: CompanyDetail, catalogs: TaxIdCatalogs): ConfirmDetail[] => [
  { label: t('admin.form.legalName'), value: orMissing(company.legal_name) },
  { label: t('admin.form.taxId.number'), value: orMissing(formatTaxId(company, catalogs)) },
  { label: t('admin.shared.admins'), value: formatCount(company.admin_count) },
];

/** Restaurar una empresa: cuál regresa (con sus cuentas) y que las fotos de sus cuentas no se recuperan. */
export const companyRestore = (company: CompanyDetail, catalogs: TaxIdCatalogs): RestoreQuestion => ({
  title: t('admin.trash.restoreTitle', { name: company.name }),
  details: companyFacts(company, catalogs),
  note: t('ui.trash.photosGone'),
});

/**
 * Ficha de una empresa eliminada: sus datos, el aviso con cuándo y quién la eliminó, y «Restaurar». Sin editar,
 * activar, módulos ni eliminar, y sin pedir sus administradores, su cobranza ni su política (el backend las
 * responde 404). Al restaurarla, `onRestored` muestra la ficha vigente.
 */
export function DeletedCompany({ company, onRestored }: { company: CompanyDetail; onRestored: (company: CompanyDetail) => void }) {
  const t = useT();
  const catalogs = useCatalogs();
  return (
    <DeletedRecordPage
      record={company}
      name={company.name}
      subtitle={t('admin.detail.since', { taxId: taxIdLine(company, catalogs), date: formatDate(company.created_at) })}
      backTo={paths.admin.companies}
      backLabel={t('admin.shared.companies')}
      banner={t('admin.trash.banner')}
      restore={() => adminService.restore(company.id)}
      question={() => companyRestore(company, catalogs)}
      onRestored={onRestored}
    >
      <CompanyDataSection company={company} />
    </DeletedRecordPage>
  );
}
