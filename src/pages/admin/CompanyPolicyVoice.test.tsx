import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { samplePolicy, sampleAdminPolicy } from '../../test/fixtures';
import { apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import { spokenTexts } from '../../test/speechSynthesis';
import { CompanyPolicyPage } from './CompanyPolicyPage';

/*
 * Guía por voz del registro facial (decisión del dueño, 2026-10-08) en la política del ADMIN: encenderla es un
 * interruptor NEUTRAL (no un candado de seguridad), elegir la voz nunca relaja la seguridad y «Probar voz» la lee en el
 * dispositivo con la síntesis local (privacidad por diseño).
 */
const policy = { ...samplePolicy, updated_at: null, updated_by: null };
const company = { id: 4, name: 'Panificadora', legal_name: null, rfc: null, phone: null, active: true, max_employees: null, api_enabled: false, employee_count: 3, admin_count: 1, billing_status: 'ACTIVE', suspension_reason: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const { block_glasses: _g, ...adminExtras } = { ...sampleAdminPolicy, two_person_rule: false };

/** El servidor del ADMIN: la empresa, su aprendizaje, el historial vacío y la política (cada PUT devuelve `{policy, change}`). */
function serve() {
  return mockFetch((call) => {
    if (call.url.endsWith('/face-learning')) return apiOk({ enabled: true, approved_employees: 0, employees_learning: 0, learned_samples: 0, identifications: 0, learned_identifications: 0, last_learned_at: null });
    if (call.url.includes('/verification-policy/changes')) return apiOk({ items: [], total: 0, page: 1, size: 5 });
    if (!call.url.includes('/verification-policy')) return apiOk(company);
    const body = call.init.method === 'PUT' ? (JSON.parse(call.init.body as string) as object) : {};
    const next = { ...adminExtras, ...policy, ...body };
    return apiOk(call.init.method === 'PUT' ? { policy: next, change: { id: 1, status: 'APPLIED', relaxes: false, preset: null, changes: [], reason: null, simulation: null, requested_by: 'root@x', requested_by_me: true, created_at: '2026-10-01T10:00:00Z', expires_at: null, decided_by: null, decided_at: null, decision_note: null } } : next);
  });
}

const choose = async (control: RegExp, option: RegExp) => {
  await userEvent.click(screen.getByRole('button', { name: control }));
  await userEvent.click(screen.getByRole('option', { name: option }));
};
const answer = async (role: 'dialog' | 'alertdialog', title: string, button: string) => {
  const dialog = await screen.findByRole(role, { name: title });
  await userEvent.click(within(dialog).getByRole('button', { name: button }));
  return dialog;
};

afterEach(() => resetPolicyCache());

describe('CompanyPolicyPage: guía por voz', () => {
  it('enciende la guía (neutral), cambia la voz y la prueba en el dispositivo', async () => {
    const { calls } = serve();
    renderWithProviders(
      <Routes>
        <Route path="/admin/companies/:id/policy" element={<CompanyPolicyPage />} />
      </Routes>,
      { route: '/admin/companies/4/policy' },
    );
    const toggle = await screen.findByRole('switch', { name: 'Guía por voz' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(toggle);
    const on = await answer('dialog', '¿Activar «Guía por voz»?', 'Activar'); // verde, no un candado
    expect(on).not.toHaveTextContent('suplantación');
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));

    await choose(/Voz de la guía/, /Masculina serena/);
    const voice = await answer('dialog', '¿Usar la voz «Masculina serena»?', 'Guardar voz'); // azul, nunca rojo
    expect(within(voice).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Voz de la guíaAntes: Femenina cálidaDespués: Masculina serena');
    expect(await screen.findByText('Voz de la guía actualizada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByRole('button', { name: 'Probar voz' }));
    expect(spokenTexts()).toContain('Así se oye la guía por voz.');

    expect(calls.filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(c.init.body as string) as object)).toEqual([{ voice_guidance_enabled: true }, { voice_profile: 'MALE_CALM' }]);
  });
});
