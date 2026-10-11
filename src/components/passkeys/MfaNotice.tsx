import { KeyRound, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { ButtonLink } from '../ui/Button';

/**
 * Días que le quedan para registrar su llave de acceso: se cuentan en DÍAS COMPLETOS hacia arriba (si le quedan
 * 30 horas, le queda «2 días», nunca «1»). Sin fecha o ya vencido, 0.
 */
export function graceDaysLeft(until: string | null | undefined, now: number = Date.now()): number {
  if (!until) return 0;
  const end = new Date(until).getTime();
  if (Number.isNaN(end) || end <= now) return 0;
  return Math.ceil((end - now) / 86_400_000);
}

/**
 * Aviso del segundo factor obligatorio (migración 0096 del backend): su rol exige una llave de acceso y la cuenta
 * aún no tiene ninguna. Mientras dura la gracia trabaja con normalidad y este aviso le insiste con los DÍAS que le
 * quedan; cuando el plazo vence, cada pantalla responde 403 `MFA_ENROLLMENT_REQUIRED` y lo único abierto es
 * registrar la llave (por eso la acción lleva ahí y no a un «Reintentar»).
 *
 * Quién lo necesita lo decide el SERVIDOR (`user.mfa_pending`): la app no lo deduce del rol.
 */
export function MfaNotice({ variant = 'banner' }: { variant?: 'banner' | 'section' }) {
  const t = useT();
  const { user } = useAuth();
  if (!user?.mfa_pending) return null;
  const days = graceDaysLeft(user.mfa_grace_until);
  const expired = days === 0;
  return (
    <div className={`mfa-notice mfa-notice--${variant} ${expired ? 'mfa-notice--expired' : ''}`.trim()} role="status">
      {expired ? <ShieldAlert size={18} /> : <KeyRound size={18} />}
      <span className="mfa-notice__text">
        <strong>{t(expired ? 'passkeys.mfa.expiredTitle' : 'passkeys.mfa.title')}</strong>
        <span className="small">{expired ? t('passkeys.mfa.expiredText') : t('passkeys.mfa.daysLeft', { count: days })}</span>
      </span>
      <ButtonLink to={paths.profilePasskeyNew} variant="primary" size="sm" icon={<KeyRound size={16} />}>
        {t('passkeys.mfa.action')}
      </ButtonLink>
    </div>
  );
}
