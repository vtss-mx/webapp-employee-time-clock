import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { User } from '../types';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';

/** Renderiza con router en memoria, mensajes (popup) y (opcional) sesión. */
export function renderWithProviders(ui: ReactElement, { route = '/', auth = false } = {}): RenderResult {
  const content = auth ? <AuthProvider>{ui}</AuthProvider> : ui;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <FeedbackProvider>{content}</FeedbackProvider>
    </MemoryRouter>,
  );
}

export const sampleUser: User = {
  id: 1,
  email: 'ana@empresa.com',
  role: 'EMPLOYEE',
  active: true,
  last_login_at: null,
  created_at: '2026-01-01T00:00:00Z',
  employee: {
    id: 7,
    employee_number: 'EMP-7',
    first_name: 'Ana',
    last_name: 'Ruiz',
    full_name: 'Ana Ruiz',
    active: true,
    headwear_exempt: false,
    face_status: 'APPROVED',
    face_rejection_reason: null,
  },
};

export function tokenResponse(user: User = sampleUser, expiresIn = 43_200) {
  return {
    access_token: `token-${Math.random()}`,
    token_type: 'Bearer',
    expires_in: expiresIn,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    session_id: 'sid-1',
    user,
  };
}
