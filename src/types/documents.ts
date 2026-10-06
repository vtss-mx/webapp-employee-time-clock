// Documentos de una empresa (decisión del dueño del producto, 2026-10-06): constancia de situación fiscal, acta
// constitutiva, comprobante de domicilio, identificación del representante legal, contratos... para facturarle
// después. El archivo viaja cifrado al bucket de la plataforma; el navegador solo habla con la API (nunca con una URL
// del bucket). El ADMIN los administra desde la ficha de la empresa y la empresa, desde su pantalla «Documentos»:
// mismas rutas y formas bajo `/admin/companies/{id}/documents` y `/documents`.
import type { SoftDeleted } from './trash';

/** Un documento de la empresa (vigente o en «Eliminados»). */
export interface CompanyDocument extends SoftDeleted {
  id: number;
  /** Código del catálogo `company_document_types` (su nombre lo envía el backend ya traducido). */
  type: string;
  /** Nombre original saneado; su extensión es la del formato real. */
  file_name: string;
  /** Formato real detectado por el contenido (p. ej. `application/pdf`). */
  content_type: string;
  /** Bytes: se muestran en MB con `formatBytes` (regla 17). */
  size: number;
  note: string | null;
  /** Correo literal de quien lo subió. */
  uploaded_by: string;
  /** Lo subió el ADMIN de la plataforma (marca «Plataforma»). */
  uploaded_by_platform: boolean;
  /** Instante UTC (se muestra con `formatDateTime`). */
  uploaded_at: string;
  /**
   * Quien lo ve puede eliminarlo Y restaurarlo (lo decide el backend: la empresa, solo lo que ella subió; el ADMIN,
   * todo). La app nunca lo calcula.
   */
  can_delete: boolean;
}

/** El archivo de un documento dentro del contrato único (base64 en `data`, como el comprobante de un pago). */
export interface CompanyDocumentFile {
  file_name: string;
  content_type: string;
  size: number;
  data: string;
}

/** Lo que se envía al subir un documento (multipart: el archivo, su tipo del catálogo y la nota opcional). */
export interface CompanyDocumentInput {
  file: File;
  type: string;
  note: string;
}

/** Lo que devuelve subir: el documento guardado y el mensaje del servidor (ya traducido: el título del aviso). */
export interface CompanyDocumentUploaded {
  document: CompanyDocument;
  message: string;
}
