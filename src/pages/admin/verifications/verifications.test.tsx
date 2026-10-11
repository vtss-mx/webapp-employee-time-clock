import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { sampleVerificationDetail, sampleVerificationSummary } from '../../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { VerificationDetail, VerificationHistoryRow } from '../../../types';
import { AdminVerificationDetailPage, CompanyVerificationDetailPage } from '../../verifications/VerificationDetailPages';
import { AdminVerificationsPage } from './VerificationsPage';

const PERIOD = { since: sampleVerificationSummary.since, until: sampleVerificationSummary.until, count_cap: 10_000 };
const row: VerificationHistoryRow = {
  id: 10,
  created_at: '2026-10-07T10:00:00Z',
  method: 'FACE',
  success: true,
  reason: null,
  confidence: 0.99,
  employee_id: 7,
  employee_number: 'EMP-7',
  employee_name: 'Ana Ruiz',
  avatar: null,
  latitude: 29.1,
  longitude: -110.9,
  location_accuracy_m: 12,
  company_id: 3,
  company_name: 'Panificadora del Norte',
};
const failed: VerificationHistoryRow = {
  ...row,
  id: 11,
  success: false,
  reason: 'NO_MATCH',
  confidence: null,
  employee_id: null,
  employee_number: null,
  employee_name: null,
  latitude: null,
  longitude: null,
  location_accuracy_m: null,
  company_id: 4,
  company_name: 'Acme',
};

/** El listado y el resumen del ADMIN; `rows` vacío deja la página sin filas. */
function serve({ rows = [row, failed], emptyWhen }: { rows?: VerificationHistoryRow[]; emptyWhen?: (url: string) => boolean } = {}) {
  return mockFetch((call: MockCall) => {
    if (call.url.includes('/admin/verifications/summary')) return apiOk(sampleVerificationSummary);
    const items = emptyWhen?.(call.url) ? [] : rows;
    return apiOk({ items, total: items.length, page: 1, size: 10, ...PERIOD });
  });
}
const lastList = (calls: MockCall[]) => calls.filter((c) => /\/api\/admin\/verifications(\?|$)/.test(c.url)).at(-1)?.url ?? '';

/** El historial con su ruta hija y la del caso de fraude: la navegación es la de verdad, sin simular el router. */
function renderPage(route = '/admin/verifications') {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/verifications" element={<AdminVerificationsPage />} />
      <Route path="/admin/verifications/:id" element={<AdminVerificationDetailPage />} />
      <Route path="/admin/fraud-cases/:id" element={<p>{CASE_SCREEN}</p>} />
      <Route path="/company/verifications/:id" element={<CompanyVerificationDetailPage />} />
    </Routes>,
    { route },
  );
}
/** Marca de la pantalla del caso de fraude (no es texto de la interfaz: solo prueba la navegación). */
const CASE_SCREEN = 'CASE_SCREEN';

afterEach(() => vi.clearAllMocks());

describe('AdminVerificationsPage (historial de todas las empresas)', () => {
  it('lista cada intento con su empresa, su persona, su resultado y su lugar, y dice el periodo y el total', async () => {
    serve();
    renderPage();
    expect(screen.getByRole('heading', { name: 'Historial de verificaciones' })).toBeInTheDocument();
    expect(await screen.findByText('Panificadora del Norte')).toBeInTheDocument();
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByText('No identificado')).toBeInTheDocument();
    expect(screen.getByText('Rostro no coincide')).toBeInTheDocument();
    expect(screen.getByText('Sin ubicación')).toBeInTheDocument();
    expect(screen.getByText(/Sin un periodo elegido se muestran los últimos 30 días/)).toBeInTheDocument();
    expect(screen.getByText('Total: 2')).toBeInTheDocument();
  });

  it('las tarjetas y el desglose del periodo salen del resumen que agrupó el servidor', async () => {
    serve();
    renderPage();
    expect(await screen.findByText('Riesgo elevado', { selector: '.kpi__label' })).toBeInTheDocument();
    expect(screen.getByText(/Rostro: 11/)).toBeInTheDocument();
    expect(screen.getByText(/Alto: 1/)).toBeInTheDocument();
  });

  it('abrir una fila lleva a su detalle', async () => {
    const { calls } = mockFetch((call: MockCall) => {
      if (call.url.includes('/summary')) return apiOk(sampleVerificationSummary);
      if (/verifications\/10/.test(call.url)) return apiOk({ ...sampleVerificationDetail, id: 10 });
      return apiOk({ items: [row], total: 1, page: 1, size: 10, ...PERIOD });
    });
    renderPage();
    await userEvent.click(await screen.findByText('Ana Ruiz'));
    expect(await screen.findByRole('heading', { name: 'Verificación 10' })).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/api/admin/verifications/10'))).toBe(true);
  });

  it('los filtros viajan al servidor (resultado, método, motivo, riesgo y ubicación)', async () => {
    const { calls } = serve();
    renderPage();
    await screen.findByText('Ana Ruiz');
    await userEvent.click(screen.getByRole('tab', { name: 'Fallidas' }));
    await waitFor(() => expect(lastList(calls)).toContain('success=false'));
    await userEvent.click(screen.getByRole('button', { name: /^Motivo/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Rostro no coincide' }));
    await waitFor(() => expect(lastList(calls)).toContain('reason=NO_MATCH'));
    await userEvent.click(screen.getByRole('button', { name: /^Lugar/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Con ubicación' }));
    await waitFor(() => expect(lastList(calls)).toContain('located=true'));
  });

  it('con `?company_id=` solo pide esa empresa y se puede quitar el filtro', async () => {
    const { calls } = serve();
    renderPage('/admin/verifications?company_id=3');
    await screen.findByText('Ana Ruiz');
    expect(lastList(calls)).toContain('company_id=3');
    expect(screen.getByText(/Solo la empresa Panificadora del Norte/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    await waitFor(() => expect(lastList(calls)).not.toContain('company_id'));
  });

  it('una empresa que no es un número en la URL se ignora (nunca rompe la pantalla)', async () => {
    const { calls } = serve();
    renderPage('/admin/verifications?company_id=abc');
    await screen.findByText('Ana Ruiz');
    expect(lastList(calls)).not.toContain('company_id');
  });

  it('sin intentos: estado vacío con su descripción; con filtro, "Sin resultados"', async () => {
    const { calls } = serve({ rows: [] });
    renderPage();
    expect(await screen.findByText('Sin verificaciones')).toBeInTheDocument();
    expect(screen.getByText('Aquí verás cada verificación de identidad.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Exitosas' }));
    await waitFor(() => expect(lastList(calls)).toContain('success=true'));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('una falla del listado se avisa en popup y una del resumen ofrece reintentar', async () => {
    const { calls } = mockFetch((call: MockCall) => (call.url.includes('/summary') ? apiFail(503, 'SERVICE_UNAVAILABLE', 'Servidor ocupado') : apiOk({ items: [row], total: 1, page: 1, size: 10, ...PERIOD })));
    renderPage();
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/summary')).length).toBeGreaterThan(1));
  });

  it('el filtro «Hasta» y una fila con ubicación pero sin precisión también viajan y se dibujan', async () => {
    const { calls } = mockFetch((call: MockCall) => {
      if (call.url.includes('/summary')) return apiOk(sampleVerificationSummary);
      return apiOk({ items: [{ ...row, location_accuracy_m: null }], total: 1, page: 1, size: 10, ...PERIOD });
    });
    renderPage();
    expect(await screen.findByText('Con ubicación')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '07/10/2026' } });
    await waitFor(() => expect(lastList(calls)).toContain('end=2026-10-07'));
  });

  it('con `?company_id=` y sin filas, el aviso nombra la empresa con su id', async () => {
    serve({ rows: [] });
    renderPage('/admin/verifications?company_id=9');
    expect(await screen.findByText(/Solo la empresa 9/)).toBeInTheDocument();
  });

  it('una falla al cargar el listado se avisa en su popup con su título', async () => {
    mockFetch((call: MockCall) => (call.url.includes('/summary') ? apiOk(sampleVerificationSummary) : apiFail(503, 'SERVICE_UNAVAILABLE', 'Servidor ocupado')));
    renderPage();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar el historial' })).toBeInTheDocument();
  });

  it('en inglés: título, columnas y vacío', async () => {
    await setLocale('en-US');
    serve();
    renderPage();
    expect(screen.getByRole('heading', { name: 'Verification history' })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Company' })).toBeInTheDocument();
    expect(screen.getByText('With no period chosen, the last 30 days are shown.')).toBeInTheDocument();
  });

  it('en inglés, sin intentos: el vacío con su descripción', async () => {
    await setLocale('en-US');
    serve({ rows: [] });
    renderPage();
    expect(await screen.findByText('No verifications')).toBeInTheDocument();
    expect(screen.getByText('Each identity verification will appear here.')).toBeInTheDocument();
  });
});

describe('AdminVerificationDetailPage (el detalle técnico de un intento)', () => {
  const serveDetail = (detail: VerificationDetail = sampleVerificationDetail) => mockFetch(() => apiOk(detail));

  it('trae quién y cuándo, dónde, lo medido y la decisión del motor, sin un solo dato biométrico', async () => {
    serveDetail();
    renderPage('/admin/verifications/1');
    expect(await screen.findByRole('heading', { name: 'Verificación 1' })).toBeInTheDocument();
    expect(screen.getByText('Quién y cuándo')).toBeInTheDocument();
    expect(screen.getByText('Ana Ruiz · EMP-7')).toBeInTheDocument();
    expect(screen.getByText(/Empleado · ana@acme.mx/)).toBeInTheDocument();
    expect(screen.getByText('Planta Hermosillo')).toBeInTheDocument();
    expect(screen.getByText('187.188.1.10')).toBeInTheDocument();
    expect(screen.getByText(/MX · AS22884 · Acme Networks/)).toBeInTheDocument();
    expect(screen.getByText('IOS_SAFARI')).toBeInTheDocument();
    expect(screen.getByText('pad.texture')).toBeInTheDocument();
    expect(screen.getByText('Moiré alto')).toBeInTheDocument();
    expect(screen.getByText('Bajo')).toBeInTheDocument();
    // Ni plantillas, ni vectores, ni imágenes: el contrato no los trae y la pantalla no los dibuja.
    expect(document.body.innerHTML).not.toContain('base64');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('un intento sin medición, sin riesgo, sin ubicación y sin persona lo dice en lugar de romperse', async () => {
    serveDetail({
      ...sampleVerificationDetail,
      method: 'QR',
      confidence: null,
      employee: null,
      actor: null,
      measurement: null,
      risk: null,
      place: { latitude: null, longitude: null, location_accuracy_m: null, site: null, presence_code_used: false, ip_address: null, network: null, user_agent: null },
    });
    renderPage('/admin/verifications/1');
    expect(await screen.findByText('Este intento no pasó por el motor facial.')).toBeInTheDocument();
    expect(screen.getByText('Este intento no pasó por el motor de riesgo.')).toBeInTheDocument();
    expect(screen.getByText('Sin ubicación')).toBeInTheDocument();
    expect(screen.getByText('No identificado')).toBeInTheDocument();
  });

  it('un intento que abrió un caso de fraude lo enlaza y aclara que la evidencia vive allá', async () => {
    serveDetail({ ...sampleVerificationDetail, case: { id: 5, status: 'OPEN', kind: 'PRESENTATION' }, risk: { ...sampleVerificationDetail.risk!, step_up: true, fallback: true, signals: [] } });
    renderPage('/admin/verifications/1');
    expect(await screen.findByText('Caso de fraude')).toBeInTheDocument();
    expect(screen.getByText('Las imágenes del intento solo se revisan en el caso de fraude.')).toBeInTheDocument();
    expect(screen.getByText('Ninguna señal sumó puntos.')).toBeInTheDocument();
    expect(screen.getByText(/Superó un paso más/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir el caso' }));
    expect(await screen.findByText(CASE_SCREEN)).toBeInTheDocument();
  });

  it('un intento de una persona eliminada y de un dispositivo de la API se nombran igual', async () => {
    serveDetail({
      ...sampleVerificationDetail,
      employee: { id: 7, full_name: 'Ana Ruiz', employee_number: null, deleted: true, avatar: null },
      actor: { role: null, email: null, name: null, device: 'abcdef123456' },
      measurement: { ...sampleVerificationDetail.measurement!, steps: null, platform: null, flash_mode: null, fraud_label: 'FRAUD', pad: null },
    });
    renderPage('/admin/verifications/1');
    expect(await screen.findByText('Dispositivo de la API')).toBeInTheDocument();
    expect(screen.getByText('abcdef123456')).toBeInTheDocument();
    expect(screen.getByText('FRAUD')).toBeInTheDocument();
    expect(screen.getByText('Eliminado')).toBeInTheDocument();
  });

  it('un 404 deja la pantalla con su aviso y sin romperse', async () => {
    mockFetch(() => apiFail(404, 'VERIFICATION_NOT_FOUND', 'La verificación no existe'));
    renderPage('/admin/verifications/1');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar la verificación' })).toBeInTheDocument();
  });

  it('en inglés: el título y las secciones', async () => {
    await setLocale('en-US');
    serveDetail();
    renderPage('/admin/verifications/1');
    expect(await screen.findByRole('heading', { name: 'Verification 1' })).toBeInTheDocument();
    expect(screen.getByText('What was measured')).toBeInTheDocument();
  });
});

describe('CompanyVerificationDetailPage (el mismo detalle, con la base de la empresa)', () => {
  it('pide el intento a la ruta de la empresa y no ofrece abrir el caso de fraude (esa pantalla es del ADMIN)', async () => {
    const { calls } = mockFetch(() => apiOk({ ...sampleVerificationDetail, company_id: null, company_name: null, case: { id: 5, status: 'OPEN', kind: 'PRESENTATION' } }));
    renderPage('/company/verifications/1');
    expect(await screen.findByRole('heading', { name: 'Verificación 1' })).toBeInTheDocument();
    expect(calls[0].url).toContain('/api/verifications/1');
    expect(screen.getByText('Caso de fraude')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir el caso' })).not.toBeInTheDocument();
  });
});
