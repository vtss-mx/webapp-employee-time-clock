import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { DataExport } from '../../types/dataExport';
import { DataExportSection } from './DataExportSection';
import type { ExportSubject } from './useDataExport';

const data = (over: Partial<DataExport> = {}): DataExport => ({
  generated_at: '2026-10-06T15:00:00Z',
  scope: 'SELF',
  subject_email: 'ana@acme.mx',
  subject_employee_id: 7,
  company_id: 1,
  company_name: 'Acme',
  previous_export_at: null,
  next_export_at: '2026-10-07T15:00:00Z',
  sections: [
    { name: 'account', source: 'auth.users', rows: [{ id: 107 }], truncated: false },
    { name: 'verification_log', source: 'biometrics.verification_logs', rows: [{ id: 1 }, { id: 2 }], truncated: true },
    { name: 'seccion_del_futuro', source: 'ops.futuro', rows: [], truncated: false },
  ],
  withheld: [
    { source: 'biometrics.capture_traces', reason: 'BIOMETRIC' },
    { source: 'ops.fraud_cases', reason: 'SECURITY' },
  ],
  retention: { biometrics_days: 1095, attendance_metadata_days: 180, verification_log_days: 365, deleted_records_days: 365 },
  row_count: 3,
  truncated: true,
  ...over,
});

const mine: ExportSubject = { kind: 'mine' };
const employee: ExportSubject = { kind: 'employee', employeeId: 7, name: 'Ana Ruiz' };

function stubDownload() {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  return click;
}

const renderSection = (subject: ExportSubject = mine) => renderWithProviders(<DataExportSection subject={subject} />);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DataExportSection («Mis datos» y «Datos del empleado»)', () => {
  it('el titular confirma qué se entrega antes de pedirlo, y cancelar no pide nada', async () => {
    const { calls } = mockFetch(apiOk(data(), { message: 'Tus datos personales' }));
    renderSection();
    expect(screen.getByText('Mis datos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar mis datos' }));
    expect(await screen.findByText('¿Exportar tus datos?')).toBeInTheDocument();
    expect(screen.getByText('Qué lleva')).toBeInTheDocument();
    expect(screen.getByText('Del rostro y la voz, solo que existen y cuándo se destruyen')).toBeInTheDocument();
    expect(screen.getByText('La entrega queda registrada y se puede pedir una cada cierto tiempo.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(calls).toHaveLength(0);
  });

  it('descarga el JSON y deja el acuse: lo entregado, lo RETENIDO con su motivo, los plazos y cuándo de nuevo', async () => {
    const click = stubDownload();
    const { calls } = mockFetch(apiOk(data(), { message: 'Tus datos personales' }));
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar mis datos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('Datos entregados')).toBeInTheDocument();
    expect(screen.getByText(/Se entregaron 3 registros\./)).toHaveTextContent('Hay más historia de la que cabe en una entrega.');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(click).toHaveBeenCalled();
    expect(calls[0].url).toBe('/api/me/export');
    // El acuse en la pantalla: secciones (una desconocida con su llave), lo retenido y los plazos.
    expect(screen.getByText('Cuenta').nextElementSibling).toHaveTextContent('1 registro');
    expect(screen.getByText('Identificaciones').nextElementSibling).toHaveTextContent('2 registros · cortada por el tope');
    expect(screen.getByText('seccion_del_futuro')).toBeInTheDocument();
    expect(screen.getByText('Quedaron cortadas: Identificaciones.')).toBeInTheDocument();
    expect(screen.getByText('Lo que no se entrega')).toBeInTheDocument();
    expect(screen.getByText('biometrics.capture_traces').closest('div')).toHaveTextContent('Dato biométrico en bruto');
    expect(screen.getByText('ops.fraud_cases').closest('div')).toHaveTextContent('evadir la detección de suplantación');
    expect(screen.getByText('Cuánto se conserva')).toBeInTheDocument();
    expect(screen.getByText('Rostro y voz sin actividad').nextElementSibling).toHaveTextContent('1,095 días');
    expect(screen.getByText(/Podrás pedirla de nuevo a partir del/)).toBeInTheDocument();
  });

  it('la empresa exporta el expediente de SU empleado, con su nombre en la confirmación', async () => {
    stubDownload();
    const { calls } = mockFetch(apiOk(data({ scope: 'COMPANY' }), { message: 'Datos del empleado' }));
    renderSection(employee);
    expect(screen.getByText('Datos del empleado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar sus datos' }));
    expect(await screen.findByText('¿Exportar los datos de Ana Ruiz?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await waitFor(() => expect(calls[0].url).toBe('/api/employees/7/export'));
  });

  it('sin secciones cortadas el aviso no aparece y el acuse lo dice en singular', async () => {
    stubDownload();
    mockFetch(apiOk(data({ row_count: 1, truncated: false, sections: [{ name: 'account', source: 'auth.users', rows: [{ id: 1 }], truncated: false }], withheld: [] })));
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar mis datos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('Se entregó 1 registro.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText('Lo que no se entrega')).not.toBeInTheDocument();
    expect(screen.queryByText(/Quedaron cortadas/)).not.toBeInTheDocument();
  });
});

describe('DataExportSection: los rechazos que no se pueden reintentar', () => {
  it('429 EXPORT_TOO_SOON dice CUÁNDO podrá de nuevo y no ofrece «Reintentar»', async () => {
    mockFetch(apiFail(429, 'EXPORT_TOO_SOON', 'Estos datos se exportaron hace poco.', { 'Retry-After': '3600' }));
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar mis datos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('Aún no se puede pedir de nuevo')).toBeInTheDocument();
    expect(screen.getByText('Estos datos se exportaron hace poco.')).toBeInTheDocument();
    expect(screen.getByText(/Podrás pedirla el .* \(en 1 h\)\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    // Un solo aviso: el popup genérico del error no se abre encima.
    expect(screen.queryByText('No se pudieron exportar los datos')).not.toBeInTheDocument();
  });

  it('sin Retry-After no se inventa un plazo', async () => {
    mockFetch(apiFail(429, 'EXPORT_TOO_SOON', 'Estos datos se exportaron hace poco.'));
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar mis datos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('Aún no se puede pedir de nuevo')).toBeInTheDocument();
    expect(screen.queryByText(/Podrás pedirla el/)).not.toBeInTheDocument();
  });

  it('403 COMPANY_REQUIRED explica que su expediente es su cuenta, sin reintentar', async () => {
    mockFetch(apiFail(403, 'COMPANY_REQUIRED', 'Esta acción es solo para cuentas de una empresa'));
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar mis datos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('Esta cuenta no tiene expediente en una empresa')).toBeInTheDocument();
    expect(screen.getByText('Lo tuyo como cuenta ya está en Mi perfil.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('cualquier otra falla sigue el camino de siempre (popup con el mensaje del servidor)', async () => {
    mockFetch(apiFail(503, 'SERVICE_UNAVAILABLE', 'El servidor no está disponible.'));
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar mis datos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('No se pudieron exportar los datos')).toBeInTheDocument();
    expect(screen.getByText('El servidor no está disponible.')).toBeInTheDocument();
  });

  it('en inglés, la sección y los rechazos salen en el idioma activo', async () => {
    await setLocale('en-US');
    mockFetch(apiFail(429, 'EXPORT_TOO_SOON', 'texto del servidor', { 'Retry-After': '60' }));
    renderSection();
    expect(screen.getByText('My data')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Export my data' }));
    expect(await screen.findByText('Export your data?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByText("You can't ask for it again yet")).toBeInTheDocument();
  });
});
