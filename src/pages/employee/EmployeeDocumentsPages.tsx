import { AlertCircle, Check, ClipboardList, Upload } from 'lucide-react';
import { EmployeeDocumentList, useMyDocumentList } from '../../components/employeeDocuments/EmployeeDocumentList';
import { EmployeeDocumentUploadForm } from '../../components/employeeDocuments/EmployeeDocumentUploadForm';
import { ButtonLink } from '../../components/ui/Button';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { myDocumentService } from '../../services/employeeDocumentService';
import type { EmployeeDocumentRequirements } from '../../types/employeeDocuments';

const requirementsError = () => t('employeeDocuments.loadError');

/**
 * «Mis documentos» del empleado (/employee/documents): el onboarding. Si la empresa los exige, un encabezado dice qué
 * pide y qué falta; debajo, la lista de lo que ya subió (con «Eliminados») y el botón para subir otro. El servidor lee
 * la imagen con OCR y la empresa revisa los datos; el empleado solo sube y consulta.
 */
export function EmployeeDocumentsPage() {
  const t = useT();
  const list = useMyDocumentList();
  const { data: requirements } = useResource((signal) => myDocumentService.requirements(signal), 'my-documents-requirements', requirementsError);
  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('employeeDocuments.title')}
          subtitle={t('employeeDocuments.subtitle')}
          actions={
            <ButtonLink to={paths.employee.newDocument} variant="primary" icon={<Upload size={18} />}>
              {t('employeeDocuments.add')}
            </ButtonLink>
          }
        />
        {requirements && (
          <PanelSection>
            <RequirementsBanner requirements={requirements} />
          </PanelSection>
        )}
        <PanelSection>
          <EmployeeDocumentList list={list} uploadTo={paths.employee.newDocument} />
        </PanelSection>
      </Panel>
    </div>
  );
}

/** Qué pide la empresa y qué falta (solo cuando la empresa exige documentos). */
function RequirementsBanner({ requirements }: { requirements: EmployeeDocumentRequirements }) {
  const t = useT();
  if (!requirements.required) {
    return <p className="muted small inline-note">{t('employeeDocuments.requirements.notRequired')}</p>;
  }
  const items = [
    { key: 'officialId', label: t('employeeDocuments.requirements.officialId'), done: !requirements.needs_official_id },
    { key: 'proofOfAddress', label: t('employeeDocuments.requirements.proofOfAddress'), done: !requirements.needs_proof_of_address },
  ];
  const allDone = items.every((item) => item.done);
  return (
    <div className="stack">
      <h3 className="panel__section-title">
        <ClipboardList size={20} /> {t('employeeDocuments.requirements.title')}
      </h3>
      <ul className="checklist">
        {items.map((item) => (
          <li key={item.key} className={item.done ? '' : 'checklist__warn'}>
            {item.done ? <Check size={18} /> : <AlertCircle size={18} />}
            <span>{item.label}</span>
            <span className={`badge badge--plain ${item.done ? 'badge--success' : 'badge--muted'}`}>
              {item.done ? t('employeeDocuments.requirements.done') : t('employeeDocuments.requirements.missing')}
            </span>
          </li>
        ))}
      </ul>
      {allDone && <p className="small muted">{t('employeeDocuments.requirements.allDone')}</p>}
    </div>
  );
}

/** Subir un documento de identidad (/employee/documents/new). */
export function EmployeeDocumentUploadPage() {
  return (
    <div className="page">
      <EmployeeDocumentUploadForm />
    </div>
  );
}
