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
};
/** Sin teléfono ni departamento, inactivo y sin registro facial. */
const beto: CompanyEmployee = { ...ana, id: 2, employee_number: 'E-002', first_name: 'Beto', last_name: 'Ruiz', department_name: null, phone: null, active: false, face_status: 'NOT_ENROLLED' };
const page = (items: CompanyEmployee[]) => apiOk({ items, total: items.length, page: 1, size: 10 });

function renderPage(employees: (url: string) => Response, detail: () => Response = () => apiOk(company)) {
  const mock = mockFetch((call) => (call.url.includes('/employees') ? employees(call.url) : detail()));
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

    const list = calls.find((c) => c.url.includes('/employees'));
    expect(list?.url).toContain('/api/admin/companies/4/employees?');
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
