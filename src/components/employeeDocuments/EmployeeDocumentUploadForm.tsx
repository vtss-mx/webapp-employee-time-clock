import { FileText, FileUp, Upload } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFormState } from '../../hooks/useFormState';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { fieldErrorsFrom } from '../../services/apiClient';
import { myDocumentService } from '../../services/employeeDocumentService';
import type { EmployeeDocumentInput } from '../../types/employeeDocuments';
import { catalogOptions } from '../../utils/catalogs';
import { EMPLOYEE_DOCUMENT_ACCEPT, EMPLOYEE_DOCUMENT_ERROR_FIELDS, employeeDocumentFileError, employeeDocumentMaxBytes } from '../../utils/employeeDocuments';
import { formatBytes } from '../../utils/numbers';
import { FormFooter } from '../FormFooter';
import { SelectField } from '../shifts/formFields';
import { FilePicker } from '../ui/FilePicker';
import { Panel, PanelHeader, PanelSection } from '../ui/Panel';
import { UploadProgress } from '../ui/UploadProgress';
import { uploadDocumentConfirm, type EmployeeDocumentTypeName } from './employeeDocumentConfirms';

/** Lo que se captura como texto (el archivo va aparte). */
interface DocumentValues {
  type: string;
}

const serverErrors = (error: unknown) => fieldErrorsFrom<DocumentValues & { file: string }>(error, EMPLOYEE_DOCUMENT_ERROR_FIELDS);
const uploadError = () => t('employeeDocuments.upload.error');

/**
 * Formulario para subir un documento de identidad del empleado: el archivo (`FilePicker`; en móvil, con `image/*`,
 * ofrece la cámara o un archivo) y el tipo del catálogo (solo los activos). Pregunta antes con lo que se sube; mientras
 * sube, el avance; al terminar avisa con el mensaje del servidor y regresa a «Mis documentos». Un rechazo del archivo o
 * del tipo (por su contenido) queda en su campo; lo demás, en el popup. El servidor lee la imagen con OCR (mejor
 * esfuerzo) y la empresa confirma o corrige después.
 */
export function EmployeeDocumentUploadForm() {
  const t = useT();
  const navigate = useNavigate();
  const { active, nameOf } = useCatalogs();
  const typeName: EmployeeDocumentTypeName = (code) => nameOf('employee_document_types', code);
  const form = useFormState<DocumentValues>({ type: '' }, { serverErrors });
  const [file, setFile] = useState<File | null>(null);
  const [fileServerError, setFileServerError] = useState<string>();
  const [tried, setTried] = useState(false);
  const { values } = form;
  const typeError = () => (values.type ? undefined : t('employeeDocuments.upload.errors.typeMissing'));
  const errors = form.visibleErrors({ type: typeError() });
  const fileError = fileServerError ?? (file || tried ? employeeDocumentFileError(file) : undefined);
  const problems = () => ({ file: fileServerError ?? employeeDocumentFileError(file), type: typeError() });
  const backTo = paths.employee.documents;

  const upload = (input: EmployeeDocumentInput) =>
    form.saveIfValid(
      problems,
      async () => {
        const { message } = await myDocumentService.upload(input).catch((error: unknown) => {
          setFileServerError(serverErrors(error).file);
          throw error;
        });
        void form.feedback.success(message);
        void navigate(backTo, { replace: true });
      },
      uploadError,
      () => uploadDocumentConfirm(input, typeName),
    );

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    setTried(true);
    if (file) {
      upload({ file, type: values.type });
      return;
    }
    form.touchAll();
    void form.feedback.invalidForm(problems);
  };

  return (
    <Panel onSubmit={onSubmit}>
      <PanelHeader title={t('employeeDocuments.upload.title')} subtitle={t('employeeDocuments.upload.subtitle')} backTo={backTo} backLabel={t('employeeDocuments.title')} />
      <PanelSection title={t('employeeDocuments.upload.fileSection')} icon={<FileUp size={20} />}>
        <div className="stack">
          <FilePicker
            label={t('employeeDocuments.upload.fileLabel')}
            value={file}
            onChange={(chosen) => {
              setFile(chosen);
              setFileServerError(undefined);
            }}
            accept={EMPLOYEE_DOCUMENT_ACCEPT}
            hint={t('employeeDocuments.upload.hint', { max: formatBytes(employeeDocumentMaxBytes()) })}
            error={fileError}
            required
            disabled={form.saving}
          />
          {form.saving && <UploadProgress label={t('employeeDocuments.upload.uploading')} />}
        </div>
      </PanelSection>
      <PanelSection title={t('employeeDocuments.upload.dataSection')} icon={<FileText size={20} />}>
        <div className="form-grid">
          <SelectField
            label={t('employeeDocuments.upload.typeLabel')}
            value={values.type}
            options={catalogOptions(active('employee_document_types'))}
            placeholder={t('employeeDocuments.upload.typePlaceholder')}
            onChange={(type) => form.setValues({ ...values, type })}
            error={errors.type}
            required
            disabled={form.saving}
          />
        </div>
      </PanelSection>
      <FormFooter submitLabel={t('employeeDocuments.add')} submitIcon={<Upload size={20} />} saving={form.saving} onCancel={() => void navigate(backTo)} />
    </Panel>
  );
}
