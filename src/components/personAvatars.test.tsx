/**
 * Cada persona en una tabla, lista o tarjeta muestra su foto de perfil si tiene (la ruta versionada `avatar` que
 * manda el backend) y, si no, sus iniciales (decisión del dueño, 2026-10-06). La foto se pide por la API con la
 * sesión (`Avatar` → `avatarService.image` → URL `blob:` local); si no llega se quedan las iniciales, sin popup.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FraudSubject } from '../pages/admin/fraud/FraudCasesPage';
import { apiFail, apiOk, mockFetch } from '../test/http';
import type { FraudCase, VerificationResult } from '../types';
import { clearAvatarCache } from '../utils/avatarCache';
import { Avatar } from './ui/Avatar';
import { VerificationResultCard } from './VerificationResultCard';

const ANA = '/users/7/avatar?v=a1';
const photo = () => apiOk({ user_id: 7, size_px: 96, version: 'a1', content_type: 'image/webp', data: btoa('RIFF') });

/** Las fotos que se ven (img con su URL local) y las iniciales que siguen solas. */
const photos = (root: ParentNode) => [...root.querySelectorAll('img.avatar__image')].map((img) => img.getAttribute('src'));
const initialsOnly = (root: ParentNode) => [...root.querySelectorAll('.avatar:not(.has-image) .avatar__initials')].map((node) => node.textContent);

beforeEach(() => {
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:ana'), revokeObjectURL: vi.fn() });
});
afterEach(() => {
  clearAvatarCache();
  vi.unstubAllGlobals();
});

describe('personas con su foto o sus iniciales', () => {
  it('una lista mezcla fotos e iniciales y pide cada foto una sola vez', async () => {
    const { calls } = mockFetch((call) => (call.url.startsWith('/api/users/7/avatar') ? photo() : apiFail(404, 'AVATAR_NOT_FOUND', 'No existe')));
    const { container } = render(
      <ul>
        <Avatar name="Ana Ruiz" src={ANA} />
        <Avatar name="Luis Paz" />
        <Avatar name="Ana Ruiz" src={ANA} />
        <Avatar name="Eva Sol" src="/users/9/avatar?v=e1" />
      </ul>,
    );
    await waitFor(() => expect(photos(container)).toEqual(['blob:ana', 'blob:ana']));
    // Eva no se pudo leer (404): se quedan sus iniciales, sin popup; Luis no tiene foto.
    expect(initialsOnly(container)).toEqual(['LP', 'ES']);
    expect(calls.map((call) => call.url)).toEqual(['/api/users/7/avatar?v=a1&size=96', '/api/users/9/avatar?v=e1&size=96']);
  });

  it('la persona identificada en un validador (con o sin nombre) y el sujeto de un caso de fraude', async () => {
    mockFetch(photo);
    const verified: VerificationResult = {
      verified: true,
  verification_status: 'APPROVED',
      method: 'QR',
      message: 'Identificación exitosa',
      employee_id: 7,
      name: 'Ana Ruiz',
      avatar: ANA,
      verified_at: '2026-10-06T15:00:00Z',
    };
    const { rerender } = render(<VerificationResultCard result={verified} failureTitle="No" onRetry={vi.fn()} onBack={vi.fn()} />);
    await waitFor(() => expect(photos(document)).toEqual(['blob:ana']));
    rerender(<VerificationResultCard result={{ ...verified, name: null, avatar: null }} failureTitle="No" onRetry={vi.fn()} onBack={vi.fn()} />);
    expect(photos(document)).toEqual([]);

    const fraud = { id: 3, employee: { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7', avatar: ANA }, actor: null } as FraudCase;
    const subject = render(<FraudSubject item={fraud} />);
    await waitFor(() => expect(photos(subject.container)).toEqual(['blob:ana']));
    expect(screen.getByText('Ana Ruiz · EMP-7')).toBeInTheDocument();
    subject.rerender(<FraudSubject item={{ ...fraud, employee: null, actor: 'caseta@acme.mx' }} />);
    expect(initialsOnly(subject.container)).toEqual(['CA']);
  });
});
