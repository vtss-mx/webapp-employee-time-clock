import { FileText, Upload } from 'lucide-react';
import { useMemo } from 'react';
import { DocumentList, useDocumentList } from '../../components/documents/DocumentList';
import { ButtonLink } from '../../components/ui/Button';
import { PanelSection } from '../../components/ui/Panel';
import { useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { companyDocumentService, documentsBase } from '../../services/companyDocumentService';

/**
 * «Documentos» en la ficha de una empresa VIGENTE (ADMIN): los de la empresa para facturarle, con «Eliminados». El
 * ADMIN sube, descarga, elimina y restaura cualquiera (lo dice el backend en cada documento). La ficha de una empresa
 * eliminada no la muestra: sus secciones ya no existen para el backend (404).
 */
export function CompanyDocumentsSection({ companyId }: { companyId: number }) {
  const t = useT();
  const service = useMemo(() => companyDocumentService(documentsBase.admin(companyId)), [companyId]);
  const list = useDocumentList(service);
  const uploadTo = paths.admin.newCompanyDocument(companyId);
  return (
    <PanelSection
      title={t('documents.title')}
      icon={<FileText size={20} />}
      aside={
        <ButtonLink to={uploadTo} size="sm" variant="primary" icon={<Upload size={16} />}>
          {t('documents.add')}
        </ButtonLink>
      }
    >
      <DocumentList service={service} list={list} uploadTo={uploadTo} compact />
    </PanelSection>
  );
}
