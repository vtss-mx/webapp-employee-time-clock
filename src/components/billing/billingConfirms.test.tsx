import { describe, expect, it } from 'vitest';
import { noPlanAccount } from '../../test/billing';
import { testCatalogs } from '../../test/catalogs';
import { reactivateConfirm } from './billingConfirms';

describe('confirmaciones de la cobranza', () => {
  it('reactivar sin plan ni suspensión registrada: no promete días de gracia ni nombra un motivo', () => {
    const confirm = reactivateConfirm(noPlanAccount, testCatalogs.nameOf);
    expect(confirm.message).toBe('Su personal podrá iniciar sesión de inmediato. El periodo de gracia empieza de nuevo.');
    expect(confirm.details).toEqual([{ label: 'Vencido', value: '—' }]); // sin plan ni movimientos: sin moneda
  });
});
