import { FileText, FileUp, Upload } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFormState } from '../../hooks/useFormState';
import { t, useT } from '../../i18n';
import { fieldErrorsFrom } from '../../services/apiClient';
import type { CompanyDocumentApi } from '../../services/companyDocumentService';
import type { CompanyDocumentInput } from '../../types/documents';
import { catalogOptions } from '../../utils/catalogs';
import { DOCUMENT_ACCEPT, DOCUMENT_ERROR_FIELDS, DOCUMENT_NOTE_MAX, documentFileError, documentMaxBytes } from '../../utils/companyDocuments';
import { formatBytes } from '../../utils/numbers';
import { TextAreaField } from '../FormField';
import { FormFooter } from '../FormFooter';
import { SelectField } from '../ui/formFields';
import { FilePicker } from '../ui/FilePicker';
import { Panel, PanelHeader, PanelSection } from '../ui/Panel';
import { UploadProgress } from '../ui/UploadProgress';
import { uploadDocumentConfirm, type DocumentTypeName } from './documentConfirms';

/** Lo que se captura como texto (el archivo va aparte). */
interface DocumentValues {
  type: string;
  note: string;
}

/** Errores del servidor por campo, incluido el del archivo (también los que llegan sin `field`: un 413 del gateway). */
const serverErrors = (error: unknown) => fieldErrorsFrom<DocumentValues & { file: string }>(error, DOCUMENT_ERROR_FIELDS);
const uploadError = () => t('documents.upload.error');

interface DocumentUploadFormProps {
  service: CompanyDocumentApi;
  /** El listado al que regresa (al cancelar y al terminar). */
  backTo: string;
  backLabel: string;
  /** Línea bajo el título: en la del ADMIN, la empresa. */
  subtitle: string;
  /** La empresa en la confirmación (ADMIN: deja claro a cuál se sube). */
  company?: string;
}

/**
 * Formulario ÚNICO para subir un documento de una empresa (ADMIN y empresa): el archivo (`FilePicker`: formato y
 * tamaño en MB revisados antes de subirlo, solo como ayuda), el tipo del catálogo (solo los activos) y una nota
 * opcional. Pregunta antes con lo que se sube; mientras sube, el avance; al terminar avisa con el mensaje del servidor
 * y regresa al listado. Un rechazo del archivo o del tipo (por su contenido) queda en su campo; lo demás, en el popup.
 */
export function DocumentUploadForm({ service, backTo, backLabel, subtitle, company }: DocumentUploadFormProps) {
  const t = useT();
  const navigate = useNavigate();
  const { active, nameOf } = useCatalogs();
  const typeName: DocumentTypeName = (code) => nameOf('company_document_types', code);
  const form = useFormState<DocumentValues>({ type: '', note: '' }, { serverErrors });
  const [file, setFile] = useState<File | null>(null);
  const [fileServerError, setFileServerError] = useState<string>();
  const [tried, setTried] = useState(false);
  const { values } = form;
  const set = (changes: Partial<DocumentValues>) => form.setValues({ ...values, ...changes });
  const typeError = () => (values.type ? undefined : t('documents.upload.errors.typeMissing'));
  const errors = form.visibleErrors({ type: typeError() });
  // El problema del archivo se ve al elegirlo; que falta, al intentar subir.
  const fileError = fileServerError ?? (file || tried ? documentFileError(file) : undefined);
  const problems = () => ({ file: fileServerError ?? documentFileError(file), type: typeError() });

  const upload = (input: CompanyDocumentInput) =>
    form.saveIfValid(
      problems,
      async () => {
        const { message } = await service.upload(input).catch((error: unknown) => {
          setFileServerError(serverErrors(error).file);
          throw error;
        });
        void form.feedback.success(message);
        void navigate(backTo, { replace: true });
      },
      uploadError,
      () => uploadDocumentConfirm(input, typeName, company),
    );

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    setTried(true);
    if (file) {
      upload({ file, type: values.type, note: values.note });
      return;
    }
    // Sin archivo no hay nada que preguntar ni enviar: se marcan los campos y se resume qué falta.
    form.touchAll();
    void form.feedback.invalidForm(problems);
  };

  return (
    <Panel onSubmit={onSubmit}>
      <PanelHeader title={t('documents.upload.title')} subtitle={subtitle} backTo={backTo} backLabel={backLabel} />
      <PanelSection title={t('documents.upload.fileSection')} icon={<FileUp size={20} />}>
        <div className="stack">
          <FilePicker
            label={t('documents.upload.fileLabel')}
            value={file}
            onChange={(chosen) => {
              setFile(chosen);
              setFileServerError(undefined);
            }}
            accept={DOCUMENT_ACCEPT}
            hint={t('documents.upload.hint', { max: formatBytes(documentMaxBytes()) })}
            error={fileError}
            required
            disabled={form.saving}
          />
          {form.saving && <UploadProgress label={t('documents.upload.uploading')} />}
        </div>
      </PanelSection>
      <PanelSection title={t('documents.upload.dataSection')} icon={<FileText size={20} />}>
        <div className="form-grid">
          <SelectField
            label={t('documents.upload.typeLabel')}
            value={values.type}
            options={catalogOptions(active('company_document_types'))}
            placeholder={t('documents.upload.typePlaceholder')}
            onChange={(type) => set({ type })}
            error={errors.type}
            required
            disabled={form.saving}
          />
          <TextAreaField
            label={t('common.fields.note')}
            className="form-grid__wide"
            value={values.note}
            onChange={(note) => set({ note })}
            maxLength={DOCUMENT_NOTE_MAX}
            counter
            hint={t('documents.upload.noteHint')}
            error={errors.note}
            disabled={form.saving}
          />
        </div>
      </PanelSection>
      <FormFooter submitLabel={t('documents.add')} submitIcon={<Upload size={20} />} saving={form.saving} onCancel={() => void navigate(backTo)} />
    </Panel>
  );
}
