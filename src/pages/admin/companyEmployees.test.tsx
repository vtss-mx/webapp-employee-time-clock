import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FeedbackProvider } from '../../context/FeedbackContext';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { WithCatalogs } from '../../test/render';
import type { CompanyDetail, CompanyEmployee } from '../../types';
import { CompanyEmployeesPage } from './CompanyEmployeesPage';

const company: CompanyDetail = {
  id: 4,
  name: 'Panificadora',
  legal_name: null,
  rfc: null,
  phone: null,
  active: true,
  max_employees: null,
  api_enabled: false,
  employee_count: 2,
  admin_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
const ana: CompanyEmployee = {
  id: 1,
  employee_number: 'E-001',
  first_name: 'Ana',
  last_name: 'López',
  department_name: 'Ventas',
  email: 'ana@pan.com',
  phone: '+526621234567',
  active: true,
  face_status: 'APPROVED',
  face_learned_samples: 2,
  face_last_learned_at: '2026-10-01T10:00:00Z',
};
/** Sin teléfono ni departamento, inactivo y sin registro facial. */
const beto: CompanyEmployee = {
  ...ana,
  id: 2,
  employee_number: 'E-002',
  first_name: 'Beto',
  last_name: 'Ruiz',
  department_name: null,
  phone: null,
  active: false,
  face_status: 'NOT_ENROLLED',
  face_learned_samples: 0,
  face_last_learned_at: null,
};
const page = (items: CompanyEmployee[]) => apiOk({ items, total: items.length, page: 1, size: 10 });

function renderPage(employees: (url: string, method?: string) => Response, detail: () => Response = () => apiOk(company)) {
  const mock = mockFetch((call) => (call.url.includes('/employees') ? employees(call.url, call.init.method) : detail()));
  render(
    <MemoryRouter initialEntries={['/admin/companies/4/employees']}>
      <FeedbackProvider>
        <WithCatalogs>
          <Routes>
            <Route path="/admin/companies/:id/employees" element={<CompanyEmployeesPage />} />
          </Routes>
        </WithCatalogs>
      </FeedbackProvider>
    </MemoryRouter>,
  );
  return mock.calls;
}

describe('CompanyEmployeesPage (el ADMIN consulta el personal de una empresa)', () => {
  it('lista paginada de solo lectura: su ficha de trabajo, sin abrir detalles', async () => {
    const calls = renderPage(() => page([ana, beto]));
    expect(await screen.findByRole('heading', { name: 'Empleados de Panificadora' })).toBeInTheDocument();
    expect(await screen.findByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('2 registrados · solo consulta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Panificadora/ })).toHaveAttribute('href', '/admin/companies/4');

    const [first, second] = screen.getAllByRole('row').slice(1);
    expect(first).toHaveTextContent('E-001');
    expect(first).toHaveTextContent('Ventas');
    expect(first).toHaveTextContent('ana@pan.com');
    expect(first).not.toHaveAttribute('tabindex'); // no hay detalle que abrir
    expect(first.closest('table')).toHaveClass('table--readonly');
    expect(within(second).getByText('Sin teléfono')).toBeInTheDocument();
    expect(within(second).getByText('Sin departamento')).toBeInTheDocument();
    expect(within(second).getByText('Inactivo')).toBeInTheDocument();
    expect(within(first).getByText('2 muestras')).toBeInTheDocument();
    expect(within(second).getByText('Sin aprender')).toBeInTheDocument();
    expect(within(second).queryByRole('button', { name: 'Olvidar' })).toBeNull();

    const list = calls.find((c) => c.url.includes('/employees'));
    expect(list?.url).toContain('/api/admin/companies/4/employees?');
  });

  it('el ADMIN olvida lo aprendido de un empleado (con confirmación) y la fila se actualiza', async () => {
    const forgotten: CompanyEmployee = { ...ana, face_learned_samples: 0, face_last_learned_at: null };
    const calls = renderPage((_url, method) => (method === 'DELETE' ? apiOk(forgotten) : page([{ ...ana, face_learned_samples: 1 }, beto])));
    const row = (await screen.findByText('Ana López')).closest('tr') as HTMLElement;
    expect(within(row).getByText('1 muestra')).toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: 'Olvidar' }));
    let dialog = await screen.findByRole('alertdialog', { name: '¿Olvidar lo aprendido de Ana López?' });
    expect(within(dialog).getByText(/no tendrá que registrarse de nuevo/)).toBeInTheDocument();
    const facts = within(dialog).getByRole('region', { name: 'Se borrará' });
    expect(facts).toHaveTextContent('EmpleadoAna López · E-001');
    expect(facts).toHaveTextContent('Lo aprendido1 muestra · ');
    expect(dialog).toHaveTextContent('Lo aprendido no se puede recuperar');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    expect(within(row).getByText('1 muestra')).toBeInTheDocument(); // cancelar deja la fila como estaba

    await userEvent.click(within(row).getByRole('button', { name: 'Olvidar' }));
    dialog = await screen.findByRole('alertdialog', { name: '¿Olvidar lo aprendido de Ana López?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Olvidar lo aprendido' }));
    expect(await screen.findByText('Aprendizaje reiniciado')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'DELETE')?.url).toBe('/api/admin/companies/4/employees/1/face/learned');
    expect(within(row).getByText('Sin aprender')).toBeInTheDocument();
    expect(screen.getByText('Beto Ruiz')).toBeInTheDocument(); // las demás filas no cambian
  });

  it('si no se puede olvidar lo aprendido, lo avisa y la fila no cambia', async () => {
    renderPage((_url, method) => (method === 'DELETE' ? apiFail(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado') : page([ana])));
    const row = (await screen.findByText('Ana López')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Olvidar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Olvidar lo aprendido de Ana López?' })).getByRole('button', { name: 'Olvidar lo aprendido' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo olvidar lo aprendido' })).toBeInTheDocument();
    expect(within(row).getByText('2 muestras')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Olvidar' })).toBeEnabled(); // se puede volver a intentar
  });

  it('busca en el backend y, sin resultados, dice que nada coincide', async () => {
    const calls = renderPage((url) => (url.includes('search=') ? page([]) : page([ana])));
    await screen.findByText('Ana López');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar empleados' }), 'zzz');
    expect(await screen.findByText('Ningún empleado coincide con la búsqueda')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('search=zzz'))).toBe(true);
  });

  it('una empresa sin empleados lo explica', async () => {
    renderPage(() => page([]));
    expect(await screen.findByText('La empresa aún no registra empleados')).toBeInTheDocument();
  });

  it('si la empresa no carga: un solo aviso, "Volver a cargar" y la lista después', async () => {
    let attempts = 0;
    const calls = renderPage(
      () => page([ana]),
      () => (attempts++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló el servidor') : apiOk(company)),
    );
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar la empresa' });
    expect(calls.some((c) => c.url.includes('/employees'))).toBe(false); // la lista espera a la empresa
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Ana López')).toBeInTheDocument();
  });

  it('mientras carga la empresa muestra el esqueleto', async () => {
    renderPage(() => page([ana]));
    expect(document.querySelector('.skeleton')).not.toBeNull();
    await waitFor(() => expect(screen.getByText('Ana López')).toBeInTheDocument());
  });
});
