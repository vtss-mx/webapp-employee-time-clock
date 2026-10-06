import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { catalogsWith, catalogsFixture } from '../../test/catalogs';
import { pick, renderPage, rowsOf, settle } from '../../test/companyPages';
import { taxCertificate } from '../../test/documents';
import { chooseFiles } from '../../test/files';
import { apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../test/http';
import type { CatalogApi } from '../../utils/catalogs';
import { DocumentUploadPage } from './DocumentsPages';

const UPLOADED = 'Documento subido.';
const posts = (calls: MockCall[]) => calls.filter((call) => call.init.method === 'POST');
const fail = (status: number, code: string, message: string, field: string | null) =>
  jsonResponse(envelope(null, { status, code, message, errors: [{ code, message, field, details: null }] }), status);

/** Un archivo con el tamaño que se pide (sin reservar los bytes). */
function fileOf(name: string, type: string, size = 2048): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const uploaded = () => apiOk(taxCertificate, { status: 201, code: 'COMPANY_DOCUMENT_UPLOADED', message: UPLOADED });

function renderUpload(upload: () => Response | Promise<Response> = uploaded, catalogs?: CatalogApi) {
  const { calls } = mockFetch(() => upload());
  renderPage('/company/documents/new', '/company/documents/new', <DocumentUploadPage />, { targets: { '/company/documents': 'Lista de documentos' }, catalogs });
  return calls;
}

const input = (label = 'Documento') => screen.getByLabelText(label);
const submit = (label = 'Subir documento') => screen.getByRole('button', { name: label });
const send = () => fireEvent.submit(submit().closest('form') as HTMLFormElement);

describe('Subir un documento de la empresa', () => {
  it('elige el archivo, el tipo y una nota; confirma qué se sube; mientras sube muestra el avance; avisa y regresa', async () => {
    let release: (response: Response) => void = () => undefined;
    const calls = renderUpload(() => new Promise<Response>((resolve) => (release = resolve)));
    expect(screen.getByRole('heading', { name: 'Subir documento' })).toBeInTheDocument();
    expect(screen.getByText('Se guarda cifrado y solo se descarga desde la aplicación.')).toBeInTheDocument();
    expect(input()).toHaveAccessibleDescription('PDF, Word, Excel, XML, JPG o PNG de hasta 20.00 MB.');
    expect(input()).toHaveAttribute('accept', expect.stringContaining('.docx'));
    chooseFiles(input(), fileOf('acta.pdf', 'application/pdf', 3 * 1024 * 1024));
    expect(screen.getByText('acta.pdf')).toBeInTheDocument();
    expect(screen.getByText('3.00 MB')).toBeInTheDocument();
    await pick(/Tipo de documento/, /Acta constitutiva/);
    await userEvent.type(screen.getByLabelText('Nota'), '  Protocolizada en 2019  ');

    await userEvent.click(submit());
    let dialog = await screen.findByRole('dialog', { name: '¿Subir acta.pdf?' });
    expect(dialog).toHaveTextContent('Se guardará cifrado en los documentos de la empresa.');
    expect(rowsOf(dialog, 'Se subirá')).toEqual(['TipoActa constitutiva', 'Archivoacta.pdf', 'Tamaño3.00 MB', 'NotaProtocolizada en 2019']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(posts(calls)).toHaveLength(0);

    await userEvent.click(submit());
    dialog = await screen.findByRole('dialog', { name: '¿Subir acta.pdf?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Subir documento' }));
    expect(await screen.findByText('Subiendo el documento…')).toHaveAttribute('role', 'status');
    expect(submit()).toBeDisabled();
    const form = posts(calls)[0].init.body as FormData;
    expect(posts(calls)[0].url).toBe('/api/documents');
    expect([(form.get('file') as File).name, form.get('type'), form.get('note')]).toEqual(['acta.pdf', 'INCORPORATION', 'Protocolizada en 2019']);
    await settle(() => release(uploaded()));
    expect(await screen.findByText('Lista de documentos')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: UPLOADED })).toBeInTheDocument();
  });

  it('sin nota no se envía la nota; solo se ofrecen los tipos activos', async () => {
    const types = catalogsFixture.company_document_types.map((item) => (item.code === 'OTHER' ? { ...item, active: false } : item));
    const calls = renderUpload(uploaded, catalogsWith({ company_document_types: types }));
    chooseFiles(input(), fileOf('domicilio.png', 'image/png'));
    await userEvent.click(screen.getByRole('button', { name: /Tipo de documento/ }));
    // Cada opción con su aclaración del catálogo; el tipo inactivo no se ofrece.
    const options = within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toContain('Comprobante de domicilioRecibo reciente de luz, agua o teléfono.');
    expect(options).toHaveLength(5);
    expect(options.some((option) => option?.startsWith('Otro'))).toBe(false);
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Comprobante de domicilio/ }));
    await userEvent.click(submit());
    const dialog = await screen.findByRole('dialog', { name: '¿Subir domicilio.png?' });
    expect(rowsOf(dialog, 'Se subirá')).toEqual(['TipoComprobante de domicilio', 'Archivodomicilio.png', 'Tamaño< 0.01 MB']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Subir documento' }));
    await screen.findByText('Lista de documentos');
    const form = posts(calls)[0].init.body as FormData;
    expect([form.get('type'), form.has('note')]).toEqual(['PROOF_OF_ADDRESS', false]);
  });

  it('revisa el archivo y el tipo antes de preguntar (solo ayuda): falta, formato, vacío y tamaño en MB', async () => {
    const calls = renderUpload();
    send();
    let invalid = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(invalid).toHaveTextContent('Elige el archivo que vas a subir.');
    expect(invalid).toHaveTextContent('Elige el tipo de documento.');
    await userEvent.click(within(invalid).getByRole('button', { name: 'Entendido' }));
    expect(input()).toHaveAccessibleDescription('Elige el archivo que vas a subir.');
    expect(screen.getByText('Elige el tipo de documento.')).toHaveClass('field__error');

    chooseFiles(input(), fileOf('macro.exe', 'application/x-msdownload'));
    expect(input()).toHaveAccessibleDescription('Elige un archivo PDF, Word, Excel, XML, JPG o PNG.');
    chooseFiles(input(), fileOf('vacio.xml', 'text/xml', 0));
    expect(input()).toHaveAccessibleDescription('El archivo está vacío. Elige otro.');
    chooseFiles(input(), fileOf('enorme.xlsx', '', 21 * 1024 * 1024));
    expect(input()).toHaveAccessibleDescription('El archivo pesa 21.00 MB y el máximo es 20.00 MB.');
    await pick(/Tipo de documento/, /Otro/);
    send();
    invalid = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(invalid).toHaveTextContent('El archivo pesa 21.00 MB y el máximo es 20.00 MB.');
    expect(invalid).not.toHaveTextContent('Elige el tipo de documento.');
    await userEvent.click(within(invalid).getByRole('button', { name: 'Entendido' }));
    // Un archivo sin extensión conocida pero con su tipo se acepta (el servidor decide por el contenido).
    chooseFiles(input(), fileOf('escaneo', 'image/jpeg'));
    expect(input()).toHaveAccessibleDescription('PDF, Word, Excel, XML, JPG o PNG de hasta 20.00 MB.');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar archivo' }));
    expect(input()).toHaveAccessibleDescription('Elige el archivo que vas a subir.');
    expect(posts(calls)).toHaveLength(0);
  });

  it('los rechazos del servidor van a su campo (archivo o tipo); cambiar el archivo descarta el del archivo', async () => {
    let reply = () => fail(422, 'DOCUMENT_MACROS_NOT_ALLOWED', 'El archivo tiene macros: guárdalo sin ellas.', 'file');
    renderUpload(() => reply());
    chooseFiles(input(), fileOf('reporte.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    await pick(/Tipo de documento/, /Contrato/);
    const upload = async () => {
      await userEvent.click(submit());
      await userEvent.click(within(await screen.findByRole('dialog', { name: /^¿Subir reporte/ })).getByRole('button', { name: 'Subir documento' }));
    };
    await upload();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo subir el documento' });
    expect(popup).toHaveTextContent('El archivo tiene macros: guárdalo sin ellas.');
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    expect(input()).toHaveAccessibleDescription('El archivo tiene macros: guárdalo sin ellas.');
    // Con el mismo archivo rechazado no se vuelve a intentar: se pide otro.
    send();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Revisa los datos' })).getByRole('button', { name: 'Entendido' }));
    chooseFiles(input(), fileOf('reporte-limpio.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    expect(input()).toHaveAccessibleDescription('PDF, Word, Excel, XML, JPG o PNG de hasta 20.00 MB.');

    // Un 413 del gateway llega sin campo: igual se marca en el archivo.
    reply = () => fail(413, 'PAYLOAD_TOO_LARGE', 'El archivo pasa del máximo de 20 MB.', null);
    await upload();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo subir el documento' })).getByRole('button', { name: 'Entendido' }));
    expect(input()).toHaveAccessibleDescription('El archivo pasa del máximo de 20 MB.');
    chooseFiles(input(), fileOf('reporte-chico.xlsx', 'application/vnd.ms-excel'));

    reply = () => fail(422, 'DOCUMENT_TYPE_INVALID', 'Elige un tipo de documento válido.', 'type');
    await upload();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo subir el documento' })).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Elige un tipo de documento válido.')).toHaveClass('field__error');
    expect(input()).toHaveAccessibleDescription('PDF, Word, Excel, XML, JPG o PNG de hasta 20.00 MB.');
  });

  it('una falla que no es de un campo (bucket no disponible) solo se explica en el popup y se puede reintentar', async () => {
    renderUpload(() => fail(503, 'STORAGE_UNAVAILABLE', 'El almacenamiento no está disponible. Intenta de nuevo.', null));
    chooseFiles(input(), fileOf('acta.pdf', 'application/pdf'));
    await pick(/Tipo de documento/, /Acta constitutiva/);
    await userEvent.click(submit());
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Subir acta.pdf?' })).getByRole('button', { name: 'Subir documento' }));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo subir el documento' });
    expect(popup).toHaveTextContent('El almacenamiento no está disponible. Intenta de nuevo.');
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    expect(input()).toHaveAccessibleDescription('PDF, Word, Excel, XML, JPG o PNG de hasta 20.00 MB.');
    await waitFor(() => expect(submit()).not.toBeDisabled());
  });

  it('cancelar regresa a la lista sin enviar nada', async () => {
    const calls = renderUpload();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Lista de documentos')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('en inglés: ayuda, errores del archivo y la confirmación', async () => {
    await setLocale('en-US');
    renderUpload();
    expect(screen.getByRole('heading', { name: 'Upload document' })).toBeInTheDocument();
    expect(input('Document')).toHaveAccessibleDescription('PDF, Word, Excel, XML, JPG or PNG up to 20.00 MB.');
    chooseFiles(input('Document'), fileOf('photo.gif', 'image/gif'));
    expect(input('Document')).toHaveAccessibleDescription('Choose a PDF, Word, Excel, XML, JPG or PNG file.');
    chooseFiles(input('Document'), fileOf('acta.pdf', 'application/pdf'));
    await pick(/Document type/, /Acta constitutiva/);
    await userEvent.type(screen.getByLabelText('Note'), 'Signed');
    await userEvent.click(submit('Upload document'));
    const dialog = await screen.findByRole('dialog', { name: 'Upload acta.pdf?' });
    expect(rowsOf(dialog, 'Will be uploaded')).toEqual(['TypeActa constitutiva', 'Fileacta.pdf', 'Size< 0.01 MB', 'NoteSigned']);
  });
});
