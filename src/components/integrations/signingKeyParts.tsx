import { Ban, RefreshCw, ShieldCheck, ShieldOff, Signature } from 'lucide-react';
import { ApiKeyStatusBadge } from '../StatusBadge';
import { Button, ButtonLink } from '../ui/Button';
import { CopyField } from '../ui/CopyField';
import { EmptyState } from '../ui/EmptyState';
import { t, useT } from '../../i18n';
import type { PlatformKey, SigningKey } from '../../types';
import { formatDate, formatDateTime, timeAgo } from '../../utils/format';
import { ExpiryBadge } from './ExpiryBadge';

/**
 * Piezas de la sección «Claves de firma» de la pantalla Integraciones (migración 0105 del backend): una clave de la
 * empresa en la lista y la clave pública con que la PLATAFORMA firma sus respuestas.
 *
 * Lo que aquí se dibuja es público por diseño (una clave pública y su huella no son un secreto). La clave PRIVADA
 * de la empresa no pasa por aquí: la plataforma no la tiene y, si la generó, se muestra una sola vez en su popup
 * (`signingKeyMessages.tsx`).
 *
 * Los textos de fila que significan lo mismo que en una llave de la API (vencimiento, último uso, quién la creó o
 * la revocó, «Rotar», «Revocar») se reutilizan de `apiKeys.row.*` (regla 6 de la raíz): es la MISMA pantalla y la
 * misma idea, así que no se traducen dos veces.
 */

/** De dónde salió la clave: la subió la empresa (lo recomendado) o la generó la plataforma. */
function origin(key: SigningKey): string {
  return t(key.generated ? 'signingKeys.row.generated' : 'signingKeys.row.uploaded');
}

/** Último uso de la clave en una petición firmada, o «Aún sin usar». */
function lastUse(key: SigningKey): string {
  return key.last_used_at ? t('apiKeys.row.lastUsed', { ago: timeAgo(key.last_used_at) }) : t('apiKeys.row.neverUsed');
}

interface SigningKeyRowProps {
  item: SigningKey;
  /** Ruta de «Rotar» (registrar la nueva diciendo que reemplaza a esta). */
  rotateTo: string;
  /**
   * La empresa llegó al tope de claves vigentes que envía el servidor (`limits`). Rotar también registra una clave
   * nueva, así que tampoco cabe: el botón queda deshabilitado con su motivo en lugar de ofrecer algo que el
   * servidor rechazaría (regla 7 de la raíz: nunca una acción que no puede funcionar).
   */
  full: boolean;
  /** Qué clave se está revocando (el botón de esa fila queda ocupado y los demás deshabilitados). */
  busy: number | null;
  onRevoke: (key: SigningKey) => void;
}

/** Una clave de firma: nombre, huella para copiar, de dónde salió, vigencia, uso y sus acciones. */
export function SigningKeyRow({ item, rotateTo, full, busy, onRevoke }: SigningKeyRowProps) {
  const t = useT();
  const created = formatDate(item.created_at);
  const revoked = formatDateTime(item.revoked_at);
  // Una clave revocada o vencida ya no sirve para firmar: no se rota ni se vuelve a revocar.
  const usable = item.status === 'ACTIVE';
  return (
    <li>
      <span className="icon-tile">
        <Signature size={20} />
      </span>
      <span className="validator-list__info">
        <strong className="truncate">{item.label}</strong>
        <CopyField value={item.fingerprint} label={t('signingKeys.row.copyFingerprint')} />
        <small className="muted truncate">
          {origin(item)} ·{' '}
          {item.created_by ? t('apiKeys.row.createdBy', { date: created, name: item.created_by }) : t('apiKeys.row.created', { date: created })} ·{' '}
          {t('apiKeys.row.expires', { date: formatDate(item.expires_at) })}
        </small>
        <small className="muted truncate" title={item.last_used_at ? formatDateTime(item.last_used_at) : undefined}>
          {lastUse(item)}
        </small>
        {item.revoked_at && (
          <small className="muted truncate">
            {item.revoked_by ? t('apiKeys.row.revokedBy', { date: revoked, name: item.revoked_by }) : t('apiKeys.row.revoked', { date: revoked })}
          </small>
        )}
      </span>
      <span className="validator-list__badges">
        <ApiKeyStatusBadge status={item.status} />
        <ExpiryBadge expiringSoon={item.expiring_soon} status={item.status} days={item.days_to_expire} />
        {/* El algoritmo lo decide el servidor (hoy `ES256`): es un código, no un texto que se traduzca. */}
        <span className="badge badge--info badge--plain">{item.algorithm}</span>
      </span>
      {usable && (
        <span className="validator-list__actions">
          {full ? (
            <Button size="sm" variant="secondary" icon={<RefreshCw size={16} />} disabled title={t('signingKeys.list.fullHint')}>
              {t('apiKeys.row.rotate')}
            </Button>
          ) : (
            <ButtonLink to={rotateTo} size="sm" variant="secondary" icon={<RefreshCw size={16} />}>
              {t('apiKeys.row.rotate')}
            </ButtonLink>
          )}
          <Button size="sm" variant="danger-outline" icon={<Ban size={16} />} loading={busy === item.id} disabled={busy !== null} onClick={() => onRevoke(item)}>
            {t('apiKeys.row.revoke')}
          </Button>
        </span>
      )}
    </li>
  );
}

/**
 * La clave pública con que la plataforma firma lo que responde a ESTA empresa (contrato §2.5): con ella el cliente
 * detecta un resultado alterado en el camino. Sin el secreto de la plataforma (`configured: false`) simplemente no
 * hay firma que verificar, y eso NO es un error: se dice con naturalidad.
 */
export function PlatformKeyPanel({ platform }: { platform: PlatformKey }) {
  const t = useT();
  if (!platform.configured || !platform.public_key || !platform.fingerprint) {
    return <EmptyState compact icon={<ShieldOff />} title={t('signingKeys.platform.off.title')} description={t('signingKeys.platform.off.description')} />;
  }
  return (
    <div className="api-guide">
      <p className="muted small">{t('signingKeys.platform.description')}</p>
      <div className="field">
        <span className="api-guide__label">{t('signingKeys.row.fingerprint')}</span>
        <CopyField value={platform.fingerprint} label={t('signingKeys.platform.copyFingerprint')} />
      </div>
      <div className="field">
        <span className="api-guide__label">{t('signingKeys.platform.publicKey')}</span>
        <CopyField value={platform.public_key} label={t('signingKeys.platform.copyPublicKey')} multiline />
      </div>
      <p className="inline-note small muted">
        <ShieldCheck size={16} color="var(--success)" /> {t('signingKeys.platform.note')}
      </p>
    </div>
  );
}
