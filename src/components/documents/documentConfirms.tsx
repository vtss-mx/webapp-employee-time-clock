import { FileUp, Upload } from 'lucide-react';
import { t } from '../../i18n';
import type { CompanyDocument, CompanyDocumentInput } from '../../types/documents';
import type { ConfirmDetail, ConfirmInput } from '../../types/confirm';
import { formatBytes } from '../../utils/numbers';
import { deleteNote } from '../trash/TrashParts';
import type { RestoreQuestion } from '../trash/useRestore';

/*
 * Confirmaciones de los documentos de una empresa (se arman al dibujarse: una confirmación abierta sigue al idioma
 * activo). Subir dice qué se sube y a qué empresa; eliminar y restaurar, qué documento es.
 */

/** Nombre del tipo de documento (del catálogo `company_document_types`, ya traducido por el backend). */
export type DocumentTypeName = (code: string) => string;

/** El documento en una confirmación: su tipo, su nombre y su tamaño (en MB). */
export function documentFacts(document: Pick<CompanyDocument, 'type' | 'file_name' | 'size'>, typeName: DocumentTypeName): ConfirmDetail[] {
  return [
    { label: t('documents.columns.type'), value: typeName(document.type) },
    { label: t('documents.upload.confirm.file'), value: document.file_name },
    { label: t('documents.columns.size'), value: formatBytes(document.size) },
  ];
}

/** Subir: qué se sube (la empresa, en la del ADMIN; el tipo, el archivo, su tamaño y la nota si se escribió). */
export function uploadDocumentConfirm({ file, type, note }: CompanyDocumentInput, typeName: DocumentTypeName, company?: string): ConfirmInput {
  const details: ConfirmDetail[] = [
    ...(company ? [{ label: t('common.fields.company'), value: company }] : []),
    ...documentFacts({ type, file_name: file.name, size: file.size }, typeName),
    ...(note.trim() ? [{ label: t('common.fields.note'), value: note.trim() }] : []),
  ];
  return {
    kind: 'create',
    icon: <FileUp size={30} />,
    title: t('documents.upload.confirm.title', { name: file.name }),
    message: t('documents.upload.confirm.message'),
    detailsTitle: t('documents.upload.confirm.detailsTitle'),
    details,
    confirmLabel: t('documents.add'),
    confirmIcon: <Upload size={18} />,
  };
}

/** Eliminar: qué documento es y que pasa a «Eliminados» (se restaura durante 1 año). */
export function deleteDocumentConfirm(document: CompanyDocument, typeName: DocumentTypeName): ConfirmInput {
  return {
    kind: 'delete',
    title: t('documents.remove.title', { name: document.file_name }),
    message: t('documents.remove.message'),
    details: documentFacts(document, typeName),
    note: deleteNote(),
  };
}

/** Restaurar: qué documento regresa de «Eliminados». */
export const documentRestore = (document: CompanyDocument, typeName: DocumentTypeName): RestoreQuestion => ({
  title: t('documents.restoreTitle', { name: document.file_name }),
  details: documentFacts(document, typeName),
});
