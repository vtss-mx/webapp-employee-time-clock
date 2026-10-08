import { FileCheck, FileUp, Upload } from 'lucide-react';
import { t } from '../../i18n';
import type { ConfirmDetail, ConfirmInput } from '../../types/confirm';
import type { EmployeeDocument, EmployeeDocumentInput } from '../../types/employeeDocuments';
import { deleteNote } from '../trash/TrashParts';
import type { RestoreQuestion } from '../trash/useRestore';

/*
 * Confirmaciones de los documentos de identidad del empleado (se arman al dibujarse: siguen al idioma activo). Subir
 * dice qué se sube; eliminar y restaurar, qué documento; confirmar los datos (empresa), de qué documento.
 */

/** Nombre del tipo de documento (del catálogo `employee_document_types`, ya traducido por el backend). */
export type EmployeeDocumentTypeName = (code: string) => string;

/** El documento en una confirmación: su tipo y su nombre. */
export function documentFacts(document: Pick<EmployeeDocument, 'type' | 'file_name'>, typeName: EmployeeDocumentTypeName): ConfirmDetail[] {
  return [
    { label: t('employeeDocuments.columns.type'), value: typeName(document.type) },
    { label: t('employeeDocuments.upload.confirm.file'), value: document.file_name },
  ];
}

/** Subir: qué se sube (el tipo y el archivo). */
export function uploadDocumentConfirm({ file, type }: EmployeeDocumentInput, typeName: EmployeeDocumentTypeName): ConfirmInput {
  return {
    kind: 'create',
    icon: <FileUp size={30} />,
    title: t('employeeDocuments.upload.confirm.title', { name: file.name }),
    message: t('employeeDocuments.upload.confirm.message'),
    detailsTitle: t('employeeDocuments.upload.confirm.detailsTitle'),
    details: documentFacts({ type, file_name: file.name }, typeName),
    confirmLabel: t('employeeDocuments.add'),
    confirmIcon: <Upload size={18} />,
  };
}

/** Eliminar: qué documento es y que pasa a «Eliminados». */
export function deleteDocumentConfirm(document: EmployeeDocument, typeName: EmployeeDocumentTypeName): ConfirmInput {
  return {
    kind: 'delete',
    title: t('employeeDocuments.remove.title', { name: document.file_name }),
    message: t('employeeDocuments.remove.message'),
    details: documentFacts(document, typeName),
    note: deleteNote(),
  };
}

/** Restaurar: qué documento regresa de «Eliminados». */
export const documentRestore = (document: EmployeeDocument, typeName: EmployeeDocumentTypeName): RestoreQuestion => ({
  title: t('employeeDocuments.restoreTitle', { name: document.file_name }),
  details: documentFacts(document, typeName),
});

/** Confirmar los datos (empresa): de qué documento y que queda registrado quién lo revisó. */
export function confirmDataConfirm(document: EmployeeDocument, typeName: EmployeeDocumentTypeName): ConfirmInput {
  return {
    kind: 'edit',
    icon: <FileCheck size={30} />,
    title: t('employeeDocuments.review.confirm.title', { name: document.file_name }),
    message: t('employeeDocuments.review.confirm.message'),
    details: documentFacts(document, typeName),
    confirmLabel: t('employeeDocuments.review.save'),
    confirmIcon: <FileCheck size={18} />,
  };
}
