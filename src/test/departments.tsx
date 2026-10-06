/** Datos y pasos de prueba de los departamentos (los comparten sus pruebas). */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import type { Department, Employee } from '../types';
import { renderWithProviders } from './render';

export const production: Department = {
  id: 3,
  name: 'Producción',
  description: 'Línea de pan dulce',
  employee_count: 2,
  managers: [
    { employee_id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7', active: true },
    { employee_id: 8, full_name: 'Luis Paz', employee_number: 'EMP-8', active: false },
    { employee_id: 9, full_name: 'Eva Sol', employee_number: 'EMP-9', active: true },
  ],
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
};

export const person = (id: number, name: string, extra: Partial<Employee> = {}) =>
  ({ id, full_name: name, employee_number: `EMP-${id}`, first_name: name, last_name: '', active: true, department_id: null, department_name: null, ...extra }) as Employee;

export const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, size: 10 });

/** La confirmación con esa pregunta (azul: dialog; roja o de advertencia: alertdialog). */
export const confirmation = (title: string, role: 'dialog' | 'alertdialog' = 'dialog') => screen.findByRole(role, { name: title });

/** Pulsa un botón dentro de la confirmación. */
export const press = (dialog: HTMLElement, button: string) => userEvent.click(within(dialog).getByRole('button', { name: button }));

/** Una pantalla de departamentos con sus destinos (la lista y el detalle). */
export function renderAt(path: string, route: string, element: ReactElement) {
  return renderWithProviders(
    <Routes>
      <Route path={path} element={element} />
      <Route path="/company/departments" element={<p>Lista de departamentos</p>} />
      <Route path="/company/departments/:id" element={<p>Detalle del departamento</p>} />
    </Routes>,
    { route },
  );
}
