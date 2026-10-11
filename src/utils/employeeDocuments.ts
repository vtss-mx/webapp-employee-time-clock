import { t } from '../i18n';
import { DOCUMENT_ACCEPT, documentProblem } from './companyDocuments';
import { config } from './config';
import { BYTES_PER_MB, formatBytes } from './numbers';

/*
 * Reglas puras de los documentos de identidad del empleado (onboarding con OCR). El formato, el vacío y el tamaño se
 * revisan solo como ayuda (el backend vuelve a validar POR SU CONTENIDO y lee la imagen con OCR). Los formatos
 * aceptados son los mismos que los documentos de la empresa (`companyDocuments`: PDF, Word, Excel, XML, JPG, PNG), así
 * que su `accept` y la revisión se reutilizan; solo cambian el tope en MB (`EMPLOYEE_DOCUMENT_MAX_MB`) y los textos.
 */

/** Tipos que ofrece el selector del sistema (en móvil, con `image/*` también la cámara): los mismos que la empresa. */
export const EMPLOYEE_DOCUMENT_ACCEPT = DOCUMENT_ACCEPT;

/**
 * El servidor revisa la imagen en una sola pasada de OCR y, si NO reconoce un documento, responde 422 con este código
 * (no guarda nada). No es un error de campo ni terminal: la pantalla muestra el motivo del servidor y deja volver a
 * tomar la foto o elegir otro archivo (`EmployeeDocumentUploadForm`).
 */
export const DOCUMENT_NOT_RECOGNIZED = 'DOCUMENT_NOT_RECOGNIZED';

/** Tamaño máximo antes de subirlo (bytes), el mismo `EMPLOYEE_DOCUMENT_MAX_MB` del backend. */
export const employeeDocumentMaxBytes = (): number => config.employeeDocumentMaxMb * BYTES_PER_MB;

/** El problema del archivo como texto del campo (o el aviso de que falta elegirlo). */
export function employeeDocumentFileError(file: File | null, maxBytes = employeeDocumentMaxBytes()): string | undefined {
  if (!file) return t('employeeDocuments.upload.errors.fileMissing');
  const problem = documentProblem(file, maxBytes);
  if (problem === 'size') return t('employeeDocuments.upload.errors.size', { size: formatBytes(file.size), max: formatBytes(maxBytes) });
  return problem ? t(problem === 'type' ? 'employeeDocuments.upload.errors.type' : 'employeeDocuments.upload.errors.empty') : undefined;
}

/**
 * Errores del backend que van a un campo aunque lleguen sin `field` (un 413 del gateway): los del archivo y el tipo.
 * Los demás (permisos, 404, 429, 503) se explican en el popup.
 */
export const EMPLOYEE_DOCUMENT_ERROR_FIELDS: Partial<Record<string, 'file' | 'type'>> = {
  EMPLOYEE_DOCUMENT_TOO_LARGE: 'file',
  PAYLOAD_TOO_LARGE: 'file',
  DOCUMENT_EMPTY: 'file',
  DOCUMENT_FORMAT_NOT_ALLOWED: 'file',
  DOCUMENT_MACROS_NOT_ALLOWED: 'file',
  DOCUMENT_DAMAGED: 'file',
  DOCUMENT_XML_UNSAFE: 'file',
  DOCUMENT_IMAGE_TOO_LARGE: 'file',
  DOCUMENT_TYPE_INVALID: 'type',
};
