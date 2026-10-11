import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { describeChanges, describeValues, emptyValue, namesSummary, SECRET_VALUE, type FieldLabels } from './changes';

interface Values {
  name: string;
  phone: string;
  department: number | null;
  active: boolean;
  days: string[];
  password: string;
  internal: string;
}

const before: Values = { name: 'Ana Ruiz', phone: '', department: 3, active: true, days: ['Lunes'], password: '', internal: 'x' };

const labels: FieldLabels<Values> = {
  name: 'Nombre',
  phone: 'Teléfono',
  department: { label: 'Departamento', format: (id) => (id === null ? 'Sin departamento' : `Depto. ${id}`) },
  active: 'Activo',
  days: 'Días',
  password: { label: 'Contraseña', secret: true },
};

describe('describeChanges', () => {
  it('sin cambios devuelve una lista vacía (espacios sobrantes y vacíos equivalentes no cuentan)', () => {
    expect(describeChanges(before, { ...before, name: '  Ana Ruiz ', phone: '   ' }, labels)).toEqual([]);
    expect(describeChanges({ ...before, days: [] }, { ...before, days: [] }, labels)).toEqual([]);
  });

  it('solo los campos que cambiaron, en el orden de las etiquetas y con su formato', () => {
    const after: Values = { ...before, phone: '6621234567', department: null, active: false, days: ['Lunes', 'Martes'], internal: 'y' };
    expect(describeChanges(before, after, labels)).toEqual([
      { label: 'Teléfono', before: 'Sin capturar', after: '6621234567' },
      { label: 'Departamento', before: 'Depto. 3', after: 'Sin departamento' },
      { label: 'Activo', before: 'Sí', after: 'No' },
      { label: 'Días', before: 'Lunes', after: 'Lunes, Martes' },
    ]);
  });

  it('un secreto nunca muestra su valor; un formato vacío se lee como "Sin capturar"', () => {
    expect(describeChanges(before, { ...before, password: 'Nueva123' }, labels)).toEqual([{ label: 'Contraseña', before: SECRET_VALUE, after: 'Nueva' }]);
    const blank: FieldLabels<Values> = { name: { label: 'Nombre', format: (value) => (value === 'Ana Ruiz' ? '' : value) } };
    expect(describeChanges(before, { ...before, name: 'Ana' }, blank)).toEqual([{ label: 'Nombre', before: emptyValue(), after: 'Ana' }]);
  });

  it('números y objetos se comparan por su valor', () => {
    expect(describeChanges({ n: 1, o: { a: 1 } }, { n: 2, o: { a: 1 } }, { n: 'N', o: { label: 'O', format: () => 'objeto' } })).toEqual([{ label: 'N', before: '1', after: '2' }]);
  });
});

describe('describeValues', () => {
  it('"Etiqueta: valor" de los campos con valor (los vacíos se omiten y el secreto se oculta)', () => {
    expect(describeValues({ ...before, password: 'Secreta123456' }, labels)).toEqual([
      { label: 'Nombre', value: 'Ana Ruiz' },
      { label: 'Departamento', value: 'Depto. 3' },
      { label: 'Activo', value: 'Sí' },
      { label: 'Días', value: 'Lunes' },
      { label: 'Contraseña', value: SECRET_VALUE },
    ]);
  });
});

describe('en inglés (en-US)', () => {
  it('describeChanges: "Not provided", "Yes"/"No" y "New" para un secreto; las etiquetas las da quien llama', async () => {
    await setLocale('en-US');
    const english: FieldLabels<Values> = { phone: 'Phone', active: 'Active', password: { label: 'Password', secret: true } };
    expect(describeChanges(before, { ...before, phone: '6621234567', active: false, password: 'Nueva123' }, english)).toEqual([
      { label: 'Phone', before: 'Not provided', after: '6621234567' },
      { label: 'Active', before: 'Yes', after: 'No' },
      { label: 'Password', before: SECRET_VALUE, after: 'New' },
    ]);
    expect(emptyValue()).toBe('Not provided');
  });

  it('describeValues: los valores legibles en inglés y el secreto oculto', async () => {
    await setLocale('en-US');
    expect(describeValues({ ...before, active: false, password: 'x' }, { active: 'Active', password: { label: 'Password', secret: true } })).toEqual([
      { label: 'Active', value: 'No' },
      { label: 'Password', value: SECRET_VALUE },
    ]);
  });

  it('namesSummary: nombres unidos como en inglés y "and N more"', async () => {
    await setLocale('en-US');
    const employees = (count: number) => (count === 1 ? '1 employee' : `${count} employees`);
    expect(namesSummary(['Ana', 'Luis', 'Eva'], 3, employees)).toBe('Ana, Luis, and Eva');
    expect(namesSummary(['Ana', 'Luis', 'Eva'], 1203, employees, 2)).toBe('Ana, Luis, and 1,201 more');
    expect(namesSummary(['Ana'], 12, employees)).toBe('Ana and 11 more');
    expect(namesSummary([], 12, employees)).toBe('12 employees');
  });
});

describe('namesSummary', () => {
  const noun = (count: number) => (count === 1 ? '1 empleado' : `${count} empleados`);
  it('todos los nombres unidos en español; con más de los que se muestran, "y N más"', () => {
    expect(namesSummary(['Ana'], 1, noun)).toBe('Ana');
    expect(namesSummary(['Ana', 'Luis', 'Eva'], 3, noun)).toBe('Ana, Luis y Eva');
    expect(namesSummary(['Ana', 'Luis', 'Eva'], 3, noun, 2)).toBe('Ana, Luis y 1 más');
    expect(namesSummary(['Ana'], 12, noun)).toBe('Ana y 11 más'); // los demás se eligieron sin conocer su nombre
  });

  it('sin ningún nombre conocido, solo cuántos son', () => {
    expect(namesSummary([], 1, noun)).toBe('1 empleado');
    expect(namesSummary([], 12, noun)).toBe('12 empleados');
  });
});
