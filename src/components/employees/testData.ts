import { apiOk, mockFetch, type MockCall } from '../../test/http';
import type { Employee } from '../../types';

/** Datos de prueba del selector de empleados (los comparten las pantallas que lo usan). */
export const ana = { id: 7, first_name: 'Ana', last_name: 'Ruiz', full_name: 'Ana Ruiz', employee_number: 'EMP-7', department_name: 'Producción', active: true } as Employee;
export const beto = { id: 8, first_name: 'Beto', last_name: 'Díaz', full_name: 'Beto Díaz', employee_number: 'EMP-8', department_name: null, active: false } as Employee;
export const page = <T,>(items: T[], total = items.length) => ({ items, total, page: 1, size: 10 });
const production = { id: 2, name: 'Producción', description: null, employee_count: 1, managers: [], created_at: 'x', updated_at: 'x' };

/** Empleados, departamentos y los ids de un filtro, como los responde el servidor. */
export function pickerServer(extra: (call: MockCall) => Response | null = () => null, { people = [ana, beto], departments = [production] } = {}) {
  return mockFetch((call) => {
    const answer = extra(call);
    if (answer) return answer;
    if (call.url.startsWith('/api/departments')) return apiOk(page(departments));
    if (call.url.startsWith('/api/employees/ids')) return apiOk({ ids: people.map((p) => p.id), total: people.length, limit: 500 });
    return apiOk(page(people));
  });
}
