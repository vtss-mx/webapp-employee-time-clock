import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '../types/audit';
import { actorText, auditDetails, auditFileName, detailText, isFiltered, totalText } from './audit';

const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 1,
  occurred_at: '2026-10-05T10:00:00Z',
  action: 'LOGIN_SUCCEEDED',
  outcome: 'OK',
  actor_email: 'ana@acme.mx',
  actor_role: 'COMPANY',
  actor_id: 2,
  company_id: 1,
  company_name: 'Acme',
  entity_type: 'user',
  entity_id: '2',
  ip: '187.188.1.10',
  user_agent: 'Safari',
  trace_id: 'abc123',
  details: null,
  ...over,
});

describe('reglas puras de la bitácora de auditoría', () => {
  it('el total lleva el tope del servidor: debajo, la cifra; al llegar, «10,000+»', () => {
    expect(totalText(1204)).toBe('1,204');
    expect(totalText(10_000, 10_000)).toBe('10,000+');
    expect(totalText(10_500, 10_000)).toBe('10,000+');
    expect(totalText(10_500)).toBe('10,500'); // sin tope del servidor se muestra tal cual
    expect(totalText(0)).toBe('0');
  });

  it('`details` se lee como cambio («antes → después») o como dato suelto, en el orden del servidor', () => {
    const lines = auditDetails({ site_codes: { before: 'OBSERVE', after: 'ENFORCE' }, liveness_steps: 2 });
    expect(lines).toEqual([
      { key: 'site_codes', kind: 'change', before: 'OBSERVE', after: 'ENFORCE' },
      { key: 'liveness_steps', kind: 'value', value: 2 },
    ]);
    expect(auditDetails(null)).toEqual([]);
    expect(auditDetails(undefined)).toEqual([]);
    // Un objeto que no es un cambio (sin `before`/`after`) es un dato, no se interpreta.
    expect(auditDetails({ filter: { action: 'LOGIN_FAILED' } })).toEqual([{ key: 'filter', kind: 'value', value: { action: 'LOGIN_FAILED' } }]);
  });

  it('cada valor de `details` se escribe legible: vacíos, interruptores, números, texto y lo demás', () => {
    expect(detailText(null)).toBe('Sin valor');
    expect(detailText(undefined)).toBe('Sin valor');
    expect(detailText('')).toBe('Sin valor');
    expect(detailText(true)).toBe('Sí');
    expect(detailText(false)).toBe('No');
    expect(detailText(1500)).toBe('1,500');
    expect(detailText('ENFORCE')).toBe('ENFORCE');
    expect(detailText(['a', 'b'])).toBe('["a","b"]');
  });

  it('el listado está filtrado solo con algún filtro con valor', () => {
    expect(isFiltered({})).toBe(false);
    expect(isFiltered({ search: '' })).toBe(false);
    expect(isFiltered({ action: undefined })).toBe(false);
    expect(isFiltered({ search: 'ana' })).toBe(true);
    expect(isFiltered({ company_id: 1 })).toBe(true);
  });

  it('el archivo de la exportación lleva el periodo exportado, solo con la fecha', () => {
    expect(auditFileName('2026-09-28T00:00:00Z', '2026-10-05T23:59:59Z')).toBe('audit-2026-09-28-2026-10-05.json');
  });

  it('quién hizo la acción: su correo literal o, sin él, el sistema', () => {
    expect(actorText(event())).toBe('ana@acme.mx');
    expect(actorText(event({ actor_email: null }))).toBe('Sistema');
  });
});
