// Documentos de identidad del empleado (onboarding con OCR; decisión del dueño del producto, 2026-10-07): el empleado
// sube el comprobante de domicilio y una identificación oficial; el servidor extrae la información (mejor esfuerzo, OCR
// en el servidor) y la empresa la confirma o corrige en el expediente. El archivo viaja cifrado al bucket de la
// plataforma; el navegador solo habla con la API. El ADMIN de la plataforma NO ve estos datos (regla 13).
import type { SoftDeleted } from './trash';

/** Grupo del requisito de un tipo de documento. */
export type DocumentCategory = 'OFFICIAL_ID' | 'PROOF_OF_ADDRESS';

/** Un tipo de documento del catálogo `employee_document_types` y a qué grupo pertenece. */
export interface DocumentTypeOption {
  /** Código del catálogo (su nombre lo envía el backend ya traducido). */
  code: string;
  category: DocumentCategory;
}

/**
 * Datos que el OCR extrajo (o que la empresa confirmó o corrigió): todo texto, todo opcional (lo que no se leyó es
 * `null` y la empresa lo captura). El número de documento llega descifrado para quien puede verlo.
 */
export interface EmployeeDocumentData {
  full_name: string | null;
  document_number: string | null;
  /** Fecha ISO (`AAAA-MM-DD`) o null. */
  birth_date: string | null;
  expiry_date: string | null;
  nationality: string | null;
  sex: string | null;
  curp: string | null;
  voter_key: string | null;
  postal_code: string | null;
  address: string | null;
}

/** Un documento del empleado (vigente o en «Eliminados»), con su referencia y sus datos. */
export interface EmployeeDocument extends SoftDeleted {
  id: number;
  employee_id: number;
  /** Código del catálogo `employee_document_types`. */
  type: string;
  file_name: string;
  content_type: string;
  /** Bytes: se muestran en MB con `formatBytes` (regla 17). */
  size: number;
  uploaded_by: string;
  /** Lo subió el propio empleado (true) o la empresa (false). */
  uploaded_by_employee: boolean;
  uploaded_at: string;
  /** El servidor procesó la imagen con OCR. */
  ocr_processed: boolean;
  /** Confianza media del OCR (0-1) o null si no se procesó. */
  ocr_confidence: number | null;
  /** Una MRZ (pasaporte/INE) cuadró sus dígitos verificadores. */
  mrz_verified: boolean;
  /** La empresa confirmó los datos (tras revisarlos o corregirlos). */
  confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  data: EmployeeDocumentData;
}

/** El archivo de un documento dentro del contrato único (base64 en `data`). */
export interface EmployeeDocumentFile {
  file_name: string;
  content_type: string;
  size: number;
  data: string;
}

/** Lo que el onboarding del empleado necesita: si la empresa los exige, los tipos y qué falta. */
export interface EmployeeDocumentRequirements {
  required: boolean;
  types: DocumentTypeOption[];
  documents: EmployeeDocument[];
  needs_official_id: boolean;
  needs_proof_of_address: boolean;
}

/** Lo que se envía al subir un documento (multipart: el archivo y su tipo del catálogo). */
export interface EmployeeDocumentInput {
  file: File;
  type: string;
}

/** Lo que devuelve subir: el documento guardado y el mensaje del servidor (ya traducido). */
export interface EmployeeDocumentUploaded {
  document: EmployeeDocument;
  message: string;
}
