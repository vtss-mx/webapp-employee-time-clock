import { t } from '../i18n';
import { config } from './config';
import { BYTES_PER_MB, formatBytes } from './numbers';

/*
 * Reglas puras de los documentos de una empresa (formatos, tamaño y nota). Todo lo que se revisa aquí es solo
 * ayuda para no esperar una subida que el servidor rechazará: el backend vuelve a validar el archivo POR SU
 * CONTENIDO (formato real, macros, XML inseguro, archivo dañado) y lo guarda cifrado en el bucket.
 */

/** Extensiones que acepta el backend: PDF, Word, Excel, XML, JPG y PNG. */
export const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'xml', 'jpg', 'jpeg', 'png'] as const;

/** Sus tipos MIME (un archivo sin extensión conocida pero con uno de estos tipos también se ofrece). */
export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/xml',
  'text/xml',
  'image/jpeg',
  'image/png',
] as const;

/** Atributo `accept` del selector: el sistema muestra solo esos archivos (la regla real es la del backend). */
export const DOCUMENT_ACCEPT = [...DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`), ...DOCUMENT_MIME_TYPES].join(',');

/** Largo máximo de la nota (el backend acepta hasta 300 caracteres). */
export const DOCUMENT_NOTE_MAX = 300;

/** Tamaño máximo antes de subirlo (bytes), el mismo `COMPANY_DOCUMENT_MAX_MB` del backend. */
export const documentMaxBytes = (): number => config.companyDocumentMaxMb * BYTES_PER_MB;

/** Por qué no se puede subir el archivo elegido (código: el texto se arma al dibujarse, en el idioma vigente). */
export type DocumentProblem = 'type' | 'empty' | 'size';

/** Extensión del nombre, en minúsculas ("" si no tiene). */
function extensionOf(name: string): string {
  const match = /\.([^.]+)$/.exec(name);
  return match ? match[1].toLowerCase() : '';
}

/** Revisa el archivo antes de subirlo: formato (por extensión o tipo), vacío y tamaño. null si se puede intentar. */
export function documentProblem(file: File, maxBytes = documentMaxBytes()): DocumentProblem | null {
  const known = (DOCUMENT_EXTENSIONS as readonly string[]).includes(extensionOf(file.name)) || (DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type);
  if (!known) return 'type';
  if (file.size === 0) return 'empty';
  return file.size > maxBytes ? 'size' : null;
}

/** El problema del archivo como texto del campo (o el aviso de que falta elegirlo). */
export function documentFileError(file: File | null, maxBytes = documentMaxBytes()): string | undefined {
  if (!file) return t('documents.upload.errors.fileMissing');
  const problem = documentProblem(file, maxBytes);
  if (problem === 'size') return t('documents.upload.errors.size', { size: formatBytes(file.size), max: formatBytes(maxBytes) });
  return problem ? t(problem === 'type' ? 'documents.upload.errors.type' : 'documents.upload.errors.empty') : undefined;
}

/**
 * Errores del backend que van a un campo aunque lleguen sin `field` (un 413 del gateway, por ejemplo): los del
 * archivo y el tipo del catálogo. Los demás (permisos, 404, 429, 503) se explican en el popup.
 */
export const DOCUMENT_ERROR_FIELDS: Partial<Record<string, 'file' | 'type'>> = {
  DOCUMENT_TOO_LARGE: 'file',
  PAYLOAD_TOO_LARGE: 'file',
  DOCUMENT_EMPTY: 'file',
  DOCUMENT_FORMAT_NOT_ALLOWED: 'file',
  DOCUMENT_MACROS_NOT_ALLOWED: 'file',
  DOCUMENT_DAMAGED: 'file',
  DOCUMENT_XML_UNSAFE: 'file',
  DOCUMENT_IMAGE_TOO_LARGE: 'file',
  DOCUMENT_TYPE_INVALID: 'type',
};
