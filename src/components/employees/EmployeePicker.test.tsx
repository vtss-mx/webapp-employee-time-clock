import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { apiFail, apiOk } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { BulkResult } from '../../types';
import { bulkResultMessage, BulkResultSummary } from '../BulkResultSummary';
import { describeEmployees, EmployeePicker, type EmployeePickerProps } from './EmployeePicker';
import { page, pickerServer } from './testData';

function Harness(props: Partial<EmployeePickerProps>) {
  const [value, setValue] = useState<number[]>([]);
  const [names, setNames] = useState<string[]>([]);
  return (
    <>
      <EmployeePicker
        value={value}
        onChange={(ids, known) => {
          setValue(ids);
          setNames(known);
        }}
        {...props}
      />
      <output data-testid="chosen">{value.join(',')}</output>
      <output data-testid="names">{names.join(',')}</output>
    </>
  );
}

const chosen = () => screen.getByTestId('chosen').textContent;
const names = () => screen.getByTestId('names').textContent;

afterEach(() => vi.unstubAllGlobals());

describe('EmployeePicker', () => {
  it('elige y quita empleados; "seleccionar a todos" pide los ids al servidor', async () => {
    const { calls } = pickerServer();
    renderWithProviders(<Harness hint="Se les asignará el turno" />);
    const anaBox = await screen.findByRole('checkbox', { name: /Ana Ruiz/ });
    expect(screen.getByText('No. EMP-7 · Producción')).toBeInTheDocument();
    expect(within(screen.getByRole('checkbox', { name: /Beto Díaz/ }).closest('label') as HTMLElement).getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByText('Nadie elegido')).toBeInTheDocument();
    expect(screen.getByText('Se les asignará el turno')).toBeInTheDocument();
    await userEvent.click(anaBox);
    expect(chosen()).toBe('7');
    expect(names()).toBe('Ana Ruiz'); // con su nombre, para la confirmación
    expect(screen.getByText('1 empleado elegido')).toBeInTheDocument();
    await userEvent.click(anaBox);
    expect(chosen()).toBe('');

    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar a los 2' }));
    await waitFor(() => expect(chosen()).toBe('7,8'));
    expect(names()).toBe('Ana Ruiz,Beto Díaz');
    expect(screen.getByText('2 empleados elegidos')).toBeInTheDocument();
    expect(calls.find((c) => c.url.startsWith('/api/employees/ids'))?.url).toBe('/api/employees/ids');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar selección' }));
    expect(chosen()).toBe('');
  });

  it('los elegidos del filtro que no se han visto en la lista llegan sin nombre', async () => {
    pickerServer((call) => (call.url.startsWith('/api/employees/ids') ? apiOk({ ids: [7, 99], total: 2, limit: 500 }) : null));
    renderWithProviders(<Harness />);
    await screen.findByRole('checkbox', { name: /Ana Ruiz/ });
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar a los 2' }));
    await waitFor(() => expect(chosen()).toBe('7,99'));
    expect(names()).toBe('Ana Ruiz');
  });

  it('con filtros: los ids son los del filtro y, si pasan del tope, avisa que se eligieron los primeros', async () => {
    let idsCalls = 0;
    const { calls } = pickerServer((call) => {
      if (!call.url.startsWith('/api/employees/ids')) return null;
      idsCalls += 1;
      return idsCalls === 1 ? apiOk({ ids: [7], total: 600, limit: 500 }) : apiFail(500, 'INTERNAL_ERROR', 'Falla');
    });
    renderWithProviders(<Harness />);
    await screen.findByRole('checkbox', { name: /Ana Ruiz/ });
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por departamento/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Producción' }));
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Activos' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('department_id=2') && c.url.includes('active=true'))).toBe(true));
    await userEvent.click(await screen.findByRole('button', { name: 'Seleccionar los 2 de este filtro' }));
    const warning = await screen.findByRole('alertdialog', { name: 'Se alcanzó el límite' });
    expect(warning).toHaveTextContent('El filtro tiene 600 empleados y el máximo por operación es 500: se eligieron los primeros 1');
    await userEvent.click(within(warning).getByRole('button', { name: 'Entendido' }));
    expect(chosen()).toBe('7');
    expect(calls.find((c) => c.url.startsWith('/api/employees/ids'))?.url).toBe('/api/employees/ids?active=true&department_id=2');

    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Inactivos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Seleccionar los 2 de este filtro' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron seleccionar los empleados' })).toBeInTheDocument();
    expect(calls.filter((c) => c.url.startsWith('/api/employees/ids')).at(-1)?.url).toBe('/api/employees/ids?active=false&department_id=2');
  });

  it('una sola persona: elegir otra reemplaza a la anterior; sin selección masiva', async () => {
    pickerServer(() => null, { departments: [] });
    renderWithProviders(<Harness single error="Elige al empleado" />);
    await userEvent.click(await screen.findByRole('checkbox', { name: /Ana Ruiz/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Beto Díaz/ }));
    expect(chosen()).toBe('8');
    await userEvent.click(screen.getByRole('checkbox', { name: /Beto Díaz/ }));
    expect(chosen()).toBe('');
    expect(screen.queryByRole('button', { name: /Seleccionar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Filtrar por departamento/ })).toBeNull(); // sin departamentos
    expect(screen.getByRole('alert')).toHaveTextContent('Elige al empleado');
  });

  it('estados vacíos: sin empleados y sin coincidencias', async () => {
    pickerServer((call) => (call.url.includes('search=zz') ? apiOk(page([])) : null), { people: [] });
    const { unmount } = renderWithProviders(<Harness />);
    expect(await screen.findByText('Sin empleados')).toBeInTheDocument();
    unmount();
    pickerServer((call) => (call.url.includes('search=zz') ? apiOk(page([])) : null));
    renderWithProviders(<Harness />);
    await screen.findByRole('checkbox', { name: /Ana Ruiz/ });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar empleados' }), 'zz');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });
});

describe('resultado de una operación masiva', () => {
  const outcome = (id: number, result: 'DONE' | 'UNCHANGED' | 'SKIPPED', message: string | null = null) => ({
    employee: { id, full_name: `Persona ${id}`, employee_number: `EMP-${id}` },
    result,
    code: message ? 'EMPLOYEE_INACTIVE' : null,
    message,
  });
  const copy = { title: 'Turno asignado', done: 'Asignado', unchanged: 'Ya lo tenían', skipped: 'No se asignó' };

  it('omitidos primero con su motivo; de los demás, algunos nombres y cuántos más', () => {
    const done = Array.from({ length: 10 }, (_, i) => outcome(i + 1, 'DONE'));
    const result: BulkResult = { done: 10, unchanged: 1, skipped: 1, results: [...done, outcome(20, 'UNCHANGED'), outcome(21, 'SKIPPED', 'El empleado está inactivo')] };
    const message = bulkResultMessage(result, copy);
    expect(message).toMatchObject({ variant: 'warning', title: 'Turno asignado con omisiones', text: 'Asignado: 10 · Ya lo tenían: 1 · No se asignó: 1' });
    renderWithProviders(<BulkResultSummary result={result} copy={copy} />);
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings).toEqual([' No se asignó 1', ' Asignado 10', ' Ya lo tenían 1']);
    expect(screen.getByText('El empleado está inactivo')).toBeInTheDocument();
    expect(screen.getByText('y 2 más')).toBeInTheDocument();
  });

  it('sin omisiones es un aviso de éxito', () => {
    const result: BulkResult = { done: 1, unchanged: 0, skipped: 0, results: [outcome(1, 'DONE')] };
    const message = bulkResultMessage(result, copy);
    expect(message).toMatchObject({ variant: 'success', title: 'Turno asignado', text: 'Asignado: 1' });
    renderWithProviders(<>{message.body}</>);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([' Asignado 1']); // sin grupos vacíos
  });
});

describe('EmployeePicker: fallas, confirmaciones e inglés', () => {
  it.each([
    ['los departamentos', '/api/departments', 'No se pudieron cargar los departamentos'],
    ['los empleados', '/api/employees', 'No se pudieron cargar los empleados'],
  ])('si %s no cargan lo explica con su título', async (_, failing, title) => {
    pickerServer((call) => (call.url.startsWith(failing) ? apiFail(403, 'FORBIDDEN', 'Sin acceso') : null));
    renderWithProviders(<Harness />);
    expect(await screen.findByRole('alertdialog', { name: title })).toHaveTextContent('Sin acceso');
  });

  it('a quiénes afecta: con nombres, sin ninguno conocido y en inglés', async () => {
    expect(describeEmployees(1, ['Ana Ruiz'])).toEqual({ label: 'Empleado', value: 'Ana Ruiz' });
    expect(describeEmployees(12, [])).toEqual({ label: 'Empleados (12)', value: '12 empleados' });
    await setLocale('en-US');
    expect(describeEmployees(12, [])).toEqual({ label: 'Employees (12)', value: '12 employees' });
    expect(describeEmployees(3, ['Ana', 'Luis'])).toEqual({ label: 'Employees (3)', value: 'Ana, Luis, and 1 more' });
  });

  it('en inglés: búsqueda, cuántos van elegidos y la selección masiva', async () => {
    await setLocale('en-US');
    pickerServer();
    renderWithProviders(<Harness />);
    const ana = await screen.findByRole('checkbox', { name: /Ana Ruiz/ });
    expect(screen.getByRole('group', { name: 'Employees' })).toBeInTheDocument();
    expect(screen.getByText('No one selected')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search employees' })).toHaveAttribute('placeholder', 'Search by name, number or email');
    expect(screen.getByText('No. EMP-7 · Producción')).toBeInTheDocument();
    await userEvent.click(ana);
    expect(screen.getByText('1 employee selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Select all 2' }));
    expect(await screen.findByText('2 employees selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByText('No one selected')).toBeInTheDocument();
  });
});
