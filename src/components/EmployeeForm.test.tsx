import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WithCatalogs } from '../test/render';
import type { EmployeeFormValues, LiveChecks } from '../types';
import { emptyEmployeeForm } from '../utils/formRules';
import { EmployeeFormFields, HeadwearExemptField } from './EmployeeForm';

type Field = keyof EmployeeFormValues;

interface HarnessProps {
  isEdit?: boolean;
  onTouch?: (field: Field) => void;
  live?: Partial<LiveChecks>;
  accountLocked?: boolean;
}

function Harness({ isEdit = false, onTouch, live, accountLocked }: HarnessProps) {
  const [values, setValues] = useState<EmployeeFormValues>(emptyEmployeeForm);
  return <EmployeeFormFields values={values} errors={{}} onChange={setValues} onTouch={onTouch} isEdit={isEdit} live={live} accountLocked={accountLocked} />;
}

const touched = (onTouch: ReturnType<typeof vi.fn>) => onTouch.mock.calls.map(([field]) => field as Field);

describe('EmployeeFormFields: cuándo se marca un campo como tocado', () => {
  it('fecha de nacimiento: solo al quedar completa (una fecha a medias aún no muestra su error)', async () => {
    const onTouch = vi.fn();
    render(<Harness onTouch={onTouch} />, { wrapper: WithCatalogs });
    const birth = screen.getByLabelText('Fecha de nacimiento');
    await userEvent.type(birth, '1503');
    expect(touched(onTouch)).not.toContain('birth_date');
    await userEvent.type(birth, '1990');
    expect(birth).toHaveValue('15/03/1990');
    expect(touched(onTouch)).toContain('birth_date');
  });

  it('teléfono: al salir del campo', async () => {
    const onTouch = vi.fn();
    render(<Harness onTouch={onTouch} />, { wrapper: WithCatalogs });
    await userEvent.click(screen.getByLabelText('Teléfono celular'));
    await userEvent.tab();
    expect(touched(onTouch)).toEqual(['phone']);
  });
});

describe('EmployeeFormFields: contraseña al editar', () => {
  it('la confirmación aparece solo cuando se escribe una contraseña nueva', async () => {
    render(<Harness isEdit onTouch={vi.fn()} />, { wrapper: WithCatalogs });
    expect(screen.queryByLabelText('Confirmar contraseña')).toBeNull();
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Nueva123');
    expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Nueva contraseña'));
    expect(screen.queryByLabelText('Confirmar contraseña')).toBeNull();
  });
});

describe('HeadwearExemptField', () => {
  it('deshabilitado (p. ej. mientras se guarda): se ve atenuado y no cambia', async () => {
    const onChange = vi.fn();
    render(<HeadwearExemptField checked={false} onChange={onChange} disabled />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.closest('label')).toHaveClass('is-disabled');
    await userEvent.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('EmployeeFormFields: escritura y datos únicos', () => {
  it('RFC y CURP en mayúsculas sin guiones; NSS solo dígitos; cada uno con su largo máximo', async () => {
    render(<Harness />, { wrapper: WithCatalogs });
    await userEvent.type(screen.getByLabelText('RFC'), 'pegj-900515-ab1-extra');
    await userEvent.type(screen.getByLabelText('CURP'), 'hegg-560427-mvzrrl04-x');
    await userEvent.type(screen.getByLabelText('No. de Seguridad Social (NSS)'), '1234-5678-903-99');
    expect(screen.getByLabelText('RFC')).toHaveValue('PEGJ900515AB1');
    expect(screen.getByLabelText('CURP')).toHaveValue('HEGG560427MVZRRL04');
    expect(screen.getByLabelText('No. de Seguridad Social (NSS)')).toHaveValue('12345678903');
  });

  it('la validación en vivo marca el dato ocupado y confirma el disponible', () => {
    const live: Partial<LiveChecks> = {
      rfc: { status: 'taken', message: 'Ese RFC ya está registrado' },
      email: { status: 'available', message: 'Correo disponible' },
      phone: { status: 'checking' },
    };
    render(<Harness live={live} />, { wrapper: WithCatalogs });
    expect(screen.getByLabelText('RFC')).toHaveAccessibleDescription('Ese RFC ya está registrado');
    expect(screen.getByLabelText('Correo electrónico')).toHaveAccessibleDescription('Correo disponible');
    expect(screen.getByLabelText('Teléfono celular')).toHaveAccessibleDescription('Verificando disponibilidad…');
  });

  it('cuenta compartida con otra empresa: correo y teléfono bloqueados y sin contraseña', () => {
    render(<Harness accountLocked />, { wrapper: WithCatalogs });
    const hint = 'Cuenta compartida con otra empresa: solo la persona puede cambiarlo';
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAccessibleDescription(hint);
    expect(screen.getByLabelText('Teléfono celular')).toBeDisabled();
    expect(screen.getByLabelText('Teléfono celular')).toHaveAccessibleDescription(hint);
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
  });
});
