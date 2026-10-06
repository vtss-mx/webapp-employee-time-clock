/**
 * Departamentos: cada falla se explica con su título (cargas y acciones) y las pantallas en inglés
 * (en-US). Los casos de uso están en departments.test.tsx.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { confirmation, page, person, press, production, renderAt } from '../../test/departments';
import { apiFail, apiOk, liveCheck, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import { DepartmentAssignPage } from './DepartmentAssignPage';
import { DepartmentDetailPage } from './DepartmentDetailPage';
import { DepartmentFormPage } from './DepartmentFormPage';
import { DepartmentsPage } from './DepartmentsPage';

afterEach(() => vi.unstubAllGlobals());

describe('Departamentos: cada falla se explica con su título', () => {
  const forbidden = () => apiFail(403, 'FORBIDDEN', 'Sin acceso');
  const refused = () => apiFail(409, 'DEPARTMENT_CONFLICT', 'No se puede ahora');
  const members = () => apiOk(page([person(10, 'Juan Paz', { department_id: 3 })]));

  it('la lista que no carga', async () => {
    mockFetch(forbidden());
    renderWithProviders(<DepartmentsPage />, { route: '/company/departments' });
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los departamentos' })).toHaveTextContent('Sin acceso');
  });

  it('sus empleados que no cargan', async () => {
    mockFetch((call) => (call.url.startsWith('/api/employees') ? forbidden() : apiOk(production)));
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar sus empleados' })).toHaveTextContent('Sin acceso');
  });

  it('retirar a un responsable y quitar a un empleado que el servidor no acepta', async () => {
    mockFetch((call) => {
      if (call.init.method === 'DELETE') return refused();
      return call.url.startsWith('/api/employees') ? members() : apiOk(production);
    });
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Retirar a Ana Ruiz como responsable' }));
    await press(await confirmation('¿Retirar a Ana Ruiz como responsable de Producción?', 'alertdialog'), 'Retirar responsable');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo retirar al responsable' })).toHaveTextContent('No se puede ahora');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar a Juan Paz del departamento' }));
    await press(await confirmation('¿Quitar a Juan Paz de Producción?', 'alertdialog'), 'Quitar del departamento');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo quitar al empleado' })).toHaveTextContent('No se puede ahora');
  });

  it('asignar: los empleados que no cargan y una asignación que el servidor no acepta', async () => {
    let lists = 0;
    mockFetch((call) => {
      if (call.init.method === 'POST') return refused();
      if (!call.url.startsWith('/api/employees')) return apiOk(production);
      lists += 1;
      return lists === 1 ? forbidden() : apiOk(page([person(11, 'Raúl Soto')]));
    });
    renderAt('/company/departments/:id/assign/:role', '/company/departments/3/assign/employees', <DepartmentAssignPage />);
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los empleados' });
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Asignar: Raúl Soto' }));
    await press(await confirmation('¿Asignar a Raúl Soto a Producción?'), 'Asignar');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo asignar al empleado' })).toHaveTextContent('No se puede ahora');
  });

  it('crear un departamento que el servidor no acepta', async () => {
    mockFetch((call) => (call.url.startsWith('/api/validation') ? liveCheck('AVAILABLE', 'Nombre disponible', 'department_name') : refused()));
    renderAt('/company/departments/new', '/company/departments/new', <DepartmentFormPage />);
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Almacén');
    expect(await screen.findByText('Nombre disponible')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear departamento' }));
    await press(await confirmation('¿Crear el departamento Almacén?'), 'Crear departamento');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo crear el departamento' })).toHaveTextContent('No se puede ahora');
  });
});

describe('Departamentos en inglés (en-US)', () => {
  it('el detalle: responsables, empleados y eliminar con su conteo en inglés', async () => {
    await setLocale('en-US');
    mockFetch((call) => (call.url.startsWith('/api/employees') ? apiOk(page([person(10, 'Juan Paz', { department_id: 3 })])) : apiOk({ ...production, description: null, employee_count: 1 })));
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Producción' })).toBeInTheDocument();
    expect(screen.getByText('1 employee')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Employees \(1\)/ })).toBeInTheDocument();
    expect(await screen.findByText('No. EMP-10')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete department' }));
    const dialog = await confirmation('Delete the Producción department?', 'alertdialog');
    expect(dialog).toHaveTextContent('Producción has 1 assigned employee: remove them or assign them to another department before deleting it.');
  });
});
