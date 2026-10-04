import { Circle, Users } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { iconFor } from './screens';

describe('íconos del menú', () => {
  it('el ícono que envía el backend se dibuja; uno que la app aún no conoce usa un círculo genérico', () => {
    expect(iconFor('Users')).toBe(Users);
    expect(iconFor('IconoDeUnaVersionNueva')).toBe(Circle);
  });
});
