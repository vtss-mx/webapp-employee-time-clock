/**
 * Cada persona en una tabla, lista o tarjeta muestra su foto de perfil si tiene (la ruta versionada `avatar` que
 * manda el backend) y, si no, sus iniciales (decisión del dueño, 2026-10-06). La foto se pide por la API con la
 * sesión (`Avatar` → `avatarService.image` → URL `blob:` local); si no llega se quedan las iniciales, sin popup.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FraudSubject } from '../pages/admin/fraud/FraudCasesPage';
import { apiFail, apiOk, mockFetch } from '../test/http';
import type { BulkResult, FraudCase, VerificationResult } from '../types';
import { clearAvatarCache } from '../utils/avatarCache';
import { BulkResultSummary } from './BulkResultSummary';
import { EmployeeCard } from './calendar/EmployeeCard';
import { PersonItem } from './departments/PersonItem';
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
        <PersonItem name="Ana Ruiz" avatar={ANA} />
        <PersonItem name="Luis Paz" />
        <PersonItem name="Ana Ruiz" avatar={ANA} deleted />
        <PersonItem name="Eva Sol" avatar="/users/9/avatar?v=e1" />
      </ul>,
    );
    await waitFor(() => expect(photos(container)).toEqual(['blob:ana', 'blob:ana']));
    // Eva no se pudo leer (404): se quedan sus iniciales, sin popup; Luis no tiene foto.
    expect(initialsOnly(container)).toEqual(['LP', 'ES']);
    expect(calls.map((call) => call.url)).toEqual(['/api/users/7/avatar?v=a1&size=96', '/api/users/9/avatar?v=e1&size=96']);
  });

  it('las tarjetas del calendario y el resultado de una operación masiva', async () => {
    mockFetch(photo);
    const ana = { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7', avatar: ANA };
    const result: BulkResult = {
      done: 1,
      unchanged: 0,
      skipped: 1,
      results: [
        { employee: ana, result: 'DONE', code: null, message: null },
        { employee: { id: 8, full_name: 'Luis Paz', employee_number: null, avatar: null }, result: 'SKIPPED', code: 'EMPLOYEE_INACTIVE', message: 'Inactivo' },
      ],
    };
    const { container } = render(
      <>
        <ul>
          <EmployeeCard employee={ana} badges={null}>
            <span>Vacaciones</span>
          </EmployeeCard>
        </ul>
        <BulkResultSummary result={result} copy={{ title: 'Listo', done: 'Hechos', unchanged: 'Igual', skipped: 'Omitidos' }} />
      </>,
    );
    await waitFor(() => expect(photos(container)).toEqual(['blob:ana', 'blob:ana']));
    expect(initialsOnly(container)).toEqual(['LP']);
  });

  it('la persona identificada en un validador (con o sin nombre) y el sujeto de un caso de fraude', async () => {
    mockFetch(photo);
    const verified: VerificationResult = {
      verified: true,
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
