import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LOCALES, setLocale, t } from '../../i18n';
import { sampleAdminPolicy } from '../../test/fixtures';
import { RiskReadinessNotice } from './RiskReadinessNotice';

const readiness = { maximum_score: 45, observed_signals: 12, enforced_signals: 0, score_can_reject: false, calibration_required: true, critical_controls: { API_SIGNATURE_INVALID: 'BLOCK' } };

describe('diagnóstico de preparación calculado por el servidor', () => {
  it('un backend anterior no recibe un diagnóstico inventado', () => {
    const { container } = render(<RiskReadinessNotice policy={sampleAdminPolicy} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(LOCALES)('en %s muestra límites reales y pendientes de calibración', async (locale) => {
    await setLocale(locale);
    render(<RiskReadinessNotice policy={{ ...sampleAdminPolicy, risk_readiness: readiness }} />);
    expect(screen.getByRole('note')).toHaveTextContent('45');
    expect(screen.getByText(t('policy.risk.readiness.cannotReject'))).toBeVisible();
    expect(screen.getByText(t('policy.risk.readiness.calibration'))).toBeVisible();
    expect(screen.getByText(t('policy.risk.readiness.independent'))).toBeVisible();
  });

  it('respeta diagnósticos diferentes sin deducir controles ni certificar precisión', () => {
    render(<RiskReadinessNotice policy={{ ...sampleAdminPolicy, risk_readiness: { ...readiness, score_can_reject: true, calibration_required: false, critical_controls: {} } }} />);
    expect(screen.queryByText(t('policy.risk.readiness.cannotReject'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('policy.risk.readiness.calibration'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('policy.risk.readiness.independent'))).not.toBeInTheDocument();
  });
});
