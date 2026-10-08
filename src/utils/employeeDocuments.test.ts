import { describe, expect, it } from 'vitest';
import { EMPLOYEE_DOCUMENT_ACCEPT, employeeDocumentFileError, employeeDocumentMaxBytes } from './employeeDocuments';

const MB = 1024 * 1024;
const fileOf = (name: string, type = '', size = 10) => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('documentos de identidad del empleado: revisión antes de subir (solo ayuda)', () => {
  it('tope en MB del .env y el selector ofrece los mismos formatos que la empresa', () => {
    expect(employeeDocumentMaxBytes()).toBe(15 * MB);
    expect(EMPLOYEE_DOCUMENT_ACCEPT.split(',')).toEqual(expect.arrayContaining(['.pdf', '.jpg', '.png', 'image/jpeg']));
  });

  it('el texto de cada problema, en el idioma activo (falta, formato, vacío y tamaño)', () => {
    expect(employeeDocumentFileError(null)).toBe('Elige o toma la foto del documento.');
    expect(employeeDocumentFileError(fileOf('ine.jpg', 'image/jpeg', 2048))).toBeUndefined();
    // Las dos ramas del problema que no es de tamaño: formato no reconocido y archivo vacío.
    expect(employeeDocumentFileError(fileOf('virus.exe'))).toBe('Elige una foto o un archivo PDF, JPG o PNG.');
    expect(employeeDocumentFileError(fileOf('vacio.pdf', '', 0))).toBe('El archivo está vacío. Elige otro.');
    expect(employeeDocumentFileError(fileOf('enorme.jpg', 'image/jpeg', 16 * MB))).toBe('El archivo pesa 16.00 MB y el máximo es 15.00 MB.');
  });
});
