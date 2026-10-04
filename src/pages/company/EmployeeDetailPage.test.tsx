import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Employee } from '../../types';
import { EmployeeDetailPage } from './EmployeeDetailPage';

const employee: Employee = {
  id: 7,
  user_id: 70,
  employee_number: 'EMP-7',
  first_name: 'Ana',
  last_name: 'Ruiz',
  full_name: 'Ana Ruiz',
  birth_date: '1990-05-10',
  rfc: 'RUAA900510AB1',
  curp: null,
  nss: null,
  phone: null,
  email: 'ana@empresa.com',
  active: true,
  headwear_exempt: false,
  face_status: 'APPROVED',
  face_rejection_reason: null,
  latest_enrollment_id: 3,
  has_face: true,
  face_samples: 5,
  face_learned_samples: 2,
  face_last_learned_at: '2026-10-01T10:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
};

/** Expediente con su QR y su bitácora (vacíos); `current` es lo que responde GET del empleado. */
function serve(current: () => Employee, handle?: (call: MockCall) => Response | undefined) {
  return mockFetch((call: MockCall) => {
    const custom = handle?.(call);
    if (custom) return custom;
    if (call.url.includes('/qr')) return apiOk({ live: false, live_until: null, last_issued_at: null, last_used_at: null });
    if (call.url.includes('/verifications')) return apiOk({ items: [], total: 0, page: 1, size: 10 });
    if (call.init.method === 'DELETE') return apiOk({ ...current(), face_samples: 3, face_learned_samples: 0, face_last_learned_at: null });
    return apiOk(current());
  });
}

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/company/employees/:id" element={<EmployeeDetailPage />} />
      <Route path="/company/employees" element={<p>Listado de empleados</p>} />
    </Routes>,
    { route: '/company/employees/7' },
  );
}

describe('EmployeeDetailPage: aprendizaje continuo del rostro', () => {
  it('muestra lo aprendido y lo olvida con confirmación (el registro aprobado se queda)', async () => {
    let current = employee;
    const { calls } = serve(() => current);
    renderDetail();
    expect(await screen.findByText(/2 muestras aprendidas de sus identificaciones seguras/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Olvidar lo aprendido' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Olvidar lo aprendido' });
    expect(within(dialog).getByText(/no tendrá que registrarse de nuevo/)).toBeInTheDocument();
    current = { ...employee, face_samples: 3, face_learned_samples: 0, face_last_learned_at: null };
    await userEvent.click(within(dialog).getByRole('button', { name: 'Olvidar lo aprendido' }));

    expect(await screen.findByText('Aprendizaje reiniciado')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'DELETE')?.url).toBe('/api/employees/7/face/learned');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(screen.getByText(/aprenderá de sus identificaciones seguras/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Olvidar lo aprendido' })).not.toBeInTheDocument();
  });

  it('una sola muestra se dice en singular; sin rostro aprobado no se muestra el aprendizaje', async () => {
    let current: Employee = { ...employee, face_learned_samples: 1 };
    serve(() => current);
    const { unmount } = renderDetail();
    expect(await screen.findByText(/1 muestra aprendida de sus identificaciones/)).toBeInTheDocument();
    unmount();

    current = { ...employee, face_status: 'PENDING_REVIEW', face_learned_samples: 0 };
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.queryByText(/Aprendizaje continuo/)).not.toBeInTheDocument();
  });
});

describe('EmployeeDetailPage: expediente', () => {
  it('muestra departamento, áreas a su cargo, teléfono, cuenta compartida y el rechazo con su motivo', async () => {
    serve(() => ({
      ...employee,
      phone: '+526621234567',
      shared_account: true,
      headwear_exempt: true,
      department_id: 3,
      department_name: 'Producción',
      managed_departments: [{ id: 3, name: 'Producción' }, { id: 4, name: 'Almacén' }],
      face_status: 'REJECTED',
      face_rejection_reason: 'La foto está borrosa',
    }));
    renderDetail();
    expect(await screen.findByText('Cuenta compartida')).toHaveAttribute('title', 'Trabaja también en otra empresa con la misma cuenta');
    expect(screen.getByText('+52 662 123 4567')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Producción' }).map((link) => link.getAttribute('href'))).toEqual(['/company/departments/3', '/company/departments/3']);
    expect(screen.getByRole('link', { name: 'Almacén' })).toHaveAttribute('href', '/company/departments/4');
    expect(screen.getByText('Motivo: “La foto está borrosa”')).toBeInTheDocument();
    expect(screen.getByText(/Exento de retirar prenda de cabeza/)).toBeInTheDocument();
    // Rechazado: se registra en persona (acción principal), se consulta su validación y se puede pedir otra.
    expect(screen.queryByRole('link', { name: 'Verificar identidad' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Registrar rostro en persona' })).toHaveAttribute('href', '/company/employees/7/face/enroll');
    expect(screen.getByRole('link', { name: 'Ver validación' })).toHaveAttribute('href', '/company/validations/3');
    expect(screen.getByRole('link', { name: 'Solicitar nueva verificación' })).toHaveAttribute('href', '/company/employees/7/reverify');
  });

  it('sin registro facial ni departamento: solo ofrece registrarlo en persona', async () => {
    serve(() => ({ ...employee, face_status: 'NOT_ENROLLED', latest_enrollment_id: null, rfc: null, department_id: null, department_name: null, managed_departments: [] }));
    renderDetail();
    expect(await screen.findByRole('link', { name: 'Registrar rostro en persona' })).toBeInTheDocument();
    expect(screen.getByText('Sin departamento')).toBeInTheDocument();
    expect(screen.queryByText('Responsable de')).toBeNull();
    expect(screen.getAllByText('Sin capturar')).toHaveLength(4); // RFC, CURP, NSS y teléfono
    expect(screen.queryByRole('link', { name: /validación/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Solicitar nueva verificación' })).toBeNull();
  });

  it('desactivar y activar se confirman y vuelven a pedir el expediente (lo decide el backend)', async () => {
    let current = employee;
    const { calls } = serve(
      () => current,
      (call) => {
        if (call.init.method !== 'PATCH') return undefined;
        current = { ...employee, active: (JSON.parse(call.init.body as string) as { active: boolean }).active };
        return apiOk(current);
      },
    );
    renderDetail();
    expect(await screen.findByRole('link', { name: 'Verificar identidad' })).toHaveAttribute('href', '/company/employees/7/face/verify');
    expect(screen.getByRole('link', { name: 'Registrar de nuevo en persona' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar empleado' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Desactivar empleado' })).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar empleado' }));
    const deactivate = await screen.findByRole('alertdialog', { name: 'Desactivar empleado' });
    expect(deactivate).toHaveTextContent('Su sesión actual se cerrará');
    await userEvent.click(within(deactivate).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByText('Empleado desactivado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    // Inactivo: sin acciones en persona.
    expect(await screen.findByRole('button', { name: 'Activar empleado' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Verificar identidad' })).toBeNull();
    expect(screen.queryByRole('link', { name: /en persona/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Activar empleado' }));
    const activate = await screen.findByRole('dialog', { name: 'Activar empleado' });
    expect(activate).toHaveTextContent('podrá volver a iniciar sesión');
    await userEvent.click(within(activate).getByRole('button', { name: 'Activar' }));
    expect(await screen.findByText('Empleado activado')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'PATCH').map((c) => JSON.parse(c.init.body as string) as unknown)).toEqual([{ active: false }, { active: true }]);
  });

  it('eliminar definitivamente: si el servidor lo impide lo explica; si no, vuelve al listado', async () => {
    let attempts = 0;
    const { calls } = serve(
      () => employee,
      (call) => {
        if (call.init.method !== 'DELETE') return undefined;
        attempts += 1;
        return attempts === 1 ? apiFail(409, 'EMPLOYEE_HAS_RECORDS', 'No se puede eliminar en este momento') : apiOk(null);
      },
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar definitivamente' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar empleado' });
    expect(dialog).toHaveTextContent('Esta acción no se puede deshacer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar definitivamente' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar' })).toHaveTextContent('No se puede eliminar en este momento');
    expect(screen.queryByRole('alertdialog', { name: 'Eliminar empleado' })).toBeNull(); // la confirmación se cerró
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Eliminar empleado' })).getByRole('button', { name: 'Eliminar definitivamente' }));
    expect(await screen.findByText('Listado de empleados')).toBeInTheDocument();
    expect(await screen.findByText('Empleado eliminado')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'DELETE').map((c) => c.url)).toEqual(['/api/employees/7', '/api/employees/7']);
  });

  it('si no carga ofrece volver a cargar', async () => {
    let attempts = 0;
    serve(
      () => employee,
      (call) => {
        if (call.url !== '/api/employees/7') return undefined;
        attempts += 1;
        return attempts === 1 ? apiFail(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado') : undefined;
      },
    );
    renderDetail();
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar el empleado' });
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: 'Empleado' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
  });
});
