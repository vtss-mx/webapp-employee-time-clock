import { Cloud, KeyRound, Pencil, Plus, ShieldOff, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAction } from '../../hooks/useAction';
import { usePagedList } from '../../hooks/usePagedList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { passkeyService } from '../../services/passkeyService';
import type { Passkey } from '../../types/passkeys';
import { formatDateTime } from '../../utils/format';
import { passkeysSupported } from '../../utils/webauthn';
import { Button, ButtonLink } from '../ui/Button';
import { PagedItems } from '../ui/PagedItems';
import { PanelSection } from '../ui/Panel';

const loadError = () => t('passkeys.loadError');

/** Cuándo se creó y cuándo se usó por última vez una llave, en una línea. */
export function passkeyFacts(passkey: Passkey): string {
  const used = passkey.last_used_at ? t('passkeys.lastUsed', { date: formatDateTime(passkey.last_used_at) }) : t('passkeys.neverUsed');
  return `${t('passkeys.created', { date: formatDateTime(passkey.created_at) })} · ${used}`;
}

/**
 * «Llaves de acceso» de Mi perfil (WebAuthn / passkeys, antifraude fase 3): las de la cuenta con cuándo se crearon y
 * usaron, si están sincronizadas, renombrar (pantalla propia), revocar (confirmado; borrado real, como una sesión) y
 * agregar una en este dispositivo (pantalla propia). Un navegador sin llaves de acceso lo dice y solo lista.
 */
export function PasskeysSection() {
  useT();
  const navigate = useNavigate();
  const list = usePagedList((page, signal) => passkeyService.list(page, signal), { errorTitle: loadError });
  const { busy, run } = useAction<number>();
  const supported = passkeysSupported();

  const revoke = (passkey: Passkey) =>
    run(() => passkeyService.revoke(passkey.id), {
      busy: passkey.id,
      confirm: () => ({
        kind: 'delete',
        icon: <ShieldOff size={30} />,
        eyebrow: t('passkeys.revokeAsk.eyebrow'),
        title: t('passkeys.revokeAsk.title', { name: passkey.name }),
        message: t('passkeys.revokeAsk.message'),
        details: [passkeyFacts(passkey)],
        note: t('passkeys.revokeAsk.note'),
        confirmLabel: t('passkeys.revokeAsk.confirm'),
        confirmIcon: <ShieldOff size={18} />,
      }),
      errorTitle: () => t('passkeys.revokeFailed'),
      success: () => [t('passkeys.revoked')],
      onSuccess: list.retry,
    });

  return (
    <PanelSection
      title={t('passkeys.title')}
      icon={<KeyRound size={20} />}
      aside={list.data && <span className="badge badge--info">{list.total}</span>}
    >
      <p className="muted small">{t('passkeys.intro')}</p>
      <PagedItems
        list={list}
        skeletonRows={2}
        empty={{ compact: true, icon: <KeyRound />, title: t('passkeys.empty.title'), description: t('passkeys.empty.description') }}
        pager={{ variant: 'compact', siblings: 0, noun: { one: t('passkeys.noun.one'), other: t('passkeys.noun.other') } }}
      >
        {(passkeys) => (
          <ul className={`session-list ${list.loading ? 'is-loading' : ''}`}>
            {passkeys.map((passkey) => (
              <li key={passkey.id}>
                {passkey.backed_up ? <Cloud size={22} /> : <Smartphone size={22} />}
                <span className="session-list__info">
                  <strong>
                    {passkey.name} <span className="badge badge--muted">{t(passkey.backed_up ? 'passkeys.synced' : 'passkeys.deviceOnly')}</span>
                  </strong>
                  <span className="muted small">{passkeyFacts(passkey)}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Pencil size={16} />}
                  aria-label={t('passkeys.actionLabel', { action: t('passkeys.rename'), name: passkey.name })}
                  disabled={busy !== null}
                  onClick={() => void navigate(paths.profilePasskeyRename(passkey.id), { state: { passkey } })}
                >
                  {t('passkeys.rename')}
                </Button>
                <Button
                  size="sm"
                  variant="danger-outline"
                  icon={<ShieldOff size={16} />}
                  aria-label={t('passkeys.actionLabel', { action: t('passkeys.revoke'), name: passkey.name })}
                  loading={busy === passkey.id}
                  disabled={busy !== null}
                  onClick={() => void revoke(passkey)}
                >
                  {t('passkeys.revoke')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PagedItems>
      {supported ? (
        <ButtonLink to={paths.profilePasskeyNew} variant="secondary" block icon={<Plus size={18} />}>
          {t('passkeys.add')}
        </ButtonLink>
      ) : (
        <p className="inline-note small muted">
          <ShieldOff size={16} /> {t('passkeys.unsupported')}
        </p>
      )}
    </PanelSection>
  );
}
