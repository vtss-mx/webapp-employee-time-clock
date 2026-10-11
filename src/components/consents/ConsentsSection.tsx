import { FileText, ShieldCheck, ShieldOff } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { localizeServerText } from '../../i18n/serverTexts';
import { paths } from '../../routes/paths';
import { consentService } from '../../services/consentService';
import type { ConsentAsk } from '../../types/consents';
import { isConsentOutdated } from '../../utils/consents';
import { Button, ButtonLink } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { PanelSection } from '../ui/Panel';
import { RetryState } from '../ui/RetryState';
import { SkeletonCard } from '../ui/Skeleton';
import { consentFacts, revokeConsentConfirm } from './consentParts';

const loadError = () => t('consents.loadError');

/**
 * «Datos biométricos» de Mi perfil (regla 22 de la raíz: derechos de la persona): el estado de cada consentimiento
 * que le pide su empresa —otorgado desde cuándo, revocado o pendiente— con el camino para leer el texto completo y
 * la acción de revocar, que confirma antes porque borra la biometría al momento.
 *
 * Solo la dibuja Mi perfil cuando la cuenta es de un empleado: las tres APIs son del rol EMPLOYEE (un ADMIN, una
 * empresa o un validador no tienen datos biométricos y recibirían 403).
 */
export function ConsentsSection() {
  useT();
  const { refreshUser } = useAuth();
  const list = useResource((signal) => consentService.list(signal), 'me-consents', loadError);
  const { busy, run } = useAction<string>();

  const revoke = (ask: ConsentAsk) =>
    run(() => consentService.revoke(ask.type), {
      busy: ask.type,
      confirm: () => revokeConsentConfirm(ask),
      errorTitle: () => t('consents.revokeFailed'),
      success: () => [t('consents.revokedTitle'), t('consents.revokedText')],
      // Al revocar, el servidor borra la biometría: sus pantallas cambian (ya no puede checar con el rostro).
      onSuccess: () => {
        list.retry();
        void refreshUser().catch(() => undefined);
      },
      // Si el servidor dice que ya no estaba vigente, lo que se ve está viejo: se vuelve a pedir.
      onError: (error) => {
        if (isConsentOutdated(error)) list.retry();
      },
    });

  return (
    <PanelSection title={t('consents.title')} icon={<ShieldCheck size={20} />}>
      <p className="muted small">{t('consents.intro')}</p>
      {!list.data ? (
        list.error ? (
          <RetryState onRetry={list.retry} />
        ) : (
          <SkeletonCard lines={3} />
        )
      ) : list.data.items.length === 0 ? (
        <EmptyState compact icon={<ShieldCheck />} title={t('consents.empty.title')} description={t('consents.empty.description')} />
      ) : (
        <ul className={`session-list ${list.loading ? 'is-loading' : ''}`}>
          {list.data.items.map((ask) => {
            const facts = consentFacts(ask);
            return (
              <li key={ask.type}>
                {ask.granted ? <ShieldCheck size={22} /> : <ShieldOff size={22} />}
                <span className="session-list__info">
                  <strong>
                    {localizeServerText(ask.title)}{' '}
                    <span className={`badge badge--${ask.granted ? 'success' : 'muted'}`}>{t(ask.granted ? 'consents.granted' : 'consents.pending')}</span>
                  </strong>
                  {facts && <span className="muted small">{facts}</span>}
                </span>
                <ButtonLink to={paths.profileConsents} variant="ghost" size="sm" icon={<FileText size={16} />}>
                  {t(ask.granted ? 'consents.review' : 'consents.read')}
                </ButtonLink>
                {ask.granted && (
                  <Button
                    size="sm"
                    variant="danger-outline"
                    icon={<ShieldOff size={16} />}
                    loading={busy === ask.type}
                    disabled={busy !== null}
                    onClick={() => void revoke(ask)}
                  >
                    {t('consents.revoke')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PanelSection>
  );
}
