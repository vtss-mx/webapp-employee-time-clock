import type { Page, PageQuery, Restored } from '../types';
import type { EmployeeDocument, EmployeeDocumentData, EmployeeDocumentFile, EmployeeDocumentInput, EmployeeDocumentUploaded } from '../types/employeeDocuments';
import { config } from '../utils/config';
import { hasKeys, isNothing, isPage } from '../utils/guards';
import { apiEnvelope, apiRequest } from './apiClient';
import { restoreRecord } from './http/restore';

const isDocument = hasKeys<EmployeeDocument>(
  'id',
  'employee_id',
  'type',
  'file_name',
  'content_type',
  'size',
  'uploaded_at',
  'ocr_processed',
  'mrz_verified',
  'confirmed',
  'can_delete',
  'data',
);
const isDocumentFile = hasKeys<EmployeeDocumentFile>('file_name', 'content_type', 'data');

/** Rutas base: los del propio empleado (la empresa sale de la sesión) y el expediente que revisa la empresa. */
export const employeeDocumentsBase = {
  mine: '/me/documents',
  employee: (employeeId: number) => `/validations/employees/${employeeId}/documents`,
} as const;

/** Multipart del documento: el archivo con su nombre y el tipo del catálogo. */
function documentForm({ file, type }: EmployeeDocumentInput): FormData {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('type', type);
  return form;
}

/** Lo que el EMPLEADO hace con SUS documentos (subir, ver, descargar, eliminar y restaurar). */
export interface MyDocumentApi {
  readonly base: string;
  /** Página de documentos: los vigentes (el más reciente primero) o «Eliminados» (`deleted`). */
  list(query: PageQuery & { deleted?: boolean }, signal?: AbortSignal): Promise<Page<EmployeeDocument>>;
  /** Sube un documento (el backend lo revisa por su contenido, lo lee con OCR y lo guarda cifrado). */
  upload(input: EmployeeDocumentInput): Promise<EmployeeDocumentUploaded>;
  /** El archivo de un documento vigente (base64 dentro del contrato). */
  file(id: number): Promise<EmployeeDocumentFile>;
  /** Lo pasa a «Eliminados» (409 si la empresa ya lo confirmó); devuelve el mensaje del servidor. */
  remove(id: number): Promise<string>;
  restore(id: number): Promise<Restored<EmployeeDocument>>;
}

/** Documentos del PROPIO empleado (`/me/documents`). */
export const myDocumentService: MyDocumentApi = {
  base: employeeDocumentsBase.mine,
  list(query, signal) {
    return apiRequest<Page<EmployeeDocument>>(employeeDocumentsBase.mine, { query: { ...query }, signal, validate: isPage(isDocument) });
  },
  async upload(input) {
    const { data, message } = await apiEnvelope<EmployeeDocument>(employeeDocumentsBase.mine, {
      method: 'POST',
      body: documentForm(input),
      timeoutMs: config.apiUploadTimeoutMs,
      validate: isDocument,
    });
    return { document: data, message };
  },
  file(id) {
    return apiRequest<EmployeeDocumentFile>(`${employeeDocumentsBase.mine}/${id}/file`, { timeoutMs: config.apiUploadTimeoutMs, validate: isDocumentFile });
  },
  async remove(id) {
    const { message } = await apiEnvelope<null | undefined>(`${employeeDocumentsBase.mine}/${id}`, { method: 'DELETE', validate: isNothing });
    return message;
  },
  restore(id) {
    return restoreRecord(`${employeeDocumentsBase.mine}/${id}`, isDocument);
  },
};

/** Lo que la EMPRESA hace con el expediente de un empleado (ver, descargar y confirmar o corregir los datos). */
export interface EmployeeDocumentReviewApi {
  readonly base: string;
  list(query: PageQuery & { deleted?: boolean }, signal?: AbortSignal): Promise<Page<EmployeeDocument>>;
  file(id: number): Promise<EmployeeDocumentFile>;
  /** Confirma o corrige los datos extraídos (solo los campos enviados cambian); devuelve el documento y el aviso. */
  updateData(id: number, changes: Partial<EmployeeDocumentData>): Promise<EmployeeDocumentUploaded>;
}

/** El expediente de un empleado, para la empresa (`/validations/employees/{id}/documents`). */
export function employeeDocumentReview(employeeId: number): EmployeeDocumentReviewApi {
  const base = employeeDocumentsBase.employee(employeeId);
  return {
    base,
    list(query, signal) {
      return apiRequest<Page<EmployeeDocument>>(base, { query: { ...query }, signal, validate: isPage(isDocument) });
    },
    file(id) {
      return apiRequest<EmployeeDocumentFile>(`${base}/${id}/file`, { timeoutMs: config.apiUploadTimeoutMs, validate: isDocumentFile });
    },
    async updateData(id, changes) {
      const { data, message } = await apiEnvelope<EmployeeDocument>(`${base}/${id}/data`, { method: 'PATCH', body: changes, validate: isDocument });
      return { document: data, message };
    },
  };
}
