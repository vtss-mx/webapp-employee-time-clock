import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { adminUser, sessionOf } from '../test/companyPages';
import { AnalyticsTracker } from './AnalyticsTracker';

const analytics = vi.hoisted(() => ({ trackScreen: vi.fn(), trackRole: vi.fn() }));
vi.mock('../services/analytics', () => analytics);

afterEach(() => vi.clearAllMocks());

describe('AnalyticsTracker', () => {
  it('registra cada pantalla al navegar y el rol de la cuenta (o ninguno sin sesión)', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/company/employees/7']}>
        <AuthContext.Provider value={sessionOf(adminUser)}>
          <AnalyticsTracker />
          <Link to="/company/shifts">Turnos</Link>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(analytics.trackScreen).toHaveBeenLastCalledWith('/company/employees/7');
    expect(analytics.trackRole).toHaveBeenLastCalledWith('ADMIN');
    await userEvent.click(document.querySelector('a')!);
    expect(analytics.trackScreen).toHaveBeenLastCalledWith('/company/shifts');

    rerender(
      <MemoryRouter>
        <AuthContext.Provider value={sessionOf(null)}>
          <AnalyticsTracker />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(analytics.trackRole).toHaveBeenLastCalledWith(null);
  });
});
