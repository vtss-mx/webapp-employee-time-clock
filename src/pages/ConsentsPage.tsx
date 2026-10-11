import { FileText, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { consentFacts, grantConsentConfirm } from '../components/consents/consentParts';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../components/ui/Panel';
import { RetryState } from '../components/ui/RetryState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { useAction } from '../hooks/useAction';
import { useAuth } from '../hooks/useAuth';
import { useResource } from '../hooks/useResource';
import { t, useT } from '../i18n';
import { localizeServerText } from '../i18n/serverTexts';
import { paths } from '../routes/paths';
import { consentService } from '../services/consentService';
import type { ConsentAsk, ConsentAskList } from '../types/consents';
import { isConsentOutdated, pendingConsents } from '../utils/consents';

const loadError = () => t('consents.loadError');

/**
 * Pantalla del consentimiento biométrico (ruta hija de Mi perfil; regla 22 de la raíz: el consentimiento se pide con
 * su TEXTO COMPLETO y en el idioma de la persona, nunca con una casilla decorativa ni un resumen).
 *
 * El título y los cinco párrafos los escribe el servidor y se dibujan TAL CUAL; al otorgar se le devuelven la misma
 * `version` y el mismo `text_sha256` que mostró, en el MISMO idioma (el servidor recalcula la huella con
 * `Accept-Language`), así queda probado qué leyó. Un 422 `CONSENT_TEXT_MISMATCH` o un 409 vuelven a pedir el texto
 * para que lo lea vigente; el idioma es parte de la llave de `useResource`, así que un cambio en caliente lo trae de
 * nuevo con su huella nueva.
 *
 * Se llega desde Mi perfil o desde un paso del registro de identidad que el servidor detuvo con 403
 * `BIOMETRIC_CONSENT_REQUIRED` (`state.from`): al otorgarlo se reanuda ESE paso donde iba, nunca un callejón sin
 * salida (regla 7). Mi perfil es de todos los roles, pero estas APIs son del EMPLOYEE: otra cuenta ve el vacío.
 */
export function ConsentsPage() {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  /** El paso del registro al que hay que volver al otorgarlo (si se llegó desde ahí). */
  const from = (useLocation().state as { from?: string } | null)?.from ?? null;
  const isEmployee = Boolean(user?.employee);
  const list = useResource<ConsentAskList | null>(
    (signal) => (isEmployee ? consentService.list(signal) : Promise.resolve(null)),
    String(isEmployee),
    loadError,
  );
  const { busy, run } = useAction<string>();

  /** `asked`: todos los que trajo esta lectura (para saber si, al otorgar este, ya no falta ninguno). */
  const grant = (ask: ConsentAsk, asked: readonly ConsentAsk[]) =>
    run(() => consentService.grant(ask), {
      busy: ask.type,
      confirm: () => grantConsentConfirm(ask),
      errorTitle: () => t('consents.grantFailed'),
      success: () => [t('consents.grantedTitle')],
      onSuccess: () => {
        const pending = pendingConsents(asked).filter((item) => item.type !== ask.type);
        // Ya no falta ningún consentimiento: se reanuda el paso del registro (`confirmed`: su pantalla abre la cámara
        // sin volver a preguntar). Sin paso del que venir, o con otro consentimiento pendiente, se queda aquí.
        if (from && pending.length === 0) void navigate(from, { replace: true, state: { confirmed: true } });
        else list.retry();
      },
      onError: (error) => {
        if (isConsentOutdated(error)) list.retry();
      },
    });

  if (!isEmployee) {
    return (
      <div className="page page--narrow">
        <Panel>
          <PanelHeader title={t('consents.pageTitle')} backTo={paths.profile} backLabel={t('consents.back')} />
          <EmptyState icon={<ShieldCheck />} title={t('consents.onlyEmployees.title')} description={t('consents.onlyEmployees.description')} />
        </Panel>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <Panel>
        <PanelHeader
          title={t('consents.pageTitle')}
          subtitle={t('consents.pageSubtitle')}
          backTo={from ?? paths.profile}
          backLabel={t(from ? 'consents.backToEnrollment' : 'consents.back')}
        />
        {!list.data ? (
          list.error ? (
            <RetryState onRetry={list.retry} />
          ) : (
            <SkeletonCard lines={8} />
          )
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<ShieldCheck />} title={t('consents.empty.title')} description={t('consents.empty.description')} />
        ) : (
          list.data.items.map((ask, _index, asked) => (
            <PanelSection key={ask.type} title={localizeServerText(ask.title)} icon={<FileText size={20} />}>
              {ask.paragraphs.map((paragraph) => (
                <p key={paragraph} className="consent-text">
                  {localizeServerText(paragraph)}
                </p>
              ))}
              <p className="muted small">{t('consents.version', { version: ask.version })}</p>
              {ask.granted ? (
                <p className="inline-note small">
                  <ShieldCheck size={16} /> {consentFacts(ask)}
                </p>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  block
                  icon={<ShieldCheck size={18} />}
                  loading={busy === ask.type}
                  disabled={busy !== null}
                  onClick={() => void grant(ask, asked)}
                >
                  {t('consents.grant')}
                </Button>
              )}
            </PanelSection>
          ))
        )}
      </Panel>
    </div>
  );
}
