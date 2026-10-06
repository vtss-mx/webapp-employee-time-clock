import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { catalogsFixture, catalogsWith } from '../../test/catalogs';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { EnrollmentStatus, FaceEnrollmentDetail, StatusItem } from '../../types';
import type { CatalogApi } from '../../utils/catalogs';
import { RejectEnrollmentPage } from './RejectEnrollmentPage';
import { ValidationReviewPage } from './ValidationReviewPage';
import { ValidationsPage } from './ValidationsPage';

const request = (over: Partial<FaceEnrollmentDetail> = {}): FaceEnrollmentDetail => ({
  id: 5,
  status: 'PENDING',
  employee_id: 7,
  employee_number: 'EMP-7',
  full_name: 'Ana Ruiz',
  email: 'ana@empresa.com',
  birth_date: '1990-05-10',
  employee_active: true,
  samples: 5,
  quality_score: 0.92,
  liveness_passed: true,
  flagged_accessories: [],
  submitted_at: '2026-10-01T10:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
  rejection_reason: null,
  photo: 'data:image/jpeg;base64,AAAA',
  ...over,
});
const page = (items: FaceEnrollmentDetail[]) => ({ items, total: items.length, page: 1, size: 10 });

/** Respuesta que llega cuando la prueba lo decide (para ver la pantalla mientras carga). */
function deferred() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderAt(route: string, catalogs?: CatalogApi) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/validations" element={<ValidationsPage />} />
      <Route path="/company/validations/:id" element={<ValidationReviewPage />} />
      <Route path="/company/validations/:id/reject" element={<RejectEnrollmentPage />} />
      <Route path="/company/employees/:id" element={<p>Expediente del empleado</p>} />
    </Routes>,
    { route, catalogs },
  );
}

const statusOf = (call: MockCall) => new URL(call.url, 'http://localhost').searchParams.get('status');

afterEach(() => vi.unstubAllGlobals());

describe('Validaciones: bandeja por estado', () => {
  it('pendientes con su contador y prueba de vida; las otras pestañas se piden al servidor', async () => {
    const approved = deferred();
    const { calls } = mockFetch((call) => {
      if (statusOf(call) === 'PENDING') return apiOk(page([request(), request({ id: 6, full_name: 'Luis Paz', employee_number: 'EMP-8', liveness_passed: false })]));
      if (statusOf(call) === 'APPROVED') return approved.promise;
      return apiOk(page([]));
    });
    renderAt('/company/validations');
    const ana = (await screen.findByText('Ana Ruiz')).closest('tr')!;
    expect(within(ana).getByText('Superada')).toBeInTheDocument();
    expect(within(screen.getByText('Luis Paz').closest('tr')!).getByText('No aplicada')).toBeInTheDocument();
    expect(within(ana).getByRole('link', { name: /Revisar/ })).toHaveAttribute('href', '/company/validations/5');
    const pending = screen.getByRole('tab', { name: /Pendiente/ });
    expect(pending).toHaveAttribute('aria-selected', 'true');
    expect(within(pending).getByText('2')).toBeInTheDocument();

    // Mientras llega la otra pestaña, la tabla anterior se atenúa.
    await userEvent.click(screen.getByRole('tab', { name: /Aceptado/ }));
    expect(screen.getByRole('table').closest('.table-wrap')).toHaveClass('is-loading');
    approved.resolve(apiOk(page([request({ id: 7, status: 'APPROVED', full_name: 'Eva Sol' })])));
    const eva = (await screen.findByText('Eva Sol')).closest('tr')!;
    expect(within(eva).getByRole('link', { name: /Ver/ })).toHaveAttribute('href', '/company/validations/7');
    expect(screen.getByRole('table').closest('.table-wrap')).not.toHaveClass('is-loading');
    expect(within(pending).getByText('2')).toBeInTheDocument(); // el contador de pendientes se conserva

    await userEvent.click(screen.getByRole('tab', { name: /Rechazado/ }));
    expect(await screen.findByText('Sin validaciones')).toBeInTheDocument();
    expect(screen.getByText('Aquí verás las validaciones rechazadas.')).toBeInTheDocument();
    expect(calls.map(statusOf)).toEqual(['PENDING', 'APPROVED', 'REJECTED']);
  });

  it('sin pendientes es una buena noticia (sin contador); cada pestaña vacía dice qué verá ahí', async () => {
    mockFetch(apiOk(page([])));
    renderAt('/company/validations');
    expect(await screen.findByText('Todo al día')).toBeInTheDocument();
    expect(screen.getByText('No hay registros faciales por validar.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pendiente/ })).toHaveTextContent(/^\s*Pendiente$/);
    await userEvent.click(screen.getByRole('tab', { name: /Aceptado/ }));
    expect(await screen.findByText('Aquí verás las validaciones aceptadas.')).toBeInTheDocument();
    expect(screen.getByText('Sin validaciones')).toBeInTheDocument();
  });

  it('un estado nuevo del catálogo aparece como pestaña (con un ícono genérico)', async () => {
    const expired: StatusItem<EnrollmentStatus> = { code: 'EXPIRED' as EnrollmentStatus, name: 'Vencido', description: null, sort_order: 4, active: true, tone: 'muted' };
    const { calls } = mockFetch(apiOk(page([])));
    renderAt('/company/validations', catalogsWith({ enrollment_statuses: [...catalogsFixture.enrollment_statuses, expired] }));
    await userEvent.click(await screen.findByRole('tab', { name: /Vencido/ }));
    expect(await screen.findByText('Sin validaciones')).toBeInTheDocument();
    expect(screen.getByText('Aquí verás los registros faciales de tu personal.')).toBeInTheDocument();
    expect(statusOf(calls.at(-1)!)).toBe('EXPIRED');
  });
});

describe('Validaciones: revisión de identidad', () => {
  it('con marcas del análisis: avisa en un popup y las lista; aceptar confirma, avisa y vuelve a la bandeja', async () => {
    const changed = vi.fn();
    window.addEventListener('tc:enrollments-changed', changed);
    const { calls } = mockFetch((call) => apiOk(call.init.method === 'POST' ? request({ status: 'APPROVED' }) : request({ flagged_accessories: ['GLASSES', 'SPOOF', 'NEW_FLAG'] })));
    renderAt('/company/validations/5');
    const warning = await screen.findByRole('alertdialog', { name: 'Revisa la fotografía con atención' });
    expect(warning).toHaveTextContent('El sistema detectó posibles lentes');
    expect(warning).toHaveTextContent('NEW_FLAG'); // marca sin catálogo: se muestra su código
    await userEvent.click(within(warning).getByRole('button', { name: 'Entendido' }));

    expect(screen.getByRole('img', { name: 'Registro facial de Ana Ruiz' })).toBeInTheDocument();
    expect(screen.getByText(/· \d+ años/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver expediente' })).toHaveAttribute('href', '/company/employees/7');
    expect(screen.getByText('Posibles lentes')).toBeInTheDocument();
    expect(screen.getByText('Posible foto o pantalla')).toBeInTheDocument();
    // Lo marcado no se da por verificado.
    expect(screen.queryByText(/Sin accesorios que cubran el rostro/)).toBeNull();
    expect(screen.queryByText(/Rostro real frente a la cámara/)).toBeNull();
    expect(screen.getByText('Prueba de vida superada (giro de cabeza)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rechazar usuario' })).toHaveAttribute('href', '/company/validations/5/reject');

    await userEvent.click(screen.getByRole('button', { name: 'Aceptar usuario' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Aceptar a Ana Ruiz?' });
    expect(confirm).toHaveTextContent('Confirmas que la foto es de este empleado');
    // Lo que el análisis marcó se recuerda en la confirmación.
    expect(confirm).toHaveTextContent('Revisa: Posibles lentes');
    expect(confirm).toHaveTextContent('Revisa: Posible foto o pantalla');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Sí, aceptar' }));
    expect(await screen.findByText('Ana Ruiz ya puede identificarse.')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /Pendiente/ })).toBeInTheDocument(); // de vuelta en la bandeja
    expect(calls.find((c) => c.init.method === 'POST')?.url).toBe('/api/enrollments/5/approve');
    expect(changed).toHaveBeenCalledOnce(); // el contador del menú se actualiza
    window.removeEventListener('tc:enrollments-changed', changed);
  });

  it('sin marcas no hay aviso y todo se verificó; cancelar la aceptación no envía nada', async () => {
    const { calls } = mockFetch(apiOk(request({ liveness_passed: false })));
    renderAt('/company/validations/5');
    expect(await screen.findByText('Sin accesorios que cubran el rostro (según la política)')).toBeInTheDocument();
    expect(screen.getByText('Rostro real frente a la cámara (anti-spoofing)')).toBeInTheDocument();
    expect(screen.getByText('5 muestras consistentes entre sí')).toBeInTheDocument();
    expect(screen.queryByText(/Prueba de vida superada/)).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Aceptar usuario' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Aceptar a Ana Ruiz?' });
    expect(confirm).not.toHaveTextContent('Revisa:');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
  });

  it('parecido con otros empleados: los lista con su parecido y su expediente (solo marca, no bloquea)', async () => {
    mockFetch(apiOk(request({ flagged_accessories: ['POSSIBLE_DUPLICATE'], similar: [{ employee_id: 9, full_name: 'Juan Pérez', employee_number: 'EMP-9', similarity: 0.62 }] })));
    renderAt('/company/validations/5');
    expect(await screen.findByRole('heading', { name: 'Empleados parecidos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Juan Pérez · EMP-9' })).toHaveAttribute('href', '/company/employees/9');
    expect(screen.getByText('Parecido: 62%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar usuario' })).toBeEnabled();
  });

  it('una respuesta sin el campo de marcas (servidor anterior) se revisa igual, sin avisos', async () => {
    const { flagged_accessories: _omitted, ...withoutFlags } = request();
    mockFetch(apiOk(withoutFlags));
    renderAt('/company/validations/5');
    expect(await screen.findByText('Sin accesorios que cubran el rostro (según la política)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar usuario' })).toBeEnabled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('si aceptar falla se cierra la confirmación y se explica', async () => {
    mockFetch((call) => (call.init.method === 'POST' ? apiFail(409, 'ENROLLMENT_ALREADY_REVIEWED', 'La solicitud ya fue revisada') : apiOk(request())));
    renderAt('/company/validations/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar usuario' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Aceptar a Ana Ruiz?' })).getByRole('button', { name: 'Sí, aceptar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo aceptar' })).toHaveTextContent('La solicitud ya fue revisada');
    expect(screen.queryByRole('dialog', { name: '¿Aceptar a Ana Ruiz?' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Aceptar usuario' })).toBeEnabled(); // se puede volver a intentar
  });

  it('rechazada: la foto ya se eliminó; muestra quién la revisó, cuándo y el motivo; sin acciones ni avisos', async () => {
    mockFetch(apiOk(request({ status: 'REJECTED', photo: null, flagged_accessories: ['MASK'], reviewed_by: 'rh@empresa.com', reviewed_at: '2026-10-02T10:00:00Z', rejection_reason: 'Foto borrosa' })));
    renderAt('/company/validations/5');
    expect(await screen.findByText('La fotografía se eliminó al rechazar el registro.')).toBeInTheDocument();
    expect(screen.getByText('Rechazado por rh@empresa.com')).toBeInTheDocument();
    expect(screen.getByText('“Foto borrosa”')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar usuario' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Rechazar usuario' })).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull(); // las marcas solo se avisan en pendientes
  });

  it('aceptada sin revisor registrado ni motivo', async () => {
    mockFetch(apiOk(request({ status: 'APPROVED', reviewed_at: '2026-10-02T10:00:00Z' })));
    renderAt('/company/validations/5');
    expect(await screen.findByText('Aceptado por —')).toBeInTheDocument();
    expect(screen.queryByText('Motivo')).toBeNull();
  });

  it('si no carga ofrece volver a cargar', async () => {
    mockFetch(apiFail(404, 'ENROLLMENT_NOT_FOUND', 'Solicitud no encontrada'), apiOk(request()));
    renderAt('/company/validations/5');
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar la solicitud' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('button', { name: 'Aceptar usuario' })).toBeInTheDocument();
  });
});

describe('Validaciones: rechazar (pantalla)', () => {
  it('"Cancelar" vuelve a la solicitud', async () => {
    mockFetch(apiOk(request()));
    renderAt('/company/validations/5/reject');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('button', { name: 'Aceptar usuario' })).toBeInTheDocument();
  });

  it('una solicitud ya revisada no se puede rechazar', async () => {
    mockFetch(apiOk(request({ status: 'APPROVED' })));
    renderAt('/company/validations/5/reject');
    const reject = await screen.findByRole('button', { name: 'Rechazar' });
    expect(reject).toBeDisabled();
    expect(reject).toHaveAttribute('title', 'Este registro ya fue revisado');
  });

  it('si la solicitud no carga ofrece volver a cargar', async () => {
    mockFetch(apiFail(404, 'ENROLLMENT_NOT_FOUND', 'Solicitud no encontrada'), apiOk(request()));
    renderAt('/company/validations/5/reject');
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar la solicitud' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('button', { name: 'Rechazar' })).toBeEnabled();
  });
});

describe('Validaciones: cada falla se explica con su título', () => {
  it('la bandeja que no carga', async () => {
    mockFetch(apiFail(403, 'FORBIDDEN', 'Sin acceso'));
    renderAt('/company/validations');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar las validaciones' })).toHaveTextContent('Sin acceso');
  });

  it('rechazar un registro que el servidor no acepta', async () => {
    mockFetch((call) => (call.init.method === 'POST' ? apiFail(409, 'ENROLLMENT_ALREADY_REVIEWED', 'Ya fue revisado') : apiOk(request())));
    renderAt('/company/validations/5/reject');
    await userEvent.type(await screen.findByLabelText(/Motivo/), 'La foto está borrosa');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Rechazar el registro de Ana Ruiz?' })).getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo rechazar' })).toHaveTextContent('Ya fue revisado');
  });
});

describe('Validaciones en inglés (en-US)', () => {
  it('la bandeja y la revisión: columnas, verificaciones automáticas y aceptar en inglés', async () => {
    await setLocale('en-US');
    mockFetch((call) => {
      if (call.init.method === 'POST') return apiOk(request({ status: 'APPROVED' }));
      return apiOk(call.url.includes('?') ? page([request()]) : request({ flagged_accessories: ['GLASSES'] }));
    });
    renderAt('/company/validations');
    expect(await screen.findByRole('heading', { name: 'Identity validations' })).toBeInTheDocument();
    const row = (await screen.findByText('Ana Ruiz')).closest('tr')!;
    expect(within(row).getByText('Passed')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Employee', 'Submitted', 'Liveness check', 'Status', '']);
    await userEvent.click(within(row).getByRole('link', { name: /Review/ }));

    const warning = await screen.findByRole('alertdialog', { name: 'Review the photo carefully' });
    await userEvent.click(within(warning).getByRole('button', { name: 'Got it' }));
    expect(screen.getByRole('img', { name: 'Face enrollment of Ana Ruiz' })).toBeInTheDocument();
    expect(screen.getByText(/· \d+ years old/)).toBeInTheDocument();
    expect(screen.getByText('A single face detected')).toBeInTheDocument();
    expect(screen.getByText('5 samples consistent with each other')).toBeInTheDocument();
    expect(screen.getByText('Capture quality 92%')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Accept user' }));
    const confirm = await screen.findByRole('dialog', { name: 'Accept Ana Ruiz?' });
    expect(confirm).toHaveTextContent('Check: Posibles lentes'); // el nombre de la marca viene del catálogo
    await userEvent.click(within(confirm).getByRole('button', { name: 'Yes, accept' }));
    expect(await screen.findByRole('dialog', { name: 'User accepted' })).toHaveTextContent('Ana Ruiz can now identify themselves.');
  });

  it('cada pestaña vacía en inglés: buena noticia en pendientes y qué aparecerá en las demás', async () => {
    await setLocale('en-US');
    mockFetch(apiOk(page([])));
    renderAt('/company/validations');
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
    expect(screen.getByText('No face enrollments to review.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Aceptado/ }));
    expect(await screen.findByText('Accepted validations will appear here.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Rechazado/ }));
    expect(await screen.findByText('Rejected validations will appear here.')).toBeInTheDocument();
    expect(screen.getByText('No validations')).toBeInTheDocument();
  });
});
