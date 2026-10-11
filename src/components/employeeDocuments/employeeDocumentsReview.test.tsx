import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES, setLocale, t } from '../../i18n/core';
import { renderPage } from '../../test/companyPages';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../test/http';
import type { EmployeeDocument } from '../../types/employeeDocuments';
import { EmployeeDocumentsReview } from './EmployeeDocumentsReview';

const SAVED = 'Datos guardados';

const doc = (over: Partial<EmployeeDocument> = {}): EmployeeDocument => ({
  id: 11,
  employee_id: 7,
  type: 'NATIONAL_ID',
  file_name: 'ine.jpg',
  content_type: 'image/jpeg',
  size: 480000,
  uploaded_by: 'juan@empresa.com',
  uploaded_by_employee: true,
  uploaded_at: '2026-10-05T10:00:00Z',
  ocr_processed: true,
  ocr_confidence: 0.91,
  mrz_verified: false,
  confirmed: false,
  confirmed_by: null,
  confirmed_at: null,
  can_delete: true,
  deleted_at: null,
  deleted_by: null,
  data: { full_name: 'Juan', document_number: 'PEXJ900510HSRRNN09', birth_date: '1990-05-10', expiry_date: null, nationality: 'MEX', sex: 'M', curp: 'PEXJ900510HSRRNN09', voter_key: null, postal_code: '83000', address: null },
  ...over,
});
const page = (items: EmployeeDocument[]) => ({ items, total: items.length, page: 1, size: 10 });

function server({ list = () => apiOk(page([doc()])), save }: { list?: () => Response; save?: () => Response } = {}) {
  return mockFetch((call: MockCall) => {
    if (call.url.endsWith('/data')) return (save ?? (() => apiOk(doc({ confirmed: true, confirmed_by: 'admin@empresa.com', data: { ...doc().data, full_name: 'Juan Pérez' } }), { code: 'EMPLOYEE_DOCUMENT_DATA_SAVED', message: 'Datos del documento guardados' })))();
    return list();
  });
}

const renderReview = () => renderPage('/x', '/x', <EmployeeDocumentsReview employeeId={7} />);

describe('Expediente de documentos del empleado (empresa)', () => {
  it('muestra el documento con sus datos leídos y permite corregirlos y confirmarlos', async () => {
    const { calls } = server();
    renderReview();
    expect(await screen.findByRole('heading', { name: 'ine.jpg' })).toBeInTheDocument();
    expect(screen.getByText('Por revisar')).toBeInTheDocument();
    expect(screen.queryByText('Dígitos MRZ correctos')).not.toBeInTheDocument();
    const name = screen.getByLabelText<HTMLInputElement>('Nombre completo');
    expect(name.value).toBe('Juan');
    await userEvent.clear(name);
    await userEvent.type(name, 'Juan Pérez');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Confirmar los datos de ine.jpg?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar datos' }));
    expect(await screen.findByRole('dialog', { name: SAVED })).toBeInTheDocument();
    const patch = calls.find((call) => call.init.method === 'PATCH');
    expect(patch?.url).toBe('/api/validations/employees/7/documents/11/data');
    expect(JSON.parse(patch?.init.body as string)).toMatchObject({ full_name: 'Juan Pérez' });
    // Tras confirmar, la insignia pasa a «Confirmado».
    expect(await screen.findByText('Confirmado')).toBeInTheDocument();
  });

  it('insignias: controles MRZ completos sin afirmar autenticidad, sin lectura automática y confirmado sin revisor conocido', async () => {
    server({ list: () => apiOk(page([doc({ mrz_verified: true, ocr_processed: false, ocr_confidence: null, confirmed: true, confirmed_by: null })])) });
    renderReview();
    await screen.findByRole('heading', { name: 'ine.jpg' });
    expect(screen.getByText('Dígitos MRZ correctos')).toHaveAccessibleDescription('Los controles de lectura coinciden; no prueban la autenticidad del documento.');
    expect(screen.getByText('Los controles de lectura coinciden; no prueban la autenticidad del documento.')).toBeVisible();
    expect(screen.getByText('Sin lectura automática')).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByTitle('Confirmado por —')).toBeInTheDocument();
  });

  it('traduce la integridad MRZ y su límite en los siete idiomas sin perder correcciones', async () => {
    server({ list: () => apiOk(page([doc({ mrz_verified: true })])) });
    renderReview();
    await screen.findByRole('heading', { name: 'ine.jpg' });
    const name = screen.getByLabelText('Nombre completo');
    await userEvent.clear(name);
    await userEvent.type(name, 'Corrección pendiente');
    for (const locale of LOCALES) {
      await act(() => setLocale(locale));
      const badge = screen.getByText(t('employeeDocuments.review.mrz'));
      expect(badge).toHaveAccessibleDescription(t('employeeDocuments.review.mrzHelp'));
      expect(screen.getByText(t('employeeDocuments.review.mrzHelp'))).toBeVisible();
      expect(screen.getByLabelText(t('employeeDocuments.review.fields.fullName'))).toBe(name);
      expect(name).toHaveValue('Corrección pendiente');
    }
  });

  it('al confirmar un documento, los demás del expediente no cambian', async () => {
    const other = doc({ id: 12, file_name: 'comprobante.pdf', type: 'PROOF_OF_ADDRESS' });
    server({ list: () => apiOk(page([doc(), other])) });
    renderReview();
    await screen.findByRole('heading', { name: 'ine.jpg' });
    const firstCard = screen.getByRole('heading', { name: 'ine.jpg' }).closest('section') as HTMLElement;
    await userEvent.click(within(firstCard).getByRole('button', { name: 'Confirmar datos' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Confirmar los datos de ine.jpg?' })).getByRole('button', { name: 'Confirmar datos' }));
    expect(await screen.findByRole('dialog', { name: SAVED })).toBeInTheDocument();
    // El primero pasa a «Confirmado»; el segundo (no coincide en el `map` de `onUpdated`) sigue «Por revisar».
    expect(within(firstCard).getByText('Confirmado')).toBeInTheDocument();
    const secondCard = screen.getByRole('heading', { name: 'comprobante.pdf' }).closest('section') as HTMLElement;
    expect(within(secondCard).getByText('Por revisar')).toBeInTheDocument();
  });

  it('descargar pide el archivo', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { calls } = mockFetch((call: MockCall) => (call.url.endsWith('/file') ? apiOk({ file_name: 'ine.jpg', content_type: 'image/jpeg', size: 4, data: btoa('hi') }) : apiOk(page([doc()]))));
    renderReview();
    await screen.findByRole('heading', { name: 'ine.jpg' });
    await userEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    await waitFor(() => expect(calls.some((call) => call.url === '/api/validations/employees/7/documents/11/file')).toBe(true));
  });

  it('si la descarga falla: popup con su título', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    mockFetch((call: MockCall) => (call.url.endsWith('/file') ? apiFail(503, 'STORAGE_UNAVAILABLE', 'Sin almacenamiento') : apiOk(page([doc()]))));
    renderReview();
    await screen.findByRole('heading', { name: 'ine.jpg' });
    await userEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo descargar el documento' })).toHaveTextContent('Sin almacenamiento');
  });

  it('si guardar los datos falla: popup con su título', async () => {
    server({ save: () => apiFail(409, 'CONFLICT', 'No se pudo guardar') });
    renderReview();
    await screen.findByRole('heading', { name: 'ine.jpg' });
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Confirmar los datos de ine.jpg?' })).getByRole('button', { name: 'Confirmar datos' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron guardar los datos' })).toHaveTextContent('No se pudo guardar');
  });

  it('una fecha completa pero inválida (p. ej. mal leída por OCR) se rechaza en el cliente: no se envía', async () => {
    const { calls } = server({ list: () => apiOk(page([doc({ data: { ...doc().data, birth_date: '2026-13-40' } })])) });
    renderReview();
    await screen.findByRole('heading', { name: 'ine.jpg' });
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    expect(await screen.findByRole('alertdialog', { name: 'Revisa los datos' })).toHaveTextContent('Escribe una fecha válida');
    expect(calls.some((call) => call.init.method === 'PATCH')).toBe(false); // nada se envía
  });

  it('el backend rechaza una fecha: el error vuelve bajo su campo (DateField)', async () => {
    const birthError = { code: 'VALUE_ERROR', message: 'La fecha de nacimiento no es válida', field: 'birth_date', details: null };
    server({ save: () => jsonResponse(envelope(null, { status: 422, code: 'VALIDATION_ERROR', message: 'Datos inválidos', errors: [birthError] }), 422) });
    renderReview();
    await screen.findByRole('heading', { name: 'ine.jpg' });
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Confirmar los datos de ine.jpg?' })).getByRole('button', { name: 'Confirmar datos' }));
    await screen.findByRole('alertdialog', { name: 'No se pudieron guardar los datos' });
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveAccessibleDescription('La fecha de nacimiento no es válida');
  });

  it('al corregir el campo que el backend rechazó, su error se retira (el siguiente intento parte limpio)', async () => {
    const birthError = { code: 'VALUE_ERROR', message: 'La fecha de nacimiento no es válida', field: 'birth_date', details: null };
    server({ save: () => jsonResponse(envelope(null, { status: 422, code: 'VALIDATION_ERROR', message: 'Datos inválidos', errors: [birthError] }), 422) });
    renderReview();
    await screen.findByRole('heading', { name: 'ine.jpg' });
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Confirmar los datos de ine.jpg?' })).getByRole('button', { name: 'Confirmar datos' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudieron guardar los datos' })).getAllByRole('button').at(-1)!);
    const birth = screen.getByLabelText('Fecha de nacimiento');
    expect(birth).toHaveAccessibleDescription('La fecha de nacimiento no es válida');
    await userEvent.clear(birth);
    await userEvent.type(birth, '23071995');
    expect(birth).toHaveValue('23/07/1995');
    expect(birth).not.toHaveAccessibleDescription('La fecha de nacimiento no es válida'); // ya se corrigió: el error del servidor se fue
  });

  it('corrige una fecha del expediente: el valor editable se actualiza', async () => {
    server();
    renderReview();
    await screen.findByRole('heading', { name: 'ine.jpg' });
    const birth = screen.getByLabelText('Fecha de nacimiento');
    await userEvent.clear(birth);
    await userEvent.type(birth, '23071995');
    expect(birth).toHaveValue('23/07/1995');
  });

  it('sin documentos: estado vacío', async () => {
    server({ list: () => apiOk(page([])) });
    renderReview();
    expect(await screen.findByText('Sin documentos')).toBeInTheDocument();
    expect(screen.getByText('El empleado todavía no sube documentos.')).toBeInTheDocument();
  });

  it('si no cargan: «Reintentar»', async () => {
    let fail = true;
    server({ list: () => (fail ? apiFail(403, 'FORBIDDEN', 'Sin permiso') : apiOk(page([doc()]))) });
    renderReview();
    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    fail = false;
    await userEvent.click(retry);
    expect(await screen.findByRole('heading', { name: 'ine.jpg' })).toBeInTheDocument();
  });
});
