import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { accepting, choose, puts, renderPolicy } from '../../test/companyPolicyKit';
import { sampleAdminPolicy } from '../../test/fixtures';

const riskPolicy = { ...sampleAdminPolicy, risk_family_max_points: 60, risk_family_max_points_options: [35, 60] };

describe('política de riesgo por empresa y motivo auditable', () => {
  it('envía el motivo junto con el tope elegido únicamente después de confirmar', async () => {
    const { calls } = accepting(riskPolicy);
    renderPolicy();
    const reason = await screen.findByRole('textbox', { name: new RegExp(t('policy.risk.changeReason.label')) });
    await userEvent.type(reason, 'Revisión de señales de la empresa');
    await choose(new RegExp(t('policy.risk.fields.familyCap')), '35 pts');
    expect(puts(calls)).toEqual([]);
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText('Revisión de señales de la empresa')).toBeVisible();
    await userEvent.click(within(confirm).getByRole('button', { name: t('policy.tuning.confirmLabel') }));
    expect(puts(calls)).toEqual([{ risk_family_max_points: 35, reason: 'Revisión de señales de la empresa' }]);
  });

  it('cancelar conserva el motivo y no escribe la política', async () => {
    const { calls } = accepting(riskPolicy);
    renderPolicy();
    const reason = await screen.findByRole('textbox', { name: new RegExp(t('policy.risk.changeReason.label')) });
    await userEvent.type(reason, 'Cambio aún no autorizado');
    await choose(new RegExp(t('policy.risk.fields.familyCap')), '35 pts');
    const confirm = await screen.findByRole('alertdialog');
    await userEvent.click(within(confirm).getByRole('button', { name: t('common.actions.cancel') }));
    expect(puts(calls)).toEqual([]);
    expect(reason).toHaveValue('Cambio aún no autorizado');
  });
});
