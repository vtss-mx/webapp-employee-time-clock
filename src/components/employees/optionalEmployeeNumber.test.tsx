import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { subjectOf } from '../../pages/admin/fraud/FraudCasesPage';
import { renderWithProviders } from '../../test/render';
import type { BulkResult, FraudCase, VerificationResult } from '../../types';
import { BulkResultSummary } from '../BulkResultSummary';
import { EmployeeCard } from '../calendar/EmployeeCard';
import { VerificationResultCard } from '../VerificationResultCard';
import { EmployeePicker } from './EmployeePicker';
import { ana, beto, pickerServer } from './testData';

/**
 * El número de empleado es OPCIONAL (decisión del dueño del producto; backend, migración 0076): lo que lo mostraba como
 * dato secundario lo omite y lo que nombraba a la persona («Ana Ruiz · EMP-7») usa solo su nombre. Nunca «null» ni un
 * separador colgando.
 */
describe('sin número de empleado', () => {
  it('el resultado de una identificación no muestra la fila del número', () => {
    const result: VerificationResult = { verified: true, method: 'FACE', message: 'Identidad confirmada', employee_id: 7, employee_number: null, name: 'Ana Ruiz', confidence: 0.9, verified_at: '2026-10-01T10:00:00Z' };
    render(<VerificationResultCard result={result} failureTitle="No" onRetry={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.queryByText('Número')).toBeNull();
    expect(document.body).not.toHaveTextContent('null');
  });

  it('el resultado de una operación masiva lo nombra solo por su nombre', () => {
    const result: BulkResult = {
      done: 1,
      unchanged: 0,
      skipped: 1,
      results: [
        { employee: { id: 7, full_name: 'Ana Ruiz', employee_number: null }, result: 'DONE', code: null, message: null },
        { employee: { id: 8, full_name: 'Beto Díaz', employee_number: 'EMP-8' }, result: 'SKIPPED', code: 'EMPLOYEE_INACTIVE', message: 'Inactivo' },
      ],
    };
    render(<BulkResultSummary result={result} copy={{ title: 'Turno asignado', done: 'Asignados', unchanged: 'Ya lo tenían', skipped: 'Sin asignar' }} />);
    expect(screen.getByText('Ana Ruiz').closest('.bulk-result__who')).toHaveTextContent(/^Ana Ruiz$/);
    expect(screen.getByText('No. EMP-8')).toBeInTheDocument();
  });

  it('su tarjeta del calendario y su caso de fraude: solo el nombre', () => {
    render(
      <EmployeeCard employee={{ id: 7, full_name: 'Ana Ruiz', employee_number: null }} badges={null}>
        {null}
      </EmployeeCard>,
    );
    expect(screen.getByText('Ana Ruiz').closest('.shift-item, li, div')).not.toHaveTextContent('·');
    const fraud = { employee: { id: 7, full_name: 'Ana Ruiz', employee_number: null }, actor: null } as FraudCase;
    expect(subjectOf(fraud)).toBe('Ana Ruiz');
    expect(subjectOf({ ...fraud, employee: { id: 8, full_name: 'Beto Díaz', employee_number: 'EMP-8' } })).toBe('Beto Díaz · EMP-8');
  });

  it('el selector de empleados describe solo su departamento', async () => {
    pickerServer(() => null, { people: [{ ...ana, employee_number: null }, { ...beto, employee_number: null, department_name: null }] });
    function Harness() {
      const [value, setValue] = useState<number[]>([]);
      return <EmployeePicker value={value} onChange={(ids) => setValue(ids)} />;
    }
    renderWithProviders(<Harness />);
    const row = (await screen.findByText('Ana Ruiz')).closest('label') as HTMLElement;
    expect(within(row).getByText('Producción')).toBeInTheDocument();
    expect(row).not.toHaveTextContent('No.');
    expect((screen.getByText('Beto Díaz').closest('label') as HTMLElement)).not.toHaveTextContent('·');
  });
});
