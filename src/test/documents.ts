import type { CompanyDocument } from '../types/documents';
import type { EmployeeDocument } from '../types/employeeDocuments';
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

/** Página de documentos (de una empresa o de un empleado: la misma forma del contrato). */
export const documentsPage = <T>(items: T[]) => ({ items, total: items.length, page: 1, size: 10 });

/** Ya en «Eliminados». */
export const trashed = (document: CompanyDocument): CompanyDocument => ({ ...document, deleted_at: '2026-10-06T15:00:00Z', deleted_by: 'ana@empresa.com' });

/** Responde la lista de documentos de la ficha de una empresa (vacía); null si la llamada no es de documentos. */
export function documentsReply(call: MockCall): Response | null {
  return call.url.includes('/documents') ? apiOk(documentsPage([])) : null;
}

/**
 * Un documento de identidad del empleado (el onboarding con OCR; desde el 2026-10-08 es un PASO del registro de
 * identidad). `data` llega con lo que el OCR leyó; la empresa lo confirma o lo corrige en el expediente.
 */
export const employeeDocument = (over: Partial<EmployeeDocument> = {}): EmployeeDocument => ({
  id: 7,
  employee_id: 7,
  type: 'PASSPORT',
  file_name: 'pasaporte.jpg',
  content_type: 'image/jpeg',
  size: 262_144, // 0.25 MB
  uploaded_by: 'ana@empresa.com',
  uploaded_by_employee: true,
  uploaded_at: '2026-10-05T10:00:00Z',
  ocr_processed: true,
  ocr_confidence: 0.91,
  mrz_verified: false,
  confirmed: false,
  confirmed_by: null,
  confirmed_at: null,
  can_delete: true,
  deleted_at: null,
  deleted_by: null,
  data: {
    full_name: 'Ana Ruiz',
    document_number: 'G12345678',
    birth_date: '1990-05-10',
    expiry_date: null,
    nationality: 'MEX',
    sex: 'F',
    curp: null,
    voter_key: null,
    postal_code: null,
    address: null,
  },
  ...over,
});
