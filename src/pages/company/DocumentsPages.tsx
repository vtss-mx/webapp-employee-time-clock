import { Upload } from 'lucide-react';
import { useMemo } from 'react';
import { DocumentList, useDocumentList } from '../../components/documents/DocumentList';
import { DocumentUploadForm } from '../../components/documents/DocumentUploadForm';
import { listSubtitle } from '../../components/trash/TrashParts';
import { ButtonLink } from '../../components/ui/Button';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { companyDocumentService, documentsBase } from '../../services/companyDocumentService';

/** Los documentos de la empresa de la sesión (la empresa la pone el backend, nunca la app). */
const useOwnDocuments = () => useMemo(() => companyDocumentService(documentsBase.company), []);

/**
 * «Documentos» de la empresa (/company/documents): lo que necesita la plataforma para facturarle (constancia fiscal,
 * acta constitutiva...), con «Eliminados». La empresa elimina y restaura solo lo que ella subió; lo que subió la
 * plataforma lo descarga y nada más (lo dice el backend en cada documento).
 */
export function DocumentsPage() {
  const t = useT();
  const service = useOwnDocuments();
  const list = useDocumentList(service);
  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('documents.title')}
          subtitle={listSubtitle(list, (count) => t('documents.count', { count }))}
          actions={
            <ButtonLink to={paths.company.newDocument} variant="primary" icon={<Upload size={18} />}>
              {t('documents.add')}
            </ButtonLink>
          }
        />
        <PanelSection>
          <DocumentList service={service} list={list} uploadTo={paths.company.newDocument} />
        </PanelSection>
      </Panel>
    </div>
  );
}

/** Subir un documento de la empresa (/company/documents/new). */
export function DocumentUploadPage() {
  const t = useT();
  const service = useOwnDocuments();
  return (
    <div className="page">
      <DocumentUploadForm service={service} backTo={paths.company.documents} backLabel={t('documents.title')} subtitle={t('documents.upload.subtitle')} />
    </div>
  );
}
