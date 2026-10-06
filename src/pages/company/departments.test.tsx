import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmation, page, person, press, production, renderAt } from '../../test/departments';
import { apiFail, apiOk, liveCheck, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import { DepartmentAssignPage } from './DepartmentAssignPage';
import { DepartmentDetailPage } from './DepartmentDetailPage';
import { DepartmentFormPage, validateDepartmentName } from './DepartmentFormPage';
import { DepartmentsPage } from './DepartmentsPage';

/** Respuesta que llega cuando la prueba lo decide (para ver la lista mientras se vuelve a pedir). */
function deferred() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Cierra el popup de error de carga y pide de nuevo con "Volver a cargar". */
async function reloadAfter(title: string) {
  await screen.findByRole('alertdialog', { name: title });
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
}

afterEach(() => vi.unstubAllGlobals());

describe('Departamentos: listado', () => {
  it('muestra cada departamento con sus responsables y empleados; busca por nombre', async () => {
    const { calls } = mockFetch(apiOk(page([production, { ...production, id: 4, name: 'Almacén', description: null, employee_count: 0, managers: [] }])));
    renderWithProviders(<DepartmentsPage />, { route: '/company/departments' });
    expect(await screen.findByText('Producción')).toBeInTheDocument();
    expect(screen.getByText('Ana Ruiz, Luis Paz +1')).toBeInTheDocument();
    expect(screen.getByText('Sin responsable')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar departamentos' }), 'alma');
    await waitFor(() => expect(calls.at(-1)?.url).toContain('search=alma'));
    expect(screen.queryByRole('combobox', { name: 'Filtrar por estado' })).not.toBeInTheDocument();
  });

  it('sin departamentos invita a crear el primero', async () => {
    mockFetch(apiOk(page([])));
    renderWithProviders(<DepartmentsPage />, { route: '/company/departments' });
    expect(await screen.findByText('Sin departamentos')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nuevo departamento' })[0]).toHaveAttribute('href', '/company/departments/new');
  });
});

describe('Departamentos: formulario', () => {
  it('regla del nombre', () => {
    expect(validateDepartmentName('  ')).toBe('El nombre es obligatorio');
    expect(validateDepartmentName('x'.repeat(101))).toMatch(/100 caracteres/);
    expect(validateDepartmentName('Ventas')).toBeUndefined();
  });

  it('crea con el nombre verificado en vivo y abre su detalle (antes confirma qué se creará)', async () => {
    const { calls } = mockFetch((call) => (call.url.startsWith('/api/validation') ? liveCheck('AVAILABLE', 'Nombre disponible', 'department_name') : apiOk(production, { status: 201 })));
    renderAt('/company/departments/new', '/company/departments/new', <DepartmentFormPage />);
    await userEvent.type(screen.getByLabelText(/Nombre/), ' Producción ');
    await userEvent.type(screen.getByLabelText(/Descripción/), 'Línea de pan dulce');
    expect(await screen.findByText('Nombre disponible')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear departamento' }));
    const dialog = await confirmation('¿Crear el departamento Producción?');
    expect(dialog).toHaveTextContent('Después podrás nombrar a sus responsables y asignarle empleados.');
    expect(within(within(dialog).getByRole('region', { name: 'Se creará' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['NombreProducción', 'DescripciónLínea de pan dulce']);
    await press(dialog, 'Crear departamento');
    expect(await screen.findByText('Detalle del departamento')).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === 'POST');
    expect(JSON.parse(post?.init.body as string)).toEqual({ name: 'Producción', description: 'Línea de pan dulce' });
    expect(calls.some((c) => c.url.includes('field=department_name'))).toBe(true);
  });

  it('cancelar el alta no envía nada y el formulario sigue con lo escrito', async () => {
    const { calls } = mockFetch(() => liveCheck('AVAILABLE', 'Nombre disponible', 'department_name'));
    renderAt('/company/departments/new', '/company/departments/new', <DepartmentFormPage />);
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Almacén');
    expect(await screen.findByText('Nombre disponible')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear departamento' }));
    await press(await confirmation('¿Crear el departamento Almacén?'), 'Cancelar');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    expect(screen.getByLabelText(/Nombre/, { selector: 'input' })).toHaveValue('Almacén');
    expect(screen.getByRole('button', { name: 'Crear departamento' })).toBeEnabled();
  });

  it('edita; confirma el cambio y un nombre ya usado se marca en su campo', async () => {
    mockFetch((call) => {
      if (call.url.startsWith('/api/validation')) return liveCheck('AVAILABLE', 'Nombre disponible', 'department_name');
      if (call.init.method === 'PUT') return apiFail(409, 'DEPARTMENT_NAME_TAKEN', 'Ya existe un departamento con ese nombre en tu empresa');
      return apiOk(production);
    });
    renderAt('/company/departments/:id/edit', '/company/departments/3/edit', <DepartmentFormPage />);
    const name = await screen.findByLabelText(/Nombre/);
    expect(name).toHaveValue('Producción');
    await userEvent.clear(name);
    await userEvent.type(name, 'Almacén');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const dialog = await confirmation('¿Guardar los cambios de Producción?');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('1 cambioNombreAntes: ProducciónDespués: Almacén');
    await press(dialog, 'Guardar cambios');
    expect(await screen.findAllByText('Ya existe un departamento con ese nombre en tu empresa')).not.toHaveLength(0);
  });

  it('editar sin cambios avisa "Sin cambios" y no envía nada; cancelar deja lo escrito', async () => {
    const { calls } = mockFetch((call) => (call.url.startsWith('/api/validation') ? liveCheck() : apiOk(production)));
    renderAt('/company/departments/:id/edit', '/company/departments/3/edit', <DepartmentFormPage />);
    const description = await screen.findByLabelText(/Descripción/);
    await userEvent.type(description, '  '); // solo espacios: no cuenta como cambio
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('dialog', { name: 'Sin cambios' })).toHaveTextContent('No hay nada que guardar');
    expect(screen.queryByRole('dialog', { name: '¿Guardar los cambios de Producción?' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.clear(description);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const dialog = await confirmation('¿Guardar los cambios de Producción?');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('DescripciónAntes: Línea de pan dulceDespués: Sin capturar');
    await press(dialog, 'Cancelar');
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
    expect(description).toHaveValue('');
  });

  it('un formulario vacío no se envía', async () => {
    const { calls } = mockFetch(() => liveCheck());
    renderAt('/company/departments/new', '/company/departments/new', <DepartmentFormPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Crear departamento' }));
    expect(await screen.findByText('Revisa los datos')).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
  });
});

describe('Departamentos: detalle', () => {
  function serve(handler?: (call: MockCall) => Response | undefined) {
    return mockFetch((call) => {
      const custom = handler?.(call);
      if (custom) return custom;
      if (call.url.startsWith('/api/employees')) return apiOk(page([person(7, 'Ana Ruiz', { department_id: 3 }), person(10, 'Juan Paz', { department_id: 3, active: false })]));
      return apiOk(production);
    });
  }

  it('responsables y empleados: se retiran y se quitan', async () => {
    const { calls } = serve((call) => {
      if (call.init.method !== 'DELETE') return undefined;
      return apiOk({ ...production, managers: production.managers.slice(1), employee_count: 1 });
    });
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Producción' })).toBeInTheDocument();
    expect(await screen.findByText('Juan Paz')).toBeInTheDocument();
    expect(calls.find((c) => c.url.startsWith('/api/employees'))?.url).toContain('department_id=3');

    await userEvent.click(screen.getByRole('button', { name: 'Retirar a Ana Ruiz como responsable' }));
    const manager = await confirmation('¿Retirar a Ana Ruiz como responsable de Producción?', 'alertdialog');
    expect(manager).toHaveTextContent('Sigue en tu empresa y su departamento asignado no cambia.');
    expect(within(manager).getByRole('region', { name: 'Cambios' })).toHaveTextContent('ResponsablesAntes: Ana Ruiz, Luis Paz, Eva SolDespués: Luis Paz, Eva Sol');
    expect(within(manager).getByRole('region', { name: 'Detalles' })).toHaveTextContent('ResponsableAna Ruiz · No. EMP-7');
    await press(manager, 'Retirar responsable');
    expect(await screen.findByText('Responsable retirado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(calls.some((c) => c.init.method === 'DELETE' && c.url === '/api/departments/3/managers/7')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Quitar a Juan Paz del departamento' }));
    const member = await confirmation('¿Quitar a Juan Paz de Producción?', 'alertdialog');
    expect(member).toHaveTextContent('Quedará sin departamento hasta que lo asignes a otro.');
    expect(within(member).getByRole('region', { name: 'Cambios' })).toHaveTextContent('DepartamentoAntes: ProducciónDespués: Sin departamento');
    await press(member, 'Quitar del departamento');
    expect(await screen.findByText('Empleado quitado')).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'DELETE' && c.url === '/api/departments/3/employees/10')).toBe(true);
  });

  it('cancelar retirar o quitar no envía nada y la lista sigue igual', async () => {
    const { calls } = serve();
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    expect(await screen.findByText('Juan Paz')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retirar a Eva Sol como responsable' }));
    await press(await confirmation('¿Retirar a Eva Sol como responsable de Producción?', 'alertdialog'), 'Cancelar');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar a Juan Paz del departamento' }));
    await press(await confirmation('¿Quitar a Juan Paz de Producción?', 'alertdialog'), 'Cancelar');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    expect(screen.getByText('Eva Sol')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar a Juan Paz del departamento' })).toBeEnabled();
  });

  it('eliminar pide confirmación; si tiene empleados la confirmación y el servidor lo explican', async () => {
    serve((call) => (call.init.method === 'DELETE' ? apiFail(409, 'DEPARTMENT_HAS_EMPLOYEES', 'El departamento tiene empleados asignados') : undefined));
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar departamento' }));
    const dialog = await confirmation('¿Eliminar el departamento Producción?', 'alertdialog');
    expect(dialog).toHaveTextContent('Producción tiene 2 empleados asignados: quítalos o asígnalos a otro departamento antes de eliminarlo.');
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('ResponsablesAna Ruiz, Luis Paz, Eva SolEmpleados asignados2');
    expect(dialog).toHaveTextContent('Pasará a «Eliminados»: podrás restaurarlo durante 1 año.');
    await press(dialog, 'Eliminar departamento');
    expect(await screen.findByText('El departamento tiene empleados asignados')).toBeInTheDocument();
  });

  it('sin responsables ni empleados: se elimina y vuelve al listado', async () => {
    serve((call) => {
      if (call.init.method === 'DELETE') return apiOk(null);
      if (call.url.startsWith('/api/employees')) return apiOk(page([]));
      return apiOk({ ...production, managers: [], employee_count: 0, description: null });
    });
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    expect(await screen.findByText('Sin responsables')).toBeInTheDocument();
    expect(await screen.findByText('Sin empleados asignados')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar departamento' }));
    const dialog = await confirmation('¿Eliminar el departamento Producción?', 'alertdialog');
    expect(dialog).toHaveTextContent('Se eliminará Producción y se retirarán sus responsables.');
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('ResponsablesSin responsablesEmpleados asignados0');
    await press(dialog, 'Eliminar departamento');
    expect(await screen.findByText('Lista de departamentos')).toBeInTheDocument();
  });
});

describe('Departamentos: asignar y nombrar responsables', () => {
  const staff = [person(7, 'Ana Ruiz', { department_id: 3, department_name: 'Producción' }), person(11, 'Raúl Soto', { department_id: 4, department_name: 'Almacén' }), person(12, 'Iris Luna', { active: false })];

  it('empleados: asignar, cambiar desde otro departamento y ya asignado', async () => {
    const { calls } = mockFetch((call) => {
      if (call.url.startsWith('/api/employees')) return apiOk(page(staff));
      if (call.init.method === 'POST') return apiOk({ ...production, employee_count: 3 });
      return apiOk(production);
    });
    renderAt('/company/departments/:id/assign/:role', '/company/departments/3/assign/employees', <DepartmentAssignPage />);
    expect(await screen.findByRole('heading', { name: 'Asignar empleados' })).toBeInTheDocument();
    expect(await screen.findByText('Asignado')).toBeInTheDocument();
    expect(screen.getByText('No. EMP-11 · En Almacén')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar aquí: Raúl Soto' }));
    const move = await confirmation('¿Cambiar a Raúl Soto a Producción?', 'alertdialog');
    expect(move).toHaveTextContent('Dejará Almacén: cada empleado está en un solo departamento.');
    expect(within(move).getByRole('region', { name: 'Cambios' })).toHaveTextContent('DepartamentoAntes: AlmacénDespués: Producción');
    expect(within(move).getByRole('region', { name: 'Detalles' })).toHaveTextContent('EmpleadoRaúl Soto · No. EMP-11');
    await press(move, 'Cambiar aquí');
    expect(await screen.findByText('Empleado asignado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getAllByText('Asignado')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Asignar: Iris Luna' }));
    const assign = await confirmation('¿Asignar a Iris Luna a Producción?');
    expect(within(assign).getByRole('region', { name: 'Cambios' })).toHaveTextContent('DepartamentoAntes: Sin departamentoDespués: Producción');
    await press(assign, 'Asignar');
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(2));
    expect(calls.filter((c) => c.init.method === 'POST').map((c) => JSON.parse(c.init.body as string) as object)).toEqual([{ employee_id: 11 }, { employee_id: 12 }]);
  });

  it('cancelar la asignación no envía nada y el empleado sigue donde estaba', async () => {
    const { calls } = mockFetch((call) => apiOk(call.url.startsWith('/api/employees') ? page(staff) : production));
    renderAt('/company/departments/:id/assign/:role', '/company/departments/3/assign/employees', <DepartmentAssignPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar aquí: Raúl Soto' }));
    await press(await confirmation('¿Cambiar a Raúl Soto a Producción?', 'alertdialog'), 'Cancelar');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    expect(screen.getByText('No. EMP-11 · En Almacén')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar aquí: Raúl Soto' })).toBeEnabled();
  });

  it('responsables: nombrar a quien aún no lo es (cancelar primero no envía nada)', async () => {
    const { calls } = mockFetch((call) => {
      if (call.url.startsWith('/api/employees')) return apiOk(page(staff));
      if (call.init.method === 'POST') return apiOk({ ...production, managers: [...production.managers, { employee_id: 11, full_name: 'Raúl Soto', employee_number: 'EMP-11', active: true }] });
      return apiOk(production);
    });
    renderAt('/company/departments/:id/assign/:role', '/company/departments/3/assign/managers', <DepartmentAssignPage />);
    expect(await screen.findByRole('heading', { name: 'Agregar responsables' })).toBeInTheDocument();
    expect(await screen.findByText('Responsable')).toBeInTheDocument(); // Ana ya lo es
    await userEvent.click(screen.getByRole('button', { name: 'Nombrar responsable: Raúl Soto' }));
    await press(await confirmation('¿Nombrar a Raúl Soto responsable de Producción?'), 'Cancelar');
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Nombrar responsable: Raúl Soto' }));
    const dialog = await confirmation('¿Nombrar a Raúl Soto responsable de Producción?');
    expect(dialog).toHaveTextContent('Su departamento asignado no cambia.');
    expect(within(dialog).queryByRole('region', { name: 'Cambios' })).toBeNull();
    await press(dialog, 'Nombrar responsable');
    expect(await screen.findByText('Responsable agregado')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'POST')?.url).toBe('/api/departments/3/managers');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getAllByText('Responsable')).toHaveLength(2);
  });

  it('si el departamento no carga ofrece reintentar', async () => {
    let attempts = 0;
    mockFetch((call) => {
      if (call.url.startsWith('/api/employees')) return apiOk(page(staff));
      attempts += 1;
      return attempts === 1 ? apiFail(500, 'INTERNAL_ERROR') : apiOk(production);
    });
    renderAt('/company/departments/:id/assign/:role', '/company/departments/3/assign/employees', <DepartmentAssignPage />);
    const [retry] = await screen.findAllByRole('button', { name: /Reintentar/ });
    await userEvent.click(retry);
    expect(await screen.findByRole('heading', { name: 'Asignar empleados' })).toBeInTheDocument();
  });
});

describe('Departamentos: más casos del listado', () => {
  it('un solo departamento con dos responsables; su fila abre el detalle', async () => {
    mockFetch(apiOk(page([{ ...production, managers: production.managers.slice(0, 2) }])));
    renderWithProviders(
      <Routes>
        <Route path="/company/departments" element={<DepartmentsPage />} />
        <Route path="/company/departments/:id" element={<p>Detalle del departamento</p>} />
      </Routes>,
      { route: '/company/departments' },
    );
    expect(await screen.findByText('1 departamento · responsables y empleados de cada área')).toBeInTheDocument();
    expect(screen.getByText('Ana Ruiz, Luis Paz')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Producción').closest('tr')!);
    expect(await screen.findByText('Detalle del departamento')).toBeInTheDocument();
  });

  it('una búsqueda sin coincidencias lo dice', async () => {
    mockFetch((call) => apiOk(page(call.url.includes('search=') ? [] : [production])));
    renderWithProviders(<DepartmentsPage />, { route: '/company/departments' });
    await screen.findByText('Producción');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar departamentos' }), 'zzz');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });
});

describe('Departamentos: más casos del formulario', () => {
  it('crea sin descripción (se envía vacía como null) y "Cancelar" vuelve al listado', async () => {
    const { calls } = mockFetch((call) => (call.url.startsWith('/api/validation') ? liveCheck('AVAILABLE', 'Nombre disponible', 'department_name') : apiOk({ ...production, id: 5, name: 'Almacén' }, { status: 201 })));
    renderAt('/company/departments/new', '/company/departments/new', <DepartmentFormPage />);
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Almacén');
    await userEvent.type(screen.getByLabelText(/Descripción/), '   ');
    expect(await screen.findByText('Nombre disponible')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear departamento' }));
    const dialog = await confirmation('¿Crear el departamento Almacén?');
    expect(within(within(dialog).getByRole('region', { name: 'Se creará' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['NombreAlmacén']); // sin descripción: no se lista
    await press(dialog, 'Crear departamento');
    expect(await screen.findByText('Departamento creado')).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.init.method === 'POST')?.init.body as string)).toEqual({ name: 'Almacén', description: null });
  });

  it('"Cancelar" en el alta vuelve al listado y en la edición al detalle', async () => {
    mockFetch((call) => (call.url.startsWith('/api/validation') ? liveCheck() : apiOk(production)));
    const { unmount } = renderAt('/company/departments/new', '/company/departments/new', <DepartmentFormPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Lista de departamentos')).toBeInTheDocument();
    unmount();

    renderAt('/company/departments/:id/edit', '/company/departments/3/edit', <DepartmentFormPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Detalle del departamento')).toBeInTheDocument();
  });

  it('edita, avisa y abre el detalle', async () => {
    const { calls } = mockFetch((call) => {
      if (call.url.startsWith('/api/validation')) return liveCheck('AVAILABLE', 'Nombre disponible', 'department_name');
      return apiOk(call.init.method === 'PUT' ? { ...production, description: 'Pan y bolillo' } : production);
    });
    renderAt('/company/departments/:id/edit', '/company/departments/3/edit', <DepartmentFormPage />);
    const description = await screen.findByLabelText(/Descripción/);
    await userEvent.clear(description);
    await userEvent.type(description, 'Pan y bolillo');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const dialog = await confirmation('¿Guardar los cambios de Producción?');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('DescripciónAntes: Línea de pan dulceDespués: Pan y bolillo');
    await press(dialog, 'Guardar cambios');
    expect(await screen.findByRole('dialog', { name: 'Departamento actualizado' })).toBeInTheDocument();
    expect(await screen.findByText('Detalle del departamento')).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.init.method === 'PUT')?.init.body as string)).toEqual({ name: 'Producción', description: 'Pan y bolillo' });
  });

  it('una descripción guardada antes del límite de 500 caracteres se marca al enviar', async () => {
    const { calls } = mockFetch((call) => (call.url.startsWith('/api/validation') ? liveCheck() : apiOk({ ...production, description: 'x'.repeat(501) })));
    renderAt('/company/departments/:id/edit', '/company/departments/3/edit', <DepartmentFormPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alertdialog', { name: 'Revisa los datos' })).toHaveTextContent('La descripción admite hasta 500 caracteres');
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
  });

  it('si el departamento no carga ofrece volver a cargar', async () => {
    mockFetch(apiFail(404, 'DEPARTMENT_NOT_FOUND', 'Departamento no encontrado'), apiOk(production));
    renderAt('/company/departments/:id/edit', '/company/departments/3/edit', <DepartmentFormPage />);
    await reloadAfter('No se pudo cargar el departamento');
    expect(await screen.findByLabelText(/Nombre/)).toHaveValue('Producción');
  });
});

describe('Departamentos: más casos del detalle', () => {
  it('sin descripción dice cuántos empleados tiene; quitar uno vuelve a pedir la lista (atenuada mientras llega)', async () => {
    const reload = deferred();
    let employeeCalls = 0;
    const single = { ...production, description: null, employee_count: 1 };
    mockFetch((call) => {
      if (call.init.method === 'DELETE') return apiOk({ ...single, employee_count: 0 });
      if (!call.url.startsWith('/api/employees')) return apiOk(single);
      employeeCalls += 1;
      return employeeCalls === 1 ? apiOk(page([person(7, 'Ana Ruiz', { department_id: 3 })])) : reload.promise;
    });
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    expect(await screen.findByText('1 empleado')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar a Ana Ruiz del departamento' }));
    await press(await confirmation('¿Quitar a Ana Ruiz de Producción?', 'alertdialog'), 'Quitar del departamento');
    expect(await screen.findByText('Empleado quitado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar a Ana Ruiz del departamento' }).closest('ul')).toHaveClass('is-loading');
    reload.resolve(apiOk(page([])));
    expect(await screen.findByText('Sin empleados asignados')).toBeInTheDocument();
  });

  it('cancelar la eliminación no borra nada', async () => {
    const { calls } = mockFetch((call) => apiOk(call.url.startsWith('/api/employees') ? page([]) : production));
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar departamento' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
  });

  it('con un solo empleado la confirmación lo dice en singular', async () => {
    mockFetch((call) => apiOk(call.url.startsWith('/api/employees') ? page([]) : { ...production, employee_count: 1 }));
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar departamento' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('tiene 1 empleado asignado: quítalo o asígnalo a otro departamento');
  });

  it('si el departamento no carga ofrece volver a cargar', async () => {
    let attempts = 0;
    mockFetch((call) => {
      if (call.url.startsWith('/api/employees')) return apiOk(page([]));
      attempts += 1;
      return attempts === 1 ? apiFail(404, 'DEPARTMENT_NOT_FOUND', 'Departamento no encontrado') : apiOk(production);
    });
    renderAt('/company/departments/:id', '/company/departments/3', <DepartmentDetailPage />);
    await reloadAfter('No se pudo cargar el departamento');
    expect(await screen.findByRole('heading', { name: 'Producción' })).toBeInTheDocument();
  });
});

describe('Departamentos: más casos de asignar', () => {
  it('buscar atenúa la lista mientras llega y sin coincidencias lo dice', async () => {
    const search = deferred();
    mockFetch((call) => {
      if (!call.url.startsWith('/api/employees')) return apiOk(production);
      return call.url.includes('search=') ? search.promise : apiOk(page([person(11, 'Raúl Soto')]));
    });
    renderAt('/company/departments/:id/assign/:role', '/company/departments/3/assign/employees', <DepartmentAssignPage />);
    const candidates = (await screen.findByText('Raúl Soto')).closest('ul');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar empleados' }), 'zzz');
    await waitFor(() => expect(candidates).toHaveClass('is-loading'));
    search.resolve(apiOk(page([])));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('sin empleados en la empresa invita a registrarlos', async () => {
    mockFetch((call) => apiOk(call.url.startsWith('/api/employees') ? page([]) : production));
    renderAt('/company/departments/:id/assign/:role', '/company/departments/3/assign/managers', <DepartmentAssignPage />);
    expect(await screen.findByText('Sin empleados')).toBeInTheDocument();
  });
});
