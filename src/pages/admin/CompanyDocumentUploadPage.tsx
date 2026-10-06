import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { DocumentUploadForm } from '../../components/documents/DocumentUploadForm';
import { LoadFailed } from '../../components/shifts/PageStates';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import { companyDocumentService, documentsBase } from '../../services/companyDocumentService';

const loadError = () => t('admin.shared.loadCompanyError');

/**
 * Subir un documento de una empresa (ADMIN, /admin/companies/:id/documents/new): el mismo formulario de la empresa,
 * con la empresa en el subtítulo y en la confirmación. Al terminar regresa a la ficha de la empresa.
 */
export function CompanyDocumentUploadPage() {
  const t = useT();
  const companyId = Number(useParams().id);
  const service = useMemo(() => companyDocumentService(documentsBase.admin(companyId)), [companyId]);
  const { data: company, error, retry } = useResource((signal) => adminService.get(companyId, signal), companyId, loadError);
  const back = paths.admin.company(companyId);
  if (!company) {
    return error ? <LoadFailed title={t('documents.upload.title')} backTo={back} backLabel={t('common.fields.company')} onRetry={retry} /> : <SkeletonCard lines={6} />;
  }
  return (
    <div className="page">
      <DocumentUploadForm service={service} backTo={back} backLabel={company.name} subtitle={company.name} company={company.name} />
    </div>
  );
}
