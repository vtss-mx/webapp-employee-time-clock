import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { DOCUMENT_ACCEPT, documentFileError, documentMaxBytes, documentProblem } from './companyDocuments';

const MB = 1024 * 1024;
const fileOf = (name: string, type = '', size = 10) => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('documentos de una empresa: revisión antes de subir (solo ayuda)', () => {
  it('formatos por extensión (sin importar mayúsculas) o por tipo; el selector ofrece los mismos', () => {
    expect(documentProblem(fileOf('ACTA.PDF'))).toBeNull();
    expect(documentProblem(fileOf('foto.jpeg'))).toBeNull();
    expect(documentProblem(fileOf('factura.xml'))).toBeNull();
    expect(documentProblem(fileOf('escaneo', 'image/png'))).toBeNull();
    expect(documentProblem(fileOf('archivo.zip', 'application/zip'))).toBe('type');
    expect(documentProblem(fileOf('sin-extension'))).toBe('type');
    expect(DOCUMENT_ACCEPT.split(',')).toEqual(expect.arrayContaining(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.xml', '.jpg', '.png', 'application/pdf']));
  });

  it('vacío y tamaño máximo (el del .env, en MB)', () => {
    expect(documentMaxBytes()).toBe(20 * MB);
    expect(documentProblem(fileOf('a.pdf', '', 0))).toBe('empty');
    expect(documentProblem(fileOf('a.pdf', '', 20 * MB))).toBeNull();
    expect(documentProblem(fileOf('a.pdf', '', 20 * MB + 1))).toBe('size');
    expect(documentProblem(fileOf('a.pdf', '', 3 * MB), 2 * MB)).toBe('size');
  });

  it('el texto de cada problema, en el idioma activo', async () => {
    expect(documentFileError(null)).toBe('Elige el archivo que vas a subir.');
    expect(documentFileError(fileOf('a.pdf'))).toBeUndefined();
    expect(documentFileError(fileOf('a.pdf', '', 25 * MB))).toBe('El archivo pesa 25.00 MB y el máximo es 20.00 MB.');
    await setLocale('en-US');
    expect(documentFileError(fileOf('a.pdf', '', 0))).toBe('The file is empty. Choose another one.');
    expect(documentFileError(fileOf('a.exe'))).toBe('Choose a PDF, Word, Excel, XML, JPG or PNG file.');
  });
});
