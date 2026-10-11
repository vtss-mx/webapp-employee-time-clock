import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { policyRiskConfirm } from './policyRiskConfirm';

describe('motivo en la confirmación de riesgo', () => {
  it('respeta acciones sin confirmación y motivos vacíos', () => {
    expect(policyRiskConfirm(undefined, 'Motivo')).toBeUndefined();
    const input = { title: 'Confirmar cambio' };
    expect(policyRiskConfirm(input, ' ')).toBe(input);
  });

  it('agrega el motivo a una confirmación sin detalles previos', () => {
    const source = policyRiskConfirm({ title: 'Confirmar cambio' }, 'Revisar señales');
    expect(typeof source).toBe('function');
    if (typeof source !== 'function') throw new Error('EXPECTED_CONFIRM_SOURCE');
    expect(source().details).toEqual([{ label: t('policy.risk.changeReason.label'), value: 'Revisar señales' }]);
  });

  it('conserva los detalles y evalúa de nuevo una confirmación diferida', () => {
    let title = 'Primera versión';
    const source = policyRiskConfirm(() => ({ title, details: ['Empresa autorizada'] }), 'Revisión solicitada');
    if (typeof source !== 'function') throw new Error('EXPECTED_CONFIRM_SOURCE');
    expect(source().details).toEqual(['Empresa autorizada', { label: t('policy.risk.changeReason.label'), value: 'Revisión solicitada' }]);
    title = 'Segunda versión';
    expect(source().title).toBe('Segunda versión');
  });
});
