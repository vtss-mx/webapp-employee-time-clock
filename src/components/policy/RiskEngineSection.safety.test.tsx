import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { testCatalogs } from '../../test/catalogs';
import { riskSignal, sampleAdminPolicy } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';
import { RiskEngineSection } from './RiskEngineSection';
import type { TuningSave } from '../settings/PolicyTuning';

describe('controles de riesgo seguros y compatibles con versiones anteriores', () => {
  it('un backend anterior conserva su valor histórico pero no habilita el selector nuevo', () => {
    renderWithProviders(<RiskEngineSection saving={null} policy={{ ...sampleAdminPolicy, risk_failure_policy: undefined }} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: new RegExp(t('policy.risk.fields.fallbackAction')) })).toBeDisabled();
  });

  it.each(['BLOCK', 'MANUAL_REVIEW'])('explica un control crítico %s aunque el motor y la señal estén apagados', (action) => {
    renderWithProviders(<RiskEngineSection saving={null} policy={{ ...sampleAdminPolicy, risk_engine: false, risk_signals: [riskSignal('API_SIGNATURE_INVALID', { critical_action: action, mode: 'OFF', calibration_required: true })] }} onSave={vi.fn()} />);
    const name = testCatalogs.nameOf('verification_statuses', action === 'BLOCK' ? 'BLOCKED' : action);
    expect(screen.getByText(t('policy.risk.readiness.critical', { action: name }))).toBeVisible();
    expect(screen.getByText(t('policy.risk.readiness.calibration'))).toBeVisible();
    expect(screen.getByRole('button', { name: new RegExp(t('policy.risk.signals.modeOf', { signal: riskSignal('API_SIGNATURE_INVALID').name })) })).toBeDisabled();
    expect(screen.getByRole('button', { name: new RegExp(t('policy.risk.signals.pointsOf', { signal: riskSignal('API_SIGNATURE_INVALID').name })) })).toBeDisabled();
  });

  it('los mínimos críticos quedan fijos también con el motor encendido', () => {
    const signal = riskSignal('API_SIGNATURE_INVALID', { critical_action: 'BLOCK' });
    renderWithProviders(<RiskEngineSection saving={null} policy={{ ...sampleAdminPolicy, risk_engine: true, risk_signals: [signal] }} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: new RegExp(t('policy.risk.signals.modeOf', { signal: signal.name })) })).toBeDisabled();
    expect(screen.getByRole('button', { name: new RegExp(t('policy.risk.signals.pointsOf', { signal: signal.name })) })).toBeDisabled();
  });

  it('el tope utiliza solo opciones del servidor y entrega el cambio para confirmar', async () => {
    const save = vi.fn<(change: TuningSave) => void>();
    renderWithProviders(<RiskEngineSection saving={null} policy={{ ...sampleAdminPolicy, risk_family_max_points: 60, risk_family_max_points_options: [35, 60] }} onSave={save} />);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(t('policy.risk.fields.familyCap')) }));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    await userEvent.click(screen.getByRole('option', { name: '35 pts' }));
    const change = save.mock.calls[0][0];
    expect(change.changes).toEqual({ risk_family_max_points: 35 });
    expect(change.relaxes).toBe(true);
    expect(change.title()).toBe(t('policy.risk.familyCap.saved'));
    expect(change.detail()).toBe(t('policy.risk.familyCap.savedText', { points: '35 pts' }));
  });
});
