import type { CompanyDocument } from '../types/documents';
import { apiOk, type MockCall } from './http';

/** Documentos de las pruebas (como los envía el backend). */
export const taxCertificate: CompanyDocument = {
  id: 11,
  type: 'TAX_CERTIFICATE',
  file_name: 'constancia-fiscal.pdf',
  content_type: 'application/pdf',
  size: 1_258_291, // 1.20 MB
  note: 'Vigente a octubre',
  uploaded_by: 'ana@empresa.com',
  uploaded_by_platform: false,
  uploaded_at: '2026-10-05T16:00:00Z',
  can_delete: true,
  deleted_at: null,
  deleted_by: null,
};

/** Lo subió el ADMIN de la plataforma: la empresa lo descarga, pero no lo elimina ni lo restaura. */
export const platformContract: CompanyDocument = {
  ...taxCertificate,
  id: 12,
  type: 'CONTRACT',
  file_name: 'contrato-servicio.docx',
  content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  size: 524_288, // 0.50 MB
  note: null,
  uploaded_by: 'root@plataforma.com',
  uploaded_by_platform: true,
  can_delete: false,
};

/** Página de documentos. */
export const documentsPage = (items: CompanyDocument[]) => ({ items, total: items.length, page: 1, size: 10 });

/** Ya en «Eliminados». */
export const trashed = (document: CompanyDocument): CompanyDocument => ({ ...document, deleted_at: '2026-10-06T15:00:00Z', deleted_by: 'ana@empresa.com' });

/** Responde la lista de documentos de la ficha de una empresa (vacía); null si la llamada no es de documentos. */
export function documentsReply(call: MockCall): Response | null {
  return call.url.includes('/documents') ? apiOk(documentsPage([])) : null;
}
