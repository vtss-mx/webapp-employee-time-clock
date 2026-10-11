import { describe, expect, it } from 'vitest';
import type { AccessControls, AccessReviewAccount } from '../types/accessReview';
import { FLAG_TONE, accountFlags, controlRows, isFiltered, lastAccessText, mfaText, reachedLimit } from './accessReview';

const account = (over: Partial<AccessReviewAccount> = {}): AccessReviewAccount => ({
  id: 2,
  email: 'admin@acme.mx',
  role: 'COMPANY',
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  company: { id: 1, name: 'Acme', active: true },
  last_login_at: '2026-10-05T15:00:00Z',
  days_since_login: 0,
  stale: false,
  locked: false,
  locked_until: null,
  mfa_required: true,
  mfa_satisfied: true,
  passkeys: 1,
  mfa_grace_until: null,
  open_sessions: 1,
  employments: 0,
  ...over,
});

const controls: AccessControls = {
  mfa_required_for: ['ADMIN', 'COMPANY'],
  mfa_grace_days: 14,
  password_min_length: 12,
  password_history_size: 5,
  breached_password_check: true,
  argon2: { time_cost: 3, memory_mb: 64 },
  lockout_max_failures: 5,
  lockout_minutes: 15,
  session_absolute_minutes: 720,
  session_idle_minutes: 60,
  privileged_session_idle_minutes: 15,
  stale_days: 90,
};

const roleName = (role: string) => (role === 'ADMIN' ? 'Administrador de la plataforma' : 'Empresa');

describe('reglas puras de la revisión de accesos', () => {
  it('las marcas de una cuenta van de la más grave a la menos', () => {
    expect(accountFlags(account())).toEqual([]);
    expect(accountFlags(account({ locked: true, mfa_satisfied: false, stale: true, active: false }))).toEqual(['locked', 'withoutMfa', 'stale', 'inactive']);
    // Nunca ha entrado pesa más que «inactiva» y reemplaza a `stale`.
    expect(accountFlags(account({ last_login_at: null, stale: true }))).toEqual(['neverSignedIn']);
    // Sin segundo factor solo marca a quien lo DEBE tener: lo decide el servidor, no el rol.
    expect(accountFlags(account({ mfa_required: false, mfa_satisfied: false }))).toEqual([]);
    expect(FLAG_TONE.withoutMfa).toBe('danger');
    expect(FLAG_TONE.inactive).toBe('muted');
  });

  it('el último acceso lleva los días que pasaron; sin acceso, lo dice', () => {
    expect(lastAccessText(account({ last_login_at: null }))).toBe('Nunca ha entrado');
    expect(lastAccessText(account({ days_since_login: 3 }))).toContain('hace 3 días');
    expect(lastAccessText(account({ days_since_login: 1 }))).toContain('hace 1 día');
    expect(lastAccessText(account({ days_since_login: null }))).not.toContain('hace');
  });

  it('su segundo factor: no se exige, ya cumple, su plazo o el plazo vencido', () => {
    expect(mfaText(account({ mfa_required: false }))).toBe('No se le exige');
    expect(mfaText(account())).toBe('Cumple con 1 llave');
    expect(mfaText(account({ passkeys: 2 }))).toBe('Cumple con 2 llaves');
    expect(mfaText(account({ mfa_satisfied: false, mfa_grace_until: '2026-10-20T00:00:00Z' }))).toContain('Plazo hasta el');
    expect(mfaText(account({ mfa_satisfied: false }))).toBe('Plazo vencido');
  });

  it('los controles declarados se dibujan como datos del servidor, con los nombres del catálogo de roles', () => {
    const rows = controlRows(controls, roleName);
    expect(rows.map((row) => row.key)).toEqual([
      'mfaRequiredFor',
      'mfaGrace',
      'passwordMinLength',
      'passwordHistory',
      'breachedCheck',
      'argon2',
      'lockout',
      'sessionAbsolute',
      'sessionIdle',
      'privilegedIdle',
      'staleDays',
    ]);
    expect(rows[0].value).toBe('Administrador de la plataforma y Empresa');
    expect(rows[1].value).toBe('14 días');
    expect(rows[2].value).toBe('12 caracteres');
    expect(rows[3].value).toBe('Las últimas 5');
    expect(rows[4].value).toBe('Encendida');
    expect(rows[5].value).toBe('3 pasadas · 64 MB de memoria');
    expect(rows[6].value).toBe('5 intentos · 15 min');
    expect(rows[7].value).toBe('12 h');
  });

  it('los controles en sus casos límite: ningún rol, sin historial, sin Argon2id, un intento y un carácter', () => {
    const rows = controlRows(
      { ...controls, mfa_required_for: [], password_history_size: 0, argon2: {}, lockout_max_failures: 1, password_min_length: 1, mfa_grace_days: 1, stale_days: 1, breached_password_check: false },
      roleName,
    );
    expect(rows[0].value).toBe('Ningún rol');
    expect(rows[1].value).toBe('1 día');
    expect(rows[2].value).toBe('1 carácter');
    expect(rows[3].value).toBe('Ninguna');
    expect(rows[4].value).toBe('Apagada');
    expect(rows[5].value).toBe('Sin valor');
    // Un parámetro de Argon2id que esta versión no nombra se dibuja con su código (es un dato del servidor).
    expect(controlRows({ ...controls, argon2: { time_cost: 1, lanes_future: 2 } }, roleName)[5].value).toBe('1 pasada · lanes_future 2');
    expect(rows[6].value).toBe('1 intento · 15 min');
    // Un solo rol no lleva conjunción.
    expect(controlRows({ ...controls, mfa_required_for: ['ADMIN'] }, roleName)[0].value).toBe('Administrador de la plataforma');
    // El historial con una sola contraseña se dice en singular.
    expect(controlRows({ ...controls, password_history_size: 1 }, roleName)[3].value).toBe('La última');
  });

  it('el informe está filtrado solo con algún filtro encendido', () => {
    expect(isFiltered({})).toBe(false);
    expect(isFiltered({ without_mfa: false, stale: false, locked: false, search: '' })).toBe(false);
    expect(isFiltered({ role: 'ADMIN' })).toBe(true);
    expect(isFiltered({ company_id: 1 })).toBe(true);
    expect(isFiltered({ without_mfa: true })).toBe(true);
    expect(isFiltered({ stale: true })).toBe(true);
    expect(isFiltered({ locked: true })).toBe(true);
    expect(isFiltered({ search: 'ana' })).toBe(true);
  });

  it('la exportación llegó al tope del servidor', () => {
    expect(reachedLimit(12, 5000)).toBe(false);
    expect(reachedLimit(5000, 5000)).toBe(true);
  });
});
