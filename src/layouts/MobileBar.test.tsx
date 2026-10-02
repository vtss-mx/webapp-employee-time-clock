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
