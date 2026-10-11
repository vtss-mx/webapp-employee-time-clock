import { describe, expect, it } from 'vitest';
import { isRiskPolicyMetadata } from './riskReadiness';

const ready = { maximum_score: 45, observed_signals: 3, enforced_signals: 0, score_can_reject: false, calibration_required: true, critical_controls: { KNOWN_ATTACK: 'MANUAL_REVIEW' } };
const old = { risk_signals: [{}] };
describe('guard de preparación y política segura', () => {
  it('no acepta cuerpos ausentes', () => expect(isRiskPolicyMetadata(null)).toBe(false));
  it.each([old, { ...old, risk_family_max_points: 1, risk_family_max_points_options: [1, 100] }, { ...old, risk_family_max_points: 100, risk_family_max_points_options: [] }, { ...old, risk_failure_policy: 'FUTURE', risk_readiness: ready }, { risk_signals: [{ critical_action: null, calibration_required: false }] }, { risk_signals: [{ critical_action: 'BLOCK', calibration_required: true }], risk_readiness: { ...ready, critical_controls: {} } }])('conserva las formas válidas %j', (value) => {
    expect(isRiskPolicyMetadata(value)).toBe(true);
  });
  it.each([
    { risk_failure_policy: null }, { risk_failure_policy: '' }, { risk_failure_policy: 42 },
    ...[null, 0, -1, 101, 1.5, Infinity, '60'].map((risk_family_max_points) => ({ risk_family_max_points })),
    ...[null, {}, [0], [101], [null], [1.5]].map((risk_family_max_points_options) => ({ risk_family_max_points_options })),
    { risk_signals: null }, { risk_signals: [null] }, { risk_signals: [{ critical_action: 42 }] }, { risk_signals: [{ calibration_required: null }] },
    { risk_readiness: null }, { risk_readiness: [] },
    ...['maximum_score', 'observed_signals', 'enforced_signals'].flatMap((field) => [null, -1, 1.5, Infinity, '45'].map((invalid) => ({ risk_readiness: { ...ready, [field]: invalid } }))),
    { risk_readiness: { ...ready, score_can_reject: null } }, { risk_readiness: { ...ready, calibration_required: 'true' } },
    { risk_readiness: { ...ready, critical_controls: [] } }, { risk_readiness: { ...ready, critical_controls: { code: null } } },
  ])('rechaza metadata inválida %j', (invalid) => {
    expect(isRiskPolicyMetadata({ ...old, ...invalid })).toBe(false);
  });
});
