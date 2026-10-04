import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../context/AuthContext';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders, sampleUser } from '../../test/render';
import { withScreens } from '../../test/screens';
import type { Employee, User } from '../../types';
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
    return apiOk(current());
  });
}

/** Usuario de la empresa con las pantallas que le da el backend (incluye Turnos). */
const companyUser = withScreens({ ...sampleUser, role: 'COMPANY', employee: null });

/** Sesión ya iniciada con ese usuario (las pantallas que puede ver vienen del backend). */
function session(user: User | null): AuthContextValue {
  return {
    user,
    status: user ? 'authenticated' : 'anonymous',
    isAuthenticated: Boolean(user),
    logoutReason: null,
    deviceBlock: null,
    dismissDeviceBlock: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    logoutEverywhere: vi.fn(),
    refreshUser: vi.fn(),
    selectCompany: vi.fn(),
    updatePreferences: vi.fn(),
  };
}

function renderDetail(user: User | null = companyUser) {
  return renderWithProviders(
    <AuthContext.Provider value={session(user)}>
      <Routes>
        <Route path="/company/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/company/employees/:id/face/enroll" element={<p>Cámara de registro</p>} />
        <Route path="/company/employees" element={<p>Listado de empleados</p>} />
      </Routes>
    </AuthContext.Provider>,
    { route: '/company/employees/7' },
  );
}

describe('EmployeeDetailPage: sin aprendizaje automático', () => {
  it('la empresa no ve ni administra lo que aprende el reconocimiento (lo hace el ADMIN)', async () => {
    serve(() => employee);
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.queryByText(/Aprendizaje continuo/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Olvidar lo aprendido' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Registrar rostro en persona' })).toHaveClass('btn--primary');
    expect(screen.getByRole('link', { name: 'Ver validación' })).toHaveAttribute('href', '/company/validations/3');
    expect(screen.getByRole('link', { name: 'Solicitar nueva verificación' })).toHaveAttribute('href', '/company/employees/7/reverify');
  });

  it('sin registro facial ni departamento: solo ofrece registrarlo en persona', async () => {
    serve(() => ({ ...employee, face_status: 'NOT_ENROLLED', latest_enrollment_id: null, rfc: null, department_id: null, department_name: null, managed_departments: [] }));
    renderDetail();
    expect(await screen.findByRole('button', { name: 'Registrar rostro en persona' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Registrar de nuevo en persona' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar empleado' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Desactivar a Ana Ruiz?' })).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar empleado' }));
    const deactivate = await screen.findByRole('alertdialog', { name: '¿Desactivar a Ana Ruiz?' });
    expect(deactivate).toHaveTextContent('Su sesión actual se cerrará');
    expect(within(deactivate).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: ActivoDespués: Inactivo');
    await userEvent.click(within(deactivate).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByText('Empleado desactivado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    // Inactivo: sin acciones en persona.
    expect(await screen.findByRole('button', { name: 'Activar empleado' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Verificar identidad' })).toBeNull();
    expect(screen.queryByRole('button', { name: /en persona/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Activar empleado' }));
    const activate = await screen.findByRole('dialog', { name: '¿Activar a Ana Ruiz?' });
    expect(activate).toHaveTextContent('Podrá volver a iniciar sesión');
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
    /** Pide eliminar y escribe su número de empleado para habilitar el botón. */
    const confirmDelete = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
      const dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar a Ana Ruiz?' });
      const button = within(dialog).getByRole('button', { name: 'Eliminar definitivamente' });
      expect(button).toBeDisabled();
      await userEvent.type(within(dialog).getByLabelText('Escribe «EMP-7» para confirmar'), 'EMP-7');
      return { dialog, button };
    };
    await screen.findByRole('heading', { name: 'Ana Ruiz' });
    const first = await confirmDelete();
    expect(first.dialog).toHaveTextContent('Esta acción no se puede deshacer');
    expect(first.dialog).toHaveTextContent('Correoana@empresa.com');
    await userEvent.click(within(first.dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false); // cancelar no envía nada

    await userEvent.click((await confirmDelete()).button);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar' })).toHaveTextContent('No se puede eliminar en este momento');
    expect(screen.queryByRole('alertdialog', { name: '¿Eliminar a Ana Ruiz?' })).toBeNull(); // la confirmación se cerró
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click((await confirmDelete()).button);
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

describe('EmployeeDetailPage: registro en persona', () => {
  it('pregunta antes de abrir la cámara: cancelar se queda; confirmar abre el registro', async () => {
    serve(() => employee);
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar de nuevo en persona' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Registrar el rostro de Ana Ruiz?' });
    expect(dialog).toHaveTextContent('Su registro facial actual se reemplazará por el nuevo.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Registrar de nuevo en persona' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Registrar el rostro de Ana Ruiz?' })).getByRole('button', { name: 'Abrir cámara' }));
    expect(await screen.findByText('Cámara de registro')).toBeInTheDocument();
  });

  it('sin registro previo no avisa que se reemplazará', async () => {
    serve(() => ({ ...employee, face_status: 'NOT_ENROLLED', latest_enrollment_id: null }));
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar rostro en persona' }));
    expect(await screen.findByRole('dialog', { name: '¿Registrar el rostro de Ana Ruiz?' })).not.toHaveTextContent('se reemplazará');
  });
});

describe('EmployeeDetailPage: turnos', () => {
  it('con la pantalla de Turnos lleva a los turnos del empleado', async () => {
    serve(() => employee);
    renderDetail();
    expect(await screen.findByRole('link', { name: 'Turnos' })).toHaveAttribute('href', '/company/shifts/employees/7');
  });

  it('con su registro por validar, la acción principal es validarlo', async () => {
    serve(() => ({ ...employee, face_status: 'PENDING_REVIEW' }));
    renderDetail();
    expect(await screen.findByRole('link', { name: 'Validar identidad' })).toHaveClass('btn--primary');
  });

  it('sin esa pantalla (o sin sesión) no muestra el enlace: lo decide el backend', async () => {
    serve(() => employee);
    const { unmount } = renderDetail({ ...companyUser, screens: companyUser.screens.filter((s) => s.code !== 'COMPANY_SHIFTS') });
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Turnos' })).toBeNull();
    unmount();
    renderDetail(null);
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Turnos' })).toBeNull();
  });
});
