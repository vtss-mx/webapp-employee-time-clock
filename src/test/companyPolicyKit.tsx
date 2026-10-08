/**
 * Utilidades compartidas de las pruebas de la política de verificación del ADMIN (`CompanyPolicyPage`): el backend
 * falso de la consola, la pantalla montada en su ruta y los ayudantes para elegir y confirmar. Viven aquí (una sola
 * copia) para que cada archivo de prueba de la política las reutilice sin duplicarlas.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { sampleAdminPolicy, samplePolicy } from './fixtures';
import { apiOk, mockFetch, type MockCall } from './http';
import { renderWithProviders } from './render';
import { CompanyPolicyPage } from '../pages/admin/CompanyPolicyPage';

/** La política de la empresa 4 tal como la devuelve el backend, con su última modificación. */
export const policy = { ...samplePolicy, updated_at: '2026-10-01T10:00:00Z', updated_by: 'superadmin@plataforma.com' };

const company = {
  id: 4,
  name: 'Panificadora',
  legal_name: null,
  rfc: null,
  phone: null,
  active: true,
  max_employees: null,
  api_enabled: false,
  employee_count: 3,
  admin_count: 1,
  billing_status: 'ACTIVE',
  suspension_reason: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const learning = { enabled: true, approved_employees: 3, employees_learning: 1, learned_samples: 2, identifications: 9, learned_identifications: 1, last_learned_at: null };

/**
 * Lo que el ADMIN recibe además de lo que lee la empresa (motor de riesgo y antifraude). La regla de dos personas
 * apagada (sus avisos se prueban en `policyGovernance.test.tsx`).
 */
const { block_glasses: _g, ...adminExtras } = { ...sampleAdminPolicy, two_person_rule: false };

/**
 * Responde como el ADMIN: la política con sus campos del antifraude y cada PUT como `{ policy, change }` (aplicado).
 * Un error del servidor pasa tal cual.
 */
async function asAdmin(response: Response, call: MockCall): Promise<Response> {
  if (!response.ok) return response;
  const { data } = (await response.clone().json()) as { data: Record<string, unknown> };
  const policy = { ...adminExtras, ...data };
  if (call.init.method !== 'PUT') return apiOk(policy);
  const change = { id: 1, status: 'APPLIED', relaxes: false, preset: null, changes: [], reason: null, simulation: null, requested_by: 'superadmin@plataforma.com', requested_by_me: true, created_at: '2026-10-01T10:00:00Z', expires_at: null, decided_by: null, decided_at: null, decision_note: null };
  return apiOk({ policy, change });
}

/** El servidor de la consola: la empresa, su aprendizaje y su política (`policyResponse` responde GET y PUT de la política). */
export function serve(policyResponse: Response | ((call: MockCall) => Response)) {
  return mockFetch((call) => {
    if (call.url.endsWith('/face-learning')) return apiOk(learning);
    if (call.url.includes('/verification-policy/changes')) return apiOk({ items: [], total: 0, page: 1, size: 5 });
    if (!call.url.includes('/verification-policy')) return apiOk(company);
    return asAdmin(typeof policyResponse === 'function' ? policyResponse(call) : policyResponse.clone(), call);
  });
}

/** La pantalla del ADMIN para la empresa 4 (/admin/companies/:id/policy). */
export function renderPolicy(page: ReactElement = <CompanyPolicyPage />) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/companies/:id/policy" element={page} />
    </Routes>,
    { route: '/admin/companies/4/policy' },
  );
}

/** Elige una opción de un ajuste de los candados (todavía no guarda: primero se confirma). */
export async function choose(control: RegExp, option: string | RegExp) {
  await userEvent.click(screen.getByRole('button', { name: control }));
  await userEvent.click(screen.getByRole('option', { name: option }));
}

/** Responde la confirmación con ese título: `dialog` (azul o verde) o `alertdialog` (protege menos, en rojo). */
export async function answer(role: 'dialog' | 'alertdialog', title: string, button: string) {
  const dialog = await screen.findByRole(role, { name: title });
  await userEvent.click(within(dialog).getByRole('button', { name: button }));
  return dialog;
}

/** Política con el servidor que acepta cada cambio (responde la política ya actualizada). */
export function accepting(base = samplePolicy) {
  return serve((call) => apiOk(call.init.method === 'PUT' ? { ...base, ...(JSON.parse(call.init.body as string) as object) } : base));
}

/** Los cuerpos de cada PUT, en orden (lo que se guardó). */
export const puts = (calls: Array<{ init: RequestInit }>) => calls.filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(c.init.body as string) as unknown);
