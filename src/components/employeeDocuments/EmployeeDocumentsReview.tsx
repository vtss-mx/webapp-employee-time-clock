import { Download, FileCheck, IdCard } from 'lucide-react';
import { useId, useMemo, useState, type ChangeEvent } from 'react';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { fieldErrorsFrom } from '../../services/apiClient';
import { employeeDocumentReview, type EmployeeDocumentReviewApi } from '../../services/employeeDocumentService';
import type { EmployeeDocument, EmployeeDocumentData } from '../../types/employeeDocuments';
import { base64ToBlob, saveFile } from '../../utils/download';
import { formatPercent } from '../../utils/format';
import { formatBytes } from '../../utils/numbers';
import { EmptyState } from '../ui/EmptyState';
import { FormField } from '../FormField';
import { DateField, parseIso } from '../ui/DateField';
import { SkeletonRows } from '../ui/Skeleton';
import { Button } from '../ui/Button';
import { confirmDataConfirm, type EmployeeDocumentTypeName } from './employeeDocumentConfirms';

const loadError = () => t('employeeDocuments.review.loadError');
const downloadError = () => t('employeeDocuments.review.downloadError');
const saveError = () => t('employeeDocuments.review.saveError');

/**
 * Expediente de documentos del empleado para la EMPRESA (sección del registro facial): los documentos con sus datos
 * extraídos, EDITABLES. La empresa descarga el archivo y confirma o corrige los datos (se guarda quién revisó). El
 * ADMIN de la plataforma no ve esta sección (no tiene sus endpoints).
 */
export function EmployeeDocumentsReview({ employeeId }: { employeeId: number }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const typeName: EmployeeDocumentTypeName = (code) => nameOf('employee_document_types', code);
  const service = useMemo(() => employeeDocumentReview(employeeId), [employeeId]);
  const { data, setData, error } = useResource((signal) => service.list({ page: 1, size: 50 }, signal), employeeId, loadError);

  // En error, el popup de `useResource` ofrece «Reintentar»; la sección queda vacía (no duplica el botón).
  if (error) return null;
  if (!data) return <SkeletonRows rows={3} />;
  if (data.items.length === 0) {
    return <EmptyState compact icon={<IdCard />} title={t('employeeDocuments.review.empty.title')} description={t('employeeDocuments.review.empty.description')} />;
  }
  const onUpdated = (document: EmployeeDocument) => setData({ ...data, items: data.items.map((item) => (item.id === document.id ? document : item)) });
  return (
    <div className="stack">
      {data.items.map((doc) => (
        <DocumentCard key={doc.id} service={service} doc={doc} typeName={typeName} onUpdated={onUpdated} />
      ))}
    </div>
  );
}

/** Valores editables de un documento (todo texto; '' = sin dato). */
type DataValues = Record<keyof EmployeeDocumentData, string>;

const FIELDS: ReadonlyArray<keyof EmployeeDocumentData> = ['full_name', 'document_number', 'birth_date', 'expiry_date', 'nationality', 'sex', 'curp', 'voter_key', 'postal_code', 'address'];

const toValues = (data: EmployeeDocumentData): DataValues => Object.fromEntries(FIELDS.map((key) => [key, data[key] ?? ''])) as DataValues;
/** '' → null para que el backend borre el dato; lo demás, recortado. */
const toChanges = (values: DataValues): Partial<EmployeeDocumentData> => {
  const changes: Partial<EmployeeDocumentData> = {};
  for (const key of FIELDS) changes[key] = values[key].trim() || null;
  return changes;
};

/** Las dos fechas del expediente (las edita la empresa; el OCR puede extraer una fecha mal). */
const DATE_FIELDS = ['birth_date', 'expiry_date'] as const satisfies ReadonlyArray<keyof EmployeeDocumentData>;

/**
 * Fechas completas pero inválidas (p. ej. una mal leída por OCR, "2026-13-40"): se rechazan en el cliente ANTES de
 * enviar, para no mandar una basura que el backend rechazaría igual. Vacío no es error (la fecha es opcional).
 */
function invalidDates(values: DataValues): Partial<Record<keyof EmployeeDocumentData, string>> {
  const errors: Partial<Record<keyof EmployeeDocumentData, string>> = {};
  for (const key of DATE_FIELDS) {
    const value = values[key].trim();
    if (value && !parseIso(value)) errors[key] = t('ui.dateField.invalid');
  }
  return errors;
}

type Busy = 'save' | 'download';

/** Un documento del expediente: su encabezado, sus insignias de lectura y el formulario editable de sus datos. */
function DocumentCard({ service, doc, typeName, onUpdated }: { service: EmployeeDocumentReviewApi; doc: EmployeeDocument; typeName: EmployeeDocumentTypeName; onUpdated: (doc: EmployeeDocument) => void }) {
  const t = useT();
  const feedback = useFeedback();
  const mrzHelpId = useId();
  const [values, setValues] = useState<DataValues>(toValues(doc.data));
  // Errores del backend por campo (p. ej. un número o una fecha que no acepta) y si ya se intentó guardar: las dos
  // fechas los muestran bajo su campo (los demás siguen apareciendo en el popup del error).
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof EmployeeDocumentData, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const { busy, run } = useAction<Busy>();
  const disabled = busy !== null;
  const clearServer = (key: keyof EmployeeDocumentData) => setServerErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  const set = (key: keyof EmployeeDocumentData) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    clearServer(key);
  };
  const setDate = (key: keyof EmployeeDocumentData) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    clearServer(key);
  };
  // El error de una fecha bajo su campo: el del servidor; si no, el del cliente una vez que se intentó guardar.
  const clientDates = invalidDates(values);
  const dateError = (key: keyof EmployeeDocumentData) => serverErrors[key] ?? (submitted ? clientDates[key] : undefined);

  const download = () =>
    void run(
      async () => {
        const file = await service.file(doc.id);
        saveFile(base64ToBlob(file.data, file.content_type), file.file_name);
      },
      { busy: 'download', errorTitle: downloadError },
    );
  const save = () => {
    setSubmitted(true);
    // Una fecha completa pero inválida no se envía: se marca bajo su campo y se resume en un popup (nada va al servidor).
    const dates = invalidDates(values);
    if (Object.values(dates).some(Boolean)) {
      void feedback.invalidForm(() => invalidDates(values));
      return;
    }
    void run(() => service.updateData(doc.id, toChanges(values)), {
      busy: 'save',
      confirm: () => confirmDataConfirm(doc, typeName),
      errorTitle: saveError,
      success: () => [t('employeeDocuments.review.saved')],
      onSuccess: (result) => {
        setServerErrors({});
        onUpdated(result.document);
      },
      // Lo que el backend rechace por campo va a su campo (las fechas, bajo su `DateField`); el popup del error lo resume.
      onError: (error) => setServerErrors(fieldErrorsFrom<EmployeeDocumentData>(error)),
    });
  };

  return (
    <section className="stack review-doc">
      <h3 className="panel__section-title">
        <IdCard size={20} /> {doc.file_name}
      </h3>
      <p className="person__info">
        <span className="badge badge--info badge--plain document-type">{typeName(doc.type)}</span>
        <small className="muted">{formatBytes(doc.size)}</small>
        {doc.mrz_verified && <span className="badge badge--success badge--plain" aria-describedby={mrzHelpId}>{t('employeeDocuments.review.mrz')}</span>}
        {doc.ocr_processed && doc.ocr_confidence !== null ? (
          <span className="badge badge--muted badge--plain">{t('employeeDocuments.review.read', { value: formatPercent(doc.ocr_confidence) })}</span>
        ) : (
          <span className="badge badge--muted badge--plain">{t('employeeDocuments.review.notRead')}</span>
        )}
        {doc.confirmed ? (
          <span className="badge badge--success badge--plain" title={t('employeeDocuments.review.confirmedBy', { by: doc.confirmed_by ?? '—' })}>
            {t('employeeDocuments.review.confirmed')}
          </span>
        ) : (
          <span className="badge badge--muted badge--plain">{t('employeeDocuments.review.pending')}</span>
        )}
      </p>

      {doc.mrz_verified && <p id={mrzHelpId} className="small muted">{t('employeeDocuments.review.mrzHelp')}</p>}
      <p className="small muted">{t('employeeDocuments.review.dataTitle')}</p>
      <div className="form-grid">
        <FormField label={t('employeeDocuments.review.fields.fullName')} value={values.full_name} maxLength={200} autoComplete="off" onChange={set('full_name')} disabled={disabled} />
        <FormField label={t('employeeDocuments.review.fields.documentNumber')} value={values.document_number} maxLength={60} autoComplete="off" onChange={set('document_number')} disabled={disabled} />
        <DateField label={t('employeeDocuments.review.fields.birthDate')} value={values.birth_date} onChange={setDate('birth_date')} error={dateError('birth_date')} disabled={disabled} />
        <DateField label={t('employeeDocuments.review.fields.expiryDate')} value={values.expiry_date} onChange={setDate('expiry_date')} error={dateError('expiry_date')} disabled={disabled} />
        <FormField label={t('employeeDocuments.review.fields.nationality')} value={values.nationality} maxLength={3} autoComplete="off" onChange={set('nationality')} disabled={disabled} />
        <FormField label={t('employeeDocuments.review.fields.sex')} value={values.sex} maxLength={1} autoComplete="off" onChange={set('sex')} disabled={disabled} />
        <FormField label={t('employeeDocuments.review.fields.curp')} value={values.curp} maxLength={18} autoComplete="off" onChange={set('curp')} disabled={disabled} />
        <FormField label={t('employeeDocuments.review.fields.voterKey')} value={values.voter_key} maxLength={20} autoComplete="off" onChange={set('voter_key')} disabled={disabled} />
        <FormField label={t('employeeDocuments.review.fields.postalCode')} value={values.postal_code} maxLength={10} autoComplete="off" onChange={set('postal_code')} disabled={disabled} />
        <FormField label={t('employeeDocuments.review.fields.address')} value={values.address} maxLength={300} autoComplete="off" onChange={set('address')} disabled={disabled} />
      </div>
      <div className="review-doc__actions">
        <Button size="sm" variant="secondary" icon={<Download size={16} />} loading={busy === 'download'} disabled={disabled} onClick={download}>
          {t('employeeDocuments.review.download')}
        </Button>
        <Button size="sm" variant="primary" icon={<FileCheck size={16} />} loading={busy === 'save'} disabled={disabled} onClick={save}>
          {t('employeeDocuments.review.save')}
        </Button>
      </div>
    </section>
  );
}
