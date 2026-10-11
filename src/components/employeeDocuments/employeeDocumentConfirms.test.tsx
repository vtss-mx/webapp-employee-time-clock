import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { testCatalogs } from '../../test/catalogs';
import { employeeDocument } from '../../test/documents';
import type { ConfirmDetail } from '../../types/confirm';
import { deleteDocumentConfirm, documentRestore, uploadDocumentConfirm } from './employeeDocumentConfirms';

/*
 * Las confirmaciones de los documentos del empleado se arman al dibujarse (regla 16, cambio de idioma en caliente):
 * la misma función devuelve sus textos en el idioma activo. El nombre del tipo sale del catálogo (ya traducido por el
 * backend), por eso lo recibe como función.
 */

const typeName = (code: string) => testCatalogs.nameOf('employee_document_types', code);
const rows = (details: ConfirmDetail[] = []) => details.map((detail) => (typeof detail === 'string' ? detail : [detail.label, detail.value]));

describe('Confirmaciones de los documentos del empleado', () => {
  it('subir: qué archivo y de qué tipo, con el botón de subir', () => {
    const confirm = uploadDocumentConfirm({ file: new File(['x'], 'ine.jpg', { type: 'image/jpeg' }), type: 'NATIONAL_ID' }, typeName);
    expect([confirm.kind, confirm.title, confirm.message]).toEqual(['create', '¿Subir ine.jpg?', 'Se guarda cifrado y tu empresa lo revisará.']);
    expect([confirm.detailsTitle, confirm.confirmLabel]).toEqual(['Se subirá', 'Subir documento']);
    expect(rows(confirm.details)).toEqual([
      ['Tipo', 'Credencial para votar (INE)'],
      ['Archivo', 'ine.jpg'],
    ]);
  });

  it('eliminar: qué documento es, que se puede subir otro y que pasa a «Eliminados»', () => {
    const confirm = deleteDocumentConfirm(employeeDocument(), typeName);
    expect([confirm.kind, confirm.title, confirm.message]).toEqual(['delete', '¿Eliminar pasaporte.jpg?', 'Podrás subir otro en su lugar.']);
    expect(confirm.note).toBe('Pasará a «Eliminados»: podrás restaurarlo durante 1 año.');
    expect(rows(confirm.details)).toEqual([
      ['Tipo', 'Pasaporte'],
      ['Archivo', 'pasaporte.jpg'],
    ]);
  });

  it('restaurar: qué documento regresa de «Eliminados»', () => {
    const question = documentRestore(employeeDocument({ type: 'PROOF_OF_ADDRESS', file_name: 'luz.pdf' }), typeName);
    expect(question.title).toBe('¿Restaurar luz.pdf?');
    expect(rows(question.details)).toEqual([
      ['Tipo', 'Comprobante de domicilio'],
      ['Archivo', 'luz.pdf'],
    ]);
  });

  it('en inglés: las mismas confirmaciones se arman en el idioma activo', async () => {
    await setLocale('en-US');
    const upload = uploadDocumentConfirm({ file: new File(['x'], 'ine.jpg', { type: 'image/jpeg' }), type: 'NATIONAL_ID' }, typeName);
    expect([upload.title, upload.detailsTitle, upload.confirmLabel]).toEqual(['Upload ine.jpg?', 'Will be uploaded', 'Upload document']);
    expect(rows(upload.details)).toEqual([
      ['Type', 'Credencial para votar (INE)'],
      ['File', 'ine.jpg'],
    ]);
    const remove = deleteDocumentConfirm(employeeDocument(), typeName);
    expect(remove.title).toBe('Delete pasaporte.jpg?');
    expect(documentRestore(employeeDocument(), typeName).title).toBe('Restore pasaporte.jpg?');
  });
});
