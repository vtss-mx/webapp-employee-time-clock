/** Datos y pasos de prueba de las pantallas de empleados (alta, edición y listado; los comparten sus pruebas). */
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';
import { EmployeeCreatePage } from '../pages/company/EmployeeCreatePage';
import { EmployeeEditPage } from '../pages/company/EmployeeEditPage';
import { EmployeesListPage } from '../pages/company/EmployeesListPage';
import { ReverifyIdentityPage } from '../pages/company/ReverifyIdentityPage';
import type { Employee } from '../types';
import { apiOk, liveCheck, mockFetch, type MockCall } from './http';
import { renderWithProviders } from './render';

export const ana: Employee = {
  id: 7,
  user_id: 70,
  employee_number: 'EMP-7',
  first_name: 'Ana',
  last_name: 'Ruiz',
  full_name: 'Ana Ruiz',
  birth_date: '1990-01-01',
  rfc: 'RUAA900101AB1',
  curp: 'RUAA900101MSRRZL09',
  nss: '12345678903',
  phone: '+526621234567',
  email: 'ana@empresa.com',
  active: true,
  headwear_exempt: false,
  face_status: 'APPROVED',
  face_rejection_reason: null,
  latest_enrollment_id: 3,
  has_face: true,
  face_samples: 5,
  department_id: 3,
  department_name: 'Producción',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
};
export const luis: Employee = { ...ana, id: 8, employee_number: 'EMP-8', first_name: 'Luis', last_name: 'Paz', full_name: 'Luis Paz', email: 'luis@empresa.com', active: false, face_status: 'NOT_ENROLLED', department_id: null, department_name: null };

export const page = (items: Employee[]) => ({ items, total: items.length, page: 1, size: 10 });
export const posted = (calls: MockCall[], method: string) => {
  const call = calls.find((c) => c.init.method === method);
  return { url: call?.url, body: JSON.parse((call?.init.body as string | undefined) ?? 'null') as unknown };
};

/** Validación en vivo (respaldo HTTP): cada dato único responde según su campo. */
export function live(call: MockCall, codes: Record<string, string> = {}) {
  const field = new URL(call.url, 'http://localhost').searchParams.get('field') ?? '';
  return liveCheck(codes[field] ?? 'AVAILABLE', codes[field] === 'LINKABLE' ? 'Esta persona ya tiene cuenta en Employee Time Clock' : 'Disponible', field);
}

/** Pantallas de empleados con sus destinos (expediente y listado). */
export function renderEmployees(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/employees" element={<EmployeesListPage />} />
      <Route path="/company/employees/new" element={<EmployeeCreatePage />} />
      <Route path="/company/employees/:id/edit" element={<EmployeeEditPage />} />
      <Route path="/company/employees/:id/reverify" element={<ReverifyIdentityPage />} />
      <Route
        path="/company/employees/:id"
        element={
          <>
            <p>Expediente del empleado</p>
            <Link to="/company/employees/7/edit">Ir a editar</Link>
          </>
        }
      />
    </Routes>,
    { route },
  );
}

export const VALID = {
  Nombres: 'Eva',
  Apellidos: 'Sol',
  CURP: 'RUAA900101MSRRZL09',
  RFC: 'RUAA900101AB1',
  'No. de Seguridad Social (NSS)': '12345678903',
  'No. de empleado': 'EMP-9',
  'Teléfono celular': '6621234567',
  'Correo electrónico': 'eva@empresa.com',
};

/** Llena el alta como lo haría la persona (la contraseña solo si se pide). */
export async function fillEmployee({ password = true } = {}) {
  for (const [label, value] of Object.entries(VALID)) await userEvent.type(screen.getByLabelText(label), value);
  await userEvent.type(screen.getByLabelText('Fecha de nacimiento'), '01011990');
  if (password) {
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Segura123');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Segura123');
  }
}

export const submitForm = (button: string) => {
  const form = screen.getByRole('button', { name: button }).closest('form');
  if (!form) throw new Error('sin formulario');
  fireEvent.submit(form);
};

/** Responde la confirmación previa al envío (crear, editar...) con el botón indicado. */
export async function answer(role: 'dialog' | 'alertdialog', title: string, button: string) {
  const dialog = await screen.findByRole(role, { name: title });
  await userEvent.click(within(dialog).getByRole('button', { name: button }));
  return dialog;
}

/** El expediente que se edita (la validación en vivo responde «disponible»); `onPut` responde el guardado. */
export function serveEmployee(current: Employee, onPut: () => Response = () => apiOk(current)) {
  return mockFetch((call) => {
    if (call.url.startsWith('/api/validation')) return live(call);
    return call.init.method === 'PUT' ? onPut() : apiOk(current);
  });
}
