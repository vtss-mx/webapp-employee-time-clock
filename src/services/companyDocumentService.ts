import type { Page, PageQuery, Restored } from '../types';
import type { CompanyDocument, CompanyDocumentFile, CompanyDocumentInput, CompanyDocumentUploaded } from '../types/documents';
import { config } from '../utils/config';
import { hasKeys, isNothing, isPage } from '../utils/guards';
import { apiEnvelope, apiRequest } from './apiClient';
import { restoreRecord } from './http/restore';

const isDocument = hasKeys<CompanyDocument>('id', 'type', 'file_name', 'content_type', 'size', 'uploaded_by', 'uploaded_at', 'can_delete');
const isDocumentFile = hasKeys<CompanyDocumentFile>('file_name', 'content_type', 'data');

/** Rutas base de los documentos: las del ADMIN (con la empresa) y las de la empresa (la empresa sale de la sesión). */
export const documentsBase = {
  admin: (companyId: number) => `/admin/companies/${companyId}/documents`,
  company: '/documents',
} as const;

/** Lo que se puede hacer con los documentos de una empresa (las mismas operaciones para el ADMIN y la empresa). */
export interface CompanyDocumentApi {
  /** Llave estable de la ruta base (la lista vuelve a la página 1 si cambia la empresa). */
  readonly base: string;
  /** Página de documentos: los vigentes, el más reciente primero, o «Eliminados» (`deleted`), lo último eliminado primero. */
  list(query: PageQuery & { deleted?: boolean }, signal?: AbortSignal): Promise<Page<CompanyDocument>>;
  /** Sube un documento (el backend lo revisa por su contenido y lo guarda cifrado en el bucket). */
  upload(input: CompanyDocumentInput): Promise<CompanyDocumentUploaded>;
  /** El archivo de un documento vigente (base64 dentro del contrato; hasta ~27 MB de JSON). */
  file(id: number): Promise<CompanyDocumentFile>;
  /** Lo pasa a «Eliminados» (se restaura durante 1 año); devuelve el mensaje del servidor (el aviso). */
  remove(id: number): Promise<string>;
  restore(id: number): Promise<Restored<CompanyDocument>>;
}

/** Multipart del documento: el archivo con su nombre, el tipo del catálogo y la nota (solo si se escribió). */
function documentForm({ file, type, note }: CompanyDocumentInput): FormData {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('type', type);
  if (note.trim()) form.append('note', note.trim());
  return form;
}

/**
 * Documentos de una empresa sobre una ruta base (`documentsBase.admin(id)` o `documentsBase.company`): una sola
 * implementación para el ADMIN y la empresa. Subir y descargar usan el tiempo límite de los envíos grandes
 * (`config.apiUploadTimeoutMs`), como la foto de perfil y el comprobante de un pago.
 */
export function companyDocumentService(base: string): CompanyDocumentApi {
  return {
    base,
    list(query, signal) {
      return apiRequest<Page<CompanyDocument>>(base, { query: { ...query }, signal, validate: isPage(isDocument) });
    },
    async upload(input) {
      const { data, message } = await apiEnvelope<CompanyDocument>(base, {
        method: 'POST',
        body: documentForm(input),
        timeoutMs: config.apiUploadTimeoutMs,
        validate: isDocument,
      });
      return { document: data, message };
    },
    file(id) {
      return apiRequest<CompanyDocumentFile>(`${base}/${id}/file`, { timeoutMs: config.apiUploadTimeoutMs, validate: isDocumentFile });
    },
    async remove(id) {
      const { message } = await apiEnvelope<null | undefined>(`${base}/${id}`, { method: 'DELETE', validate: isNothing });
      return message;
    },
    restore(id) {
      return restoreRecord(`${base}/${id}`, isDocument);
    },
  };
}
