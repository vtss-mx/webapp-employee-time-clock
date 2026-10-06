import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CompanyPolicyPage } from '../../pages/admin/CompanyPolicyPage';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { setLocale } from '../../i18n/core';
import { testCatalogs } from '../../test/catalogs';
import { sampleAdminPolicy } from '../../test/fixtures';
import { apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { AdminPolicyUpdate, PolicyChange } from '../../types';
import { describeFieldChange, withChanges } from './policyFields';

const company = { id: 4, name: 'Panificadora', active: true, employee_count: 3, admin_count: 1 };
const learning = { enabled: true, approved_employees: 3, employees_learning: 1, learned_samples: 2, identifications: 9, learned_identifications: 1, last_learned_at: null };
const body = (call: MockCall) => JSON.parse(call.init.body as string) as AdminPolicyUpdate;

const pendingChange: PolicyChange = {
  id: 30,
  status: 'PENDING',
  relaxes: true,
  preset: null,
  changes: [{ field: 'site_codes', before: 'OBSERVE', after: 'OFF', relaxes: true }],
  reason: null,
  simulation: null,
  requested_by: 'admin@plataforma.com',
  requested_by_me: true,
  created_at: '2026-10-05T10:00:00Z',
  expires_at: '2026-10-08T10:00:00Z',
  decided_by: null,
  decided_at: null,
  decision_note: null,
};

/** La consola del ADMIN: cada cambio responde con la política resultante o, si relaja, por aprobar. */
function serve(pendingWhen: (changes: AdminPolicyUpdate) => boolean = () => false) {
  return mockFetch((call) => {
    if (call.url.endsWith('/face-learning')) return apiOk(learning);
    if (call.init.method === 'PUT') {
      const changes = body(call);
      return pendingWhen(changes) ? apiOk({ policy: sampleAdminPolicy, change: pendingChange }) : apiOk({ policy: withChanges(sampleAdminPolicy, changes), change: null });
    }
    if (call.url.includes('/verification-policy/changes')) return apiOk({ items: [], total: 0, page: 1, size: 5 });
    if (call.url.includes('/verification-policy')) return apiOk(sampleAdminPolicy);
    return apiOk(company);
  });
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/companies/:id/policy" element={<CompanyPolicyPage />} />
    </Routes>,
    { route: '/admin/companies/4/policy' },
  );
}

async function choose(control: RegExp, option: string) {
  await userEvent.click(screen.getByRole('button', { name: control }));
  await userEvent.click(screen.getByRole('option', { name: option }));
}

afterEach(() => resetPolicyCache());

describe('Política: prueba de presencia (antifraude 2b)', () => {
  it('tres controles con los NOMBRES de los modos del catálogo y su ayuda propia (sin la descripción del catálogo)', async () => {
    serve();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Prueba de presencia' })).toBeInTheDocument();
    expect(screen.getByText('Cada identificación lleva la firma del dispositivo con que el validador inició sesión.')).toBeInTheDocument();
    expect(screen.getByText('Los validadores que requieren ubicación la envían en cada identificación.')).toBeInTheDocument();
    expect(screen.getByText('En los sitios que lo activen, la entrada y la salida llevan el código del kiosco.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Firma por petición/ }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Apagada', 'Solo medir', 'Obligatoria']);
  });

  it('exigirlo se confirma con "antes → después" y su advertencia; se guarda y lo avisa con el modo elegido', async () => {
    const { calls } = serve();
    renderPage();
    await screen.findByRole('heading', { name: 'Prueba de presencia' });
    await choose(/Código de sitio/, 'Obligatoria');
    const confirm = await screen.findByRole('alertdialog', { name: '¿Cambiar «Código de sitio» a Obligatoria?' });
    expect(confirm).toHaveTextContent('Solo medir');
    expect(confirm).toHaveTextContent('Antes, instala un kiosco en cada sitio que lo active');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Guardar ajuste' }));
    const notice = await screen.findByRole('dialog', { name: 'Código de sitio: Obligatoria' });
    expect(notice).toHaveTextContent('la entrada y la salida llevan el código del kiosco');
    expect(calls.filter((c) => c.init.method === 'PUT').map(body)).toEqual([{ site_codes: 'ENFORCE' }]);
    await userEvent.click(within(notice).getByRole('button', { name: 'Entendido' }));

    await choose(/Ubicación en cada identificación/, 'Obligatoria');
    expect(await screen.findByRole('alertdialog', { name: '¿Cambiar «Ubicación en cada identificación» a Obligatoria?' })).toHaveTextContent('Se rechaza una identificación sin ubicación');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await choose(/Firma por petición/, 'Obligatoria');
    expect(await screen.findByRole('alertdialog', { name: '¿Cambiar «Firma por petición» a Obligatoria?' })).toHaveTextContent('ventana privada');
  });

  it('bajar de modo relaja la seguridad: la confirmación lo advierte (dos personas) y el cambio queda por aprobar', async () => {
    const { calls } = serve((changes) => changes.validator_signing === 'OFF');
    renderPage();
    await screen.findByRole('heading', { name: 'Prueba de presencia' });
    await choose(/Firma por petición/, 'Apagada');
    const confirm = await screen.findByRole('alertdialog', { name: '¿Cambiar «Firma por petición» a Apagada?' });
    expect(confirm).toHaveTextContent('otro administrador debe aprobarlo antes de que aplique');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Guardar ajuste' }));
    expect(await screen.findByRole('dialog', { name: 'Cambio por aprobar' })).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'PUT').map(body)).toEqual([{ validator_signing: 'OFF' }]);
  });

  it('el historial nombra cada control y sus modos (el código desconocido, tal cual)', () => {
    const named = (field: string, before: unknown, after: unknown) => describeFieldChange({ field, before, after, relaxes: false }, sampleAdminPolicy, testCatalogs);
    expect(named('site_codes', 'OBSERVE', 'OFF')).toEqual({ label: 'Código de sitio', before: 'Solo medir', after: 'Apagada' });
    expect(named('validator_signing', 'OFF', 'ENFORCE')).toEqual({ label: 'Firma por petición', before: 'Apagada', after: 'Obligatoria' });
    expect(named('validator_location', 'OBSERVE', 'NUEVO')).toEqual({ label: 'Ubicación en cada identificación', before: 'Solo medir', after: 'NUEVO' });
  });

  it('en inglés', async () => {
    await setLocale('en-US');
    serve();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Proof of presence' })).toBeInTheDocument();
    expect(screen.getByText('At sites that turn it on, check-in and check-out include the kiosk code.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Per-request signature/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Location on each identification/ })).toBeInTheDocument();
  });
});
