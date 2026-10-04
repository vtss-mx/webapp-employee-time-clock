import { describe, expect, it } from 'vitest';
import { Users } from 'lucide-react';
import { currentEntry } from './MobileBar';

describe('MobileBar: pantalla actual', () => {
  const nav = [
    { to: '/company/employees', label: 'Empleados', icon: Users },
    { to: '/company/employees-archive', label: 'Archivo', icon: Users },
    { to: '/profile', label: 'Mi perfil', icon: Users },
  ];

  it('elige la opción cuya ruta contiene la actual (subpantallas incluidas), sin confundir prefijos', () => {
    expect(currentEntry(nav, '/company/employees/3/edit')?.label).toBe('Empleados');
    expect(currentEntry(nav, '/company/employees-archive')?.label).toBe('Archivo');
    expect(currentEntry(nav, '/otra')).toBeUndefined();
  });
});

describe('MobileBar: rutas anidadas en el menú', () => {
  it('con varias opciones que contienen la ruta actual, gana la más específica', () => {
    const nested = [
      { to: '/company', label: 'Empresa', icon: Users },
      { to: '/company/employees', label: 'Empleados', icon: Users },
      { to: '/company/employees/new', label: 'Alta', short: 'Nuevo', icon: Users },
    ];
    expect(currentEntry(nested, '/company/employees/new')?.label).toBe('Alta');
    expect(currentEntry(nested, '/company/employees/9')?.label).toBe('Empleados');
    expect(currentEntry(nested, '/company/settings')?.label).toBe('Empresa');
  });
});
