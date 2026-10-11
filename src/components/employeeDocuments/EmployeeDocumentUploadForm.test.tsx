import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { pick, renderPage, rowsOf, settle } from '../../test/companyPages';
import { employeeDocument } from '../../test/documents';
import { chooseFiles } from '../../test/files';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../test/http';
import { employeeDocumentMaxBytes } from '../../utils/employeeDocuments';
import { formatBytes } from '../../utils/numbers';
import { EmployeeDocumentUploadForm } from './EmployeeDocumentUploadForm';

/*
 * Subir un documento de identidad (el formulario del paso de documentos del registro). El escáner de la cámara se
 * sustituye por un doble: aquí se prueba el formulario (archivo, tipo, confirmación, avance y cada respuesta del
 * servidor), no la cámara, que tiene su propia prueba (`DocumentScanner.test.tsx`).
 */
vi.mock('../DocumentScanner', () => ({
  DocumentScanner: ({ onCapture, onCancel }: { onCapture: (file: File) => void; onCancel: () => void }) => (
    <div data-testid="scanner">
      <button onClick={() => onCapture(new File(['foto'], 'foto.jpg', { type: 'image/jpeg' }))}>capturar</button>
      <button onClick={onCancel}>cerrar escáner</button>
    </div>
  ),
}));

const UPLOADED = 'Documento subido. Tu empresa lo revisará.';
const BACK = '/registro/documentos';
const HINT = `Toma una foto o elige un PDF, JPG o PNG de hasta ${formatBytes(employeeDocumentMaxBytes())}.`;

const uploaded = () => apiOk(employeeDocument(), { status: 201, code: 'EMPLOYEE_DOCUMENT_UPLOADED', message: UPLOADED });
const notRecognized = () => apiFail(422, 'DOCUMENT_NOT_RECOGNIZED', 'No pudimos leer el documento. Toma la foto completa y sin reflejos.');
const posts = (calls: MockCall[]) => calls.filter((call) => call.init.method === 'POST');

/** Un archivo con el tamaño que se pide (sin reservar los bytes). */
function fileOf(name: string, type: string, size = 2048): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** El formulario del paso, con los tipos que ese paso acepta (vacío = los activos del catálogo). */
function renderForm(reply: () => Response | Promise<Response> = uploaded, types: readonly string[] = ['PASSPORT', 'PROOF_OF_ADDRESS']) {
  const { calls } = mockFetch(() => reply());
  renderPage('/registro/documentos/nuevo', '/registro/documentos/nuevo', <EmployeeDocumentUploadForm types={types} backTo={BACK} backLabel="Volver al registro" />, {
    targets: { [BACK]: 'Pantalla del paso' },
  });
  return calls;
}

const fileInput = () => screen.getByLabelText('Foto o archivo');
const submit = () => screen.getByRole('button', { name: 'Subir documento' });
const send = () => fireEvent.submit(submit().closest('form') as HTMLFormElement);
/** Envía y confirma («¿Subir …?»): el único camino para que algo se suba. */
async function confirmUpload(name: string) {
  await userEvent.click(submit());
  await userEvent.click(within(await screen.findByRole('dialog', { name: `¿Subir ${name}?` })).getByRole('button', { name: 'Subir documento' }));
}

describe('Subir un documento de identidad del empleado', () => {
  it('elige el archivo y el tipo, confirma qué se sube, muestra el avance y regresa al paso con el aviso del servidor', async () => {
    let release: (response: Response) => void = () => undefined;
    const calls = renderForm(() => new Promise<Response>((resolve) => (release = resolve)));
    expect(screen.getByRole('heading', { name: 'Subir documento' })).toBeInTheDocument();
    expect(screen.getByText('Toma una foto o elige un archivo; lo leemos para rellenar tus datos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al registro' })).toHaveAttribute('href', BACK);
    expect(fileInput()).toHaveAccessibleDescription(HINT);
    expect(fileInput()).toHaveAttribute('accept', expect.stringContaining('.pdf'));

    chooseFiles(fileInput(), fileOf('ine.jpg', 'image/jpeg', 3 * 1024 * 1024));
    expect(screen.getByText('ine.jpg')).toBeInTheDocument();
    expect(screen.getByText('3.00 MB')).toBeInTheDocument();
    await pick(/Tipo de documento/, /Pasaporte/);

    await userEvent.click(submit());
    let dialog = await screen.findByRole('dialog', { name: '¿Subir ine.jpg?' });
    expect(dialog).toHaveTextContent('Se guarda cifrado y tu empresa lo revisará.');
    expect(rowsOf(dialog, 'Se subirá')).toEqual(['TipoPasaporte', 'Archivoine.jpg']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(posts(calls)).toHaveLength(0); // cancelar no envía nada

    await userEvent.click(submit());
    dialog = await screen.findByRole('dialog', { name: '¿Subir ine.jpg?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Subir documento' }));
    expect(await screen.findByText('Validando documento…')).toHaveAttribute('role', 'status');
    expect(submit()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeDisabled();
    const form = posts(calls)[0].init.body as FormData;
    expect(posts(calls)[0].url).toBe('/api/me/documents');
    expect([(form.get('file') as File).name, form.get('type')]).toEqual(['ine.jpg', 'PASSPORT']);

    await settle(() => release(uploaded()));
    expect(await screen.findByText('Pantalla del paso')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: UPLOADED })).toBeInTheDocument();
  });

  it('revisa el archivo y el tipo antes de preguntar (solo ayuda): falta, formato, vacío y tamaño en MB', async () => {
    const calls = renderForm();
    send();
    let invalid = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(invalid).toHaveTextContent('Elige o toma la foto del documento.');
    expect(invalid).toHaveTextContent('Elige el tipo de documento.');
    await userEvent.click(within(invalid).getByRole('button', { name: 'Entendido' }));
    expect(fileInput()).toHaveAccessibleDescription('Elige o toma la foto del documento.');
    expect(screen.getByText('Elige el tipo de documento.')).toHaveClass('field__error');

    chooseFiles(fileInput(), fileOf('video.mp4', 'video/mp4'));
    expect(fileInput()).toHaveAccessibleDescription('Elige una foto o un archivo PDF, JPG o PNG.');
    chooseFiles(fileInput(), fileOf('vacio.pdf', 'application/pdf', 0));
    expect(fileInput()).toHaveAccessibleDescription('El archivo está vacío. Elige otro.');
    chooseFiles(fileInput(), fileOf('enorme.jpg', 'image/jpeg', 30 * 1024 * 1024));
    expect(fileInput()).toHaveAccessibleDescription(`El archivo pesa 30.00 MB y el máximo es ${formatBytes(employeeDocumentMaxBytes())}.`);

    // Con el tipo ya elegido, el resumen solo dice lo del archivo; nada se envía.
    await pick(/Tipo de documento/, /Comprobante de domicilio/);
    send();
    invalid = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(invalid).toHaveTextContent('El archivo pesa 30.00 MB');
    expect(invalid).not.toHaveTextContent('Elige el tipo de documento.');
    await userEvent.click(within(invalid).getByRole('button', { name: 'Entendido' }));

    // Quitar el archivo deja el aviso de que falta elegirlo (ya se intentó enviar).
    chooseFiles(fileInput(), fileOf('luz.pdf', 'application/pdf'));
    expect(fileInput()).toHaveAccessibleDescription(HINT);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar archivo' }));
    expect(fileInput()).toHaveAccessibleDescription('Elige o toma la foto del documento.');
    send();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Revisa los datos' })).getByRole('button', { name: 'Entendido' }));
    expect(posts(calls)).toHaveLength(0);
  });

  it('solo ofrece los tipos del paso; sin lista del paso (un backend anterior) ofrece todos los activos', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /Tipo de documento/ }));
    // Cada opción con su aclaración del catálogo; ningún otro tipo activo se ofrece.
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'PasaporteDocumento de viaje internacional con fotografía.',
      'Comprobante de domicilioRecibo reciente de luz, agua o teléfono.',
    ]);
    await userEvent.keyboard('{Escape}');

    renderForm(uploaded, []);
    await userEvent.click(screen.getAllByRole('button', { name: /Tipo de documento/ })[1]);
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(5);
  });

  it('la cámara: cancelar vuelve al formulario sin perder lo escrito y la foto queda como el archivo del formulario', async () => {
    renderForm();
    await pick(/Tipo de documento/, /Pasaporte/);
    await userEvent.click(screen.getByRole('button', { name: 'Tomar foto' }));
    await userEvent.click(within(screen.getByTestId('scanner')).getByRole('button', { name: 'cerrar escáner' }));
    expect(screen.getByRole('heading', { name: 'Subir documento' })).toBeInTheDocument();
    expect(screen.getByText('Pasaporte')).toHaveClass('select__value'); // el tipo elegido se conserva

    await userEvent.click(screen.getByRole('button', { name: 'Tomar foto' }));
    await userEvent.click(within(screen.getByTestId('scanner')).getByRole('button', { name: 'capturar' }));
    expect(screen.getByText('foto.jpg')).toBeInTheDocument();
    expect(fileInput()).toHaveAccessibleDescription(HINT);
  });

  it('un documento no reconocido (422) no es terminal: con la foto de la cámara ofrece volver a tomarla y reabre el escáner', async () => {
    const calls = renderForm(notRecognized);
    await pick(/Tipo de documento/, /Pasaporte/);
    await userEvent.click(screen.getByRole('button', { name: 'Tomar foto' }));
    await userEvent.click(within(screen.getByTestId('scanner')).getByRole('button', { name: 'capturar' }));
    await confirmUpload('foto.jpg');

    const dialog = await screen.findByRole('alertdialog', { name: 'Documento no reconocido' });
    expect(dialog).toHaveTextContent('No pudimos leer el documento. Toma la foto completa y sin reflejos.');
    // La foto salió de la cámara: «Volver a tomar la foto» es la acción principal (la última).
    expect(
      within(dialog)
        .getAllByRole('button', { name: /Volver a tomar la foto|Elegir otro archivo/ })
        .map((button) => button.textContent),
    ).toEqual(['Elegir otro archivo', 'Volver a tomar la foto']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Volver a tomar la foto' }));
    expect(await screen.findByTestId('scanner')).toBeInTheDocument();
    expect(posts(calls)).toHaveLength(1); // no guardó nada: se vuelve a intentar
    // El archivo no quedó marcado con un error de campo (no es un rechazo del archivo).
    await userEvent.click(within(screen.getByTestId('scanner')).getByRole('button', { name: 'capturar' }));
    expect(fileInput()).toHaveAccessibleDescription(HINT);
  });

  it('un documento no reconocido con un archivo elegido ofrece elegir otro (abre el selector) y cerrar el aviso conserva el formulario', async () => {
    const open = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    renderForm(notRecognized);
    chooseFiles(fileInput(), fileOf('ine.jpg', 'image/jpeg'));
    await pick(/Tipo de documento/, /Pasaporte/);
    await confirmUpload('ine.jpg');

    let dialog = await screen.findByRole('alertdialog', { name: 'Documento no reconocido' });
    expect(
      within(dialog)
        .getAllByRole('button', { name: /Volver a tomar la foto|Elegir otro archivo/ })
        .map((button) => button.textContent),
    ).toEqual(['Volver a tomar la foto', 'Elegir otro archivo']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Elegir otro archivo' }));
    expect(open).toHaveBeenCalled(); // el selector del sistema, desde el clic de la persona
    expect(screen.queryByTestId('scanner')).toBeNull();

    // Cerrar el aviso sin elegir nada deja el formulario tal cual (nunca un callejón sin salida).
    await confirmUpload('ine.jpg');
    dialog = await screen.findByRole('alertdialog', { name: 'Documento no reconocido' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByText('ine.jpg')).toBeInTheDocument();
    expect(submit()).not.toBeDisabled();
  });

  it('un rechazo del archivo (413 del gateway, sin campo) va al campo y al popup; una falla de red solo al popup', async () => {
    let reply: () => Response = () => jsonResponse(envelope(null, { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'El archivo pasa del máximo.', errors: [] }), 413);
    renderForm(() => reply());
    chooseFiles(fileInput(), fileOf('ine.jpg', 'image/jpeg'));
    await pick(/Tipo de documento/, /Pasaporte/);
    await confirmUpload('ine.jpg');
    let popup = await screen.findByRole('alertdialog', { name: 'No se pudo subir el documento' });
    expect(popup).toHaveTextContent('El archivo pasa del máximo.');
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    expect(fileInput()).toHaveAccessibleDescription('El archivo pasa del máximo.');

    // El tipo rechazado por el servidor queda en SU campo.
    reply = () => jsonResponse(envelope(null, { status: 422, code: 'DOCUMENT_TYPE_INVALID', message: 'Ese tipo no se pide en este paso.', errors: [{ code: 'DOCUMENT_TYPE_INVALID', message: 'Ese tipo no se pide en este paso.', field: 'type', details: null }] }), 422);
    chooseFiles(fileInput(), fileOf('ine2.jpg', 'image/jpeg'));
    await confirmUpload('ine2.jpg');
    popup = await screen.findByRole('alertdialog', { name: 'No se pudo subir el documento' });
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Ese tipo no se pide en este paso.')).toHaveClass('field__error');
    expect(fileInput()).toHaveAccessibleDescription(HINT);

    // Sin red (ni contrato ni código): solo el popup, y el archivo sigue sin error de campo.
    mockFetch();
    await confirmUpload('ine2.jpg');
    popup = await screen.findByRole('alertdialog', { name: 'No se pudo subir el documento' });
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    expect(fileInput()).toHaveAccessibleDescription(HINT);
    await waitFor(() => expect(submit()).not.toBeDisabled());
  });

  it('cancelar regresa al paso sin enviar nada', async () => {
    const calls = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Pantalla del paso')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
