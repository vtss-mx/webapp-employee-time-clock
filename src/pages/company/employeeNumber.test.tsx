import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ana, answer, fillEmployee, live, luis, page, posted, renderEmployees, serveEmployee as serve } from '../../test/employees';
import { apiOk, mockFetch } from '../../test/http';

/**
 * El número de empleado es OPCIONAL (decisión del dueño del producto; backend, migración 0076), con el mismo contrato que
 * el RFC, la CURP y el NSS: sin asterisco, con la ayuda «Opcional · …», validado solo con valor, vacío viaja como null y
 * borrarlo al editar se confirma «antes → Sin capturar».
 */
afterEach(() => vi.unstubAllGlobals());

describe('Empleados: número de empleado opcional', () => {
  it('un empleado sin número se lista solo con su nombre', async () => {
    mockFetch(apiOk(page([{ ...ana, employee_number: null }, luis])));
    renderEmployees('/company/employees');
    const row = (await screen.findByText('Ana Ruiz')).closest('tr')!;
    expect(row.querySelector('.person__info small')).toBeNull();
    expect(within(screen.getByText('Luis Paz').closest('tr')!).getByText('EMP-8')).toBeInTheDocument();
  });

  it('sin número de empleado (opcional): sin asterisco, no se consulta en vivo, se registra y viaja como null', async () => {
    const { calls } = mockFetch((call) => (call.url.startsWith('/api/validation') ? live(call) : apiOk({ ...ana, id: 9, employee_number: null, full_name: 'Eva Sol' }, { status: 201 })));
    renderEmployees('/company/employees/new');
    const number = screen.getByLabelText('No. de empleado');
    expect(number).not.toBeRequired();
    expect(screen.getByText('Opcional · único, con letras, números, guion o guion bajo')).toBeInTheDocument();
    await fillEmployee();
    await userEvent.clear(number);
    await userEvent.type(number, '   ');
    const register = screen.getByRole('button', { name: 'Registrar empleado' });
    await waitFor(() => expect(register).toBeEnabled());
    await userEvent.click(register);
    const confirm = await answer('dialog', '¿Registrar a Eva Sol?', 'Registrar empleado');
    expect(within(confirm).getByRole('region', { name: 'Se registrará' })).not.toHaveTextContent('No. de empleado');
    await screen.findByText('Expediente del empleado');
    expect(posted(calls, 'POST').body).toMatchObject({ employee_number: null, rfc: 'RUAA900101AB1' });
    // Vacío no se consulta en vivo (a lo más, lo que se escribió antes de borrarlo).
    const numbers = calls.filter((c) => c.url.includes('field=employee_number')).map((c) => new URL(c.url, 'http://localhost').searchParams.get('value') ?? '');
    expect(numbers.filter((value) => !value.trim())).toEqual([]);
  });

  it('un número con formato inválido se marca solo cuando se escribe', async () => {
    mockFetch((call) => live(call));
    renderEmployees('/company/employees/new');
    const number = screen.getByLabelText('No. de empleado');
    await userEvent.type(number, 'EMP 1');
    await userEvent.tab();
    expect(number).toHaveAccessibleDescription(/1-30 caracteres: letras, números, guion o guion bajo/);
    await userEvent.clear(number);
    expect(number).not.toHaveAccessibleDescription(/1-30 caracteres/);
  });

  it('borrar el número de empleado se confirma "antes → Sin capturar" y viaja como null', async () => {
    const { calls } = serve(ana);
    renderEmployees('/company/employees/7/edit');
    await userEvent.clear(await screen.findByLabelText('No. de empleado'));
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    const confirm = await answer('dialog', '¿Guardar los cambios de Ana Ruiz?', 'Guardar cambios');
    const rows = within(within(confirm).getByRole('region', { name: 'Cambios' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['No. de empleadoAntes: EMP-7Después: Sin capturar']);
    await screen.findByText('Expediente del empleado');
    expect(posted(calls, 'PUT').body).toEqual({ employee_number: null });
  });

  it('un empleado sin número se edita sin pedirlo; agregarle uno lo valida en vivo', async () => {
    const { calls } = serve({ ...ana, employee_number: null });
    renderEmployees('/company/employees/7/edit');
    const number = await screen.findByLabelText('No. de empleado');
    expect(number).toHaveValue('');
    await userEvent.type(number, 'EMP-20');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    await waitFor(() => expect(save).toBeEnabled());
    expect(calls.some((c) => c.url.startsWith('/api/validation') && c.url.includes('field=employee_number'))).toBe(true);
    await userEvent.click(save);
    const confirm = await answer('dialog', '¿Guardar los cambios de Ana Ruiz?', 'Guardar cambios');
    expect(within(confirm).getByRole('region', { name: 'Cambios' })).toHaveTextContent('No. de empleadoAntes: Sin capturarDespués: EMP-20');
    await screen.findByText('Expediente del empleado');
    expect(posted(calls, 'PUT').body).toEqual({ employee_number: 'EMP-20' });
  });

});
