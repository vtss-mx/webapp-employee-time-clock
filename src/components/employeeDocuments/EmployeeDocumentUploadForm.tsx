import { Camera, FileText, FileUp, Upload } from 'lucide-react';
import { useRef, useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentScanner } from '../DocumentScanner';
import { Button } from '../ui/Button';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFormState } from '../../hooks/useFormState';
import { t, useT } from '../../i18n';
import { ApiError, fieldErrorsFrom } from '../../services/apiClient';
import { myDocumentService } from '../../services/employeeDocumentService';
import type { CatalogItem } from '../../types';
import type { EmployeeDocumentInput } from '../../types/employeeDocuments';
import { catalogOptions } from '../../utils/catalogs';
import { DOCUMENT_NOT_RECOGNIZED, EMPLOYEE_DOCUMENT_ACCEPT, EMPLOYEE_DOCUMENT_ERROR_FIELDS, employeeDocumentFileError, employeeDocumentMaxBytes } from '../../utils/employeeDocuments';
import { formatBytes } from '../../utils/numbers';
import { FormFooter } from '../FormFooter';
import type { MessageAction } from '../MessageDialog';
import { SelectField } from '../ui/formFields';
import { FilePicker, type FilePickerHandle } from '../ui/FilePicker';
import { Panel, PanelHeader, PanelSection } from '../ui/Panel';
import { UploadProgress } from '../ui/UploadProgress';
import { uploadDocumentConfirm, type EmployeeDocumentTypeName } from './employeeDocumentConfirms';

/** Lo que se captura como texto (el archivo va aparte). */
interface DocumentValues {
  type: string;
}

/** De dónde salió el archivo: la cámara (reanudar el escáner) o un archivo elegido (elegir otro). */
type FileSource = 'camera' | 'file' | null;

/**
 * Los tipos que se ofrecen: solo los que acepta ese paso del registro (los manda el servidor) y que el catálogo trae
 * activos. Sin lista del paso (un backend anterior) se ofrecen todos los activos: el servidor valida igual.
 */
function stepTypes(activeTypes: CatalogItem[], allowed: readonly string[]): CatalogItem[] {
  return allowed.length === 0 ? activeTypes : activeTypes.filter((item) => allowed.includes(item.code));
}

const serverErrors = (error: unknown) => fieldErrorsFrom<DocumentValues & { file: string }>(error, EMPLOYEE_DOCUMENT_ERROR_FIELDS);
const uploadError = () => t('employeeDocuments.upload.error');
/** El servidor no reconoció un documento (422): no guardó nada; no es terminal, se ofrece volver a tomar o elegir otro. */
const notRecognized = (error: unknown): error is ApiError => error instanceof ApiError && error.code === DOCUMENT_NOT_RECOGNIZED;

interface UploadFormProps {
  /**
   * Los tipos de documento (códigos de `employee_document_types`) que acepta el PASO del registro que lo pide: los
   * manda el servidor en `document_types` del paso. Vacío = los activos del catálogo (el servidor valida igual).
   */
  types: readonly string[];
  /** A dónde se vuelve al terminar o cancelar (la pantalla del paso) y cómo se llama ese destino. */
  backTo: string;
  backLabel: string;
}

/**
 * Formulario para subir un documento de identidad del empleado: el archivo (`FilePicker`; en móvil, con `image/*`,
 * ofrece la cámara o un archivo) y el tipo (solo los que acepta su paso del registro). Pregunta antes con lo que se
 * sube; mientras sube, el avance; al terminar avisa con el mensaje del servidor y regresa a la pantalla del paso. Un
 * rechazo del archivo o del tipo (por su contenido) queda en su campo; lo demás, en el popup. El servidor lee la
 * imagen con OCR (mejor esfuerzo) y la empresa confirma o corrige después.
 */
export function EmployeeDocumentUploadForm({ types, backTo, backLabel }: UploadFormProps) {
  const t = useT();
  const navigate = useNavigate();
  const { active, nameOf } = useCatalogs();
  const typeName: EmployeeDocumentTypeName = (code) => nameOf('employee_document_types', code);
  // `staysOpen`: un rechazo «no reconocido» (422) deja el formulario en pantalla para volver a intentar; al subir bien
  // se navega fuera, así que liberar el botón al terminar no tiene efecto visible.
  const form = useFormState<DocumentValues>({ type: '' }, { serverErrors, staysOpen: true });
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<FileSource>(null);
  const [fileServerError, setFileServerError] = useState<string>();
  const [tried, setTried] = useState(false);
  const [scanning, setScanning] = useState(false);
  const picker = useRef<FilePickerHandle>(null);
  const { values } = form;
  const typeError = () => (values.type ? undefined : t('employeeDocuments.upload.errors.typeMissing'));
  const errors = form.visibleErrors({ type: typeError() });
  const fileError = fileServerError ?? (file || tried ? employeeDocumentFileError(file) : undefined);
  const problems = () => ({ file: fileServerError ?? employeeDocumentFileError(file), type: typeError() });

  const chooseFile = (chosen: File | null) => {
    setFile(chosen);
    setSource(chosen ? 'file' : null);
    setFileServerError(undefined);
  };

  /**
   * El servidor no reconoció un documento: muestra su motivo (traducido, en caliente) y deja volver a tomar la foto
   * —reanuda el escáner, con la cuenta reiniciada— o elegir otro archivo. Nunca un callejón sin salida: cerrar conserva
   * el formulario. La foto de la cámara ofrece «Volver a tomar» como acción principal; un archivo, «Elegir otro».
   */
  const promptRetake = async (error: ApiError) => {
    const retake: MessageAction = { id: 'retake', label: t('employeeDocuments.upload.notRecognized.retake'), icon: <Camera size={18} /> };
    const choose: MessageAction = { id: 'choose', label: t('employeeDocuments.upload.notRecognized.choose'), icon: <FileUp size={18} /> };
    const action = await form.feedback.show(() => ({
      variant: 'warning',
      title: t('employeeDocuments.upload.notRecognized.title'),
      text: error.message,
      actions: source === 'camera' ? [choose, retake] : [retake, choose],
    }));
    if (action === 'retake') setScanning(true);
    else if (action === 'choose') picker.current?.open();
  };

  const upload = (input: EmployeeDocumentInput) =>
    form.saveIfValid(
      problems,
      async () => {
        try {
          const { message } = await myDocumentService.upload(input);
          void form.feedback.success(message);
          void navigate(backTo, { replace: true });
        } catch (error) {
          if (notRecognized(error)) {
            void promptRetake(error);
            return; // nada que guardar: no es un error terminal, no se abre el popup genérico ni se marca el campo
          }
          setFileServerError(serverErrors(error).file);
          throw error; // el resto (413/415/503/5xx/0/tiempo agotado) conserva su manejo: popup + error de campo
        }
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

  // La cámara: un escáner en vivo que toma la foto sola (o con el obturador). La foto queda como el MISMO archivo del
  // formulario que «Elegir archivo»; al capturar o cancelar se vuelve al formulario (lo escrito se conserva). Reabrir el
  // escáner tras un rechazo lo remonta: la cuenta de cuadros estables arranca de cero.
  if (scanning) {
    return (
      <DocumentScanner
        onCapture={(captured) => {
          setFile(captured);
          setSource('camera');
          setFileServerError(undefined);
          setScanning(false);
        }}
        onCancel={() => setScanning(false)}
      />
    );
  }

  return (
    <Panel onSubmit={onSubmit}>
      <PanelHeader title={t('employeeDocuments.upload.title')} subtitle={t('employeeDocuments.upload.subtitle')} backTo={backTo} backLabel={backLabel} />
      <PanelSection title={t('employeeDocuments.upload.fileSection')} icon={<FileUp size={20} />}>
        <div className="stack">
          <FilePicker
            ref={picker}
            label={t('employeeDocuments.upload.fileLabel')}
            value={file}
            onChange={chooseFile}
            accept={EMPLOYEE_DOCUMENT_ACCEPT}
            hint={t('employeeDocuments.upload.hint', { max: formatBytes(employeeDocumentMaxBytes()) })}
            error={fileError}
            required
            disabled={form.saving}
          />
          <Button variant="secondary" icon={<Camera size={20} />} disabled={form.saving} onClick={() => setScanning(true)}>
            {t('docScan.take')}
          </Button>
          {form.saving && <UploadProgress label={t('employeeDocuments.upload.validating')} />}
        </div>
      </PanelSection>
      <PanelSection title={t('employeeDocuments.upload.dataSection')} icon={<FileText size={20} />}>
        <div className="form-grid">
          <SelectField
            label={t('employeeDocuments.upload.typeLabel')}
            value={values.type}
            options={catalogOptions(stepTypes(active('employee_document_types'), types))}
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
