import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { pick, renderPage, rowsOf } from '../../test/companyPages';
import { chooseFiles } from '../../test/files';
import { apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../test/http';
import { EmployeeDocumentUploadPage } from './EmployeeDocumentsPages';

const UPLOADED = 'Documento subido.';
const posts = (calls: MockCall[]) => calls.filter((call) => call.init.method === 'POST');
const fail = (status: number, code: string, message: string, field: string | null) =>
  jsonResponse(envelope(null, { status, code, message, errors: [{ code, message, field, details: null }] }), status);

function fileOf(name: string, type: string, size = 2048): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const uploaded = () =>
  apiOk(
    { id: 11, employee_id: 7, type: 'NATIONAL_ID', file_name: 'ine.jpg', content_type: 'image/jpeg', size: 2048, uploaded_by: 'juan@empresa.com', uploaded_by_employee: true, uploaded_at: '2026-10-05T10:00:00Z', ocr_processed: true, ocr_confidence: 0.9, mrz_verified: false, confirmed: false, confirmed_by: null, confirmed_at: null, deleted_at: null, deleted_by: null, data: { full_name: null, document_number: null, birth_date: null, expiry_date: null, nationality: null, sex: null, curp: null, voter_key: null, postal_code: null, address: null } },
    { status: 201, code: 'EMPLOYEE_DOCUMENT_UPLOADED', message: UPLOADED },
  );

function renderUpload(upload: () => Response | Promise<Response> = uploaded) {
  const { calls } = mockFetch(() => upload());
  renderPage('/employee/documents/new', '/employee/documents/new', <EmployeeDocumentUploadPage />, { targets: { '/employee/documents': 'Mis documentos' } });
  return calls;
}

const input = (label = 'Foto o archivo') => screen.getByLabelText(label);
const submit = (label = 'Subir documento') => screen.getByRole('button', { name: label });

describe('Subir un documento del empleado', () => {
  it('elige el archivo y el tipo, confirma, sube y regresa', async () => {
    const calls = renderUpload();
    expect(screen.getByRole('heading', { name: 'Subir documento' })).toBeInTheDocument();
    expect(input()).toHaveAccessibleDescription('Toma una foto o elige un PDF, JPG o PNG de hasta 15.00 MB.');
    chooseFiles(input(), fileOf('ine.jpg', 'image/jpeg'));
    await pick(/Tipo de documento/, /Credencial para votar/);
    await userEvent.click(submit());
    const dialog = await screen.findByRole('dialog', { name: '¿Subir ine.jpg?' });
    expect(rowsOf(dialog, 'Se subirá')).toEqual(['TipoCredencial para votar (INE)', 'Archivoine.jpg']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Subir documento' }));
    expect(await screen.findByText('Mis documentos')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: UPLOADED })).toBeInTheDocument();
    const form = posts(calls)[0].init.body as FormData;
    expect(posts(calls)[0].url).toBe('/api/me/documents');
    expect([(form.get('file') as File).name, form.get('type'), form.has('note')]).toEqual(['ine.jpg', 'NATIONAL_ID', false]);
  });

  it('revisa archivo y tipo antes de preguntar (solo ayuda)', async () => {
    const calls = renderUpload();
    fireEvent.submit(submit().closest('form') as HTMLFormElement);
    const invalid = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(invalid).toHaveTextContent('Elige o toma la foto del documento.');
    expect(invalid).toHaveTextContent('Elige el tipo de documento.');
    await userEvent.click(within(invalid).getByRole('button', { name: 'Entendido' }));
    chooseFiles(input(), fileOf('enorme.jpg', 'image/jpeg', 16 * 1024 * 1024));
    expect(input()).toHaveAccessibleDescription('El archivo pesa 16.00 MB y el máximo es 15.00 MB.');
    expect(posts(calls)).toHaveLength(0);
  });

  it('un rechazo del servidor en el archivo queda en su campo', async () => {
    renderUpload(() => fail(422, 'DOCUMENT_FORMAT_NOT_ALLOWED', 'Elige una foto o un archivo válido.', 'file'));
    chooseFiles(input(), fileOf('ine.jpg', 'image/jpeg'));
    await pick(/Tipo de documento/, /Pasaporte/);
    await userEvent.click(submit());
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Subir ine.jpg?' })).getByRole('button', { name: 'Subir documento' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo subir el documento' })).getByRole('button', { name: 'Entendido' }));
    expect(input()).toHaveAccessibleDescription('Elige una foto o un archivo válido.');
  });

  it('cancelar regresa a la lista sin enviar nada', async () => {
    const calls = renderUpload();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Mis documentos')).toBeInTheDocument();
    await waitFor(() => expect(calls).toHaveLength(0));
  });

  it('en inglés: ayuda y confirmación', async () => {
    await setLocale('en-US');
    renderUpload();
    expect(screen.getByRole('heading', { name: 'Upload document' })).toBeInTheDocument();
    expect(input('Photo or file')).toHaveAccessibleDescription('Take a photo or choose a PDF, JPG, or PNG up to 15.00 MB.');
    chooseFiles(input('Photo or file'), fileOf('ine.jpg', 'image/jpeg'));
    await pick(/Document type/, /Pasaporte/);
    await userEvent.click(submit('Upload document'));
    expect(await screen.findByRole('dialog', { name: 'Upload ine.jpg?' })).toBeInTheDocument();
  });
});
