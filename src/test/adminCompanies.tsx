import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FeedbackProvider } from '../context/FeedbackContext';
import { apiOk, type MockCall } from './http';
import { WithCatalogs } from './render';
import type { CompanyAdmin, CompanyDetail } from '../types';

/*
 * Datos y ayudantes compartidos de las pruebas de la consola de empresas del ADMIN (alta, edición, detalle y
 * administradores). Viven aquí, en `src/test/` (fuera de la cobertura y del lint de textos), para que
 * `companies.test.tsx` no pase del tope de líneas y no se dupliquen entre archivos de prueba.
 */

export const company: CompanyDetail = {
  id: 4,
  name: 'Panificadora',
  legal_name: 'Panificadora del Norte SA de CV',
  tax_country: 'MX',
  tax_id_type: 'MX_RFC',
  tax_id: 'PNO120315AB1',
  phone: '+526621234567',
  active: true,
  max_employees: 50,
  api_enabled: false,
  require_employee_documents: false,
  max_validators: 0,
  active_validators: 0,
  employee_count: 3,
  admin_count: 1,
  billing_status: 'ACTIVE',
  suspension_reason: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
/** Empresa capturada solo con lo mínimo (sin razón social, identificador fiscal, teléfono ni límite). */
export const bare: CompanyDetail = { ...company, legal_name: null, tax_country: null, tax_id_type: null, tax_id: null, phone: null, max_employees: null };
export const admin: CompanyAdmin = { id: 9, email: 'admin@pan.com', active: false, last_login_at: null, created_at: '2026-01-01T00:00:00Z' };
export const adminsPage = (items: CompanyAdmin[]) => apiOk({ items, total: items.length, page: 1, size: 10 });

/**
 * La pantalla con historial (de dónde se llegó, para "Cancelar") y las pantallas a las que lleva.
 * El listado de empresas es la pantalla anterior.
 */
export function renderFrom(path: string, route: string, page: ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/admin/companies', route]} initialIndex={1}>
      <FeedbackProvider>
        <WithCatalogs>
          <Routes>
            <Route path={path} element={page} />
            <Route path="/admin/companies" element={<p>Listado de empresas</p>} />
            {path !== '/admin/companies/:id' && <Route path="/admin/companies/:id" element={<p>Detalle de empresa</p>} />}
          </Routes>
        </WithCatalogs>
      </FeedbackProvider>
    </MemoryRouter>,
  );
}

/** Lo que se envió a la empresa (sin las vistas previas del cobro, que se piden solas mientras se escribe). */
export const sent = (calls: MockCall[], method: string) => calls.filter((c) => c.init.method === method && !c.url.endsWith('/billing/preview'));
