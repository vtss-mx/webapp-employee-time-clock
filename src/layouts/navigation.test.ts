import { describe, expect, it } from 'vitest';
import { sampleUser } from '../test/render';
import { withScreens } from '../test/screens';
import { navFor, navGroups } from './navigation';

describe('menú por módulos', () => {
  it('agrupa las pantallas en los módulos que envía el backend, en su orden', () => {
    const user = withScreens({ ...sampleUser, role: 'ADMIN', employee: null });
    const groups = navGroups(user, navFor(user));
    expect(groups.map((g) => [g.code, g.name, g.entries.map((e) => e.to)])).toEqual([
      ['PLATFORM', 'Plataforma', ['/admin/dashboard', '/admin/companies']],
      ['OPERATIONS', 'Operación', ['/admin/errors', '/admin/face-security']],
      ['ACCOUNT', 'Cuenta', ['/profile']],
    ]);
  });

  it('sin módulos (o con pantallas sin módulo conocido) quedan al final, en un grupo sin encabezado', () => {
    const user = withScreens({ ...sampleUser, role: 'ADMIN', employee: null });
    const legacy = { ...user, modules: undefined, screens: user.screens.map((s) => ({ ...s, module: undefined })) };
    expect(navGroups(legacy, navFor(legacy)).map((g) => [g.code, g.name, g.entries.length])).toEqual([['', '', 5]]);
    const unknown = { ...user, screens: user.screens.map((s) => (s.code === 'PROFILE' ? { ...s, module: 'OTRO' } : s)) };
    expect(navGroups(unknown, navFor(unknown)).map((g) => g.code)).toEqual(['PLATFORM', 'OPERATIONS', '']);
  });
});
