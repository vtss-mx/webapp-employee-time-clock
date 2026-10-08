import { ArrowRight, CheckCircle2, CircleSlash, History, QrCode, ScanFace, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { locationProblemMessage } from '../../components/location/locationMessages';
import { QrScanPanel } from '../../components/QrScanPanel';
import { VerificationAttempt, type VerificationOutcome } from '../../components/VerificationAttempt';
import { ValidatorModeBadge, availableMethods } from '../../components/ValidatorModes';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import { usePagedList, type PagedList } from '../../hooks/usePagedList';
import { useResource } from '../../hooks/useResource';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { useWarmLocation } from '../../hooks/useWarmLocation';
import { t, useLocale } from '../../i18n';
import { errorMessage } from '../../services/apiClient';
import { checkpointService } from '../../services/checkpointService';
import type { CheckpointEmployee, CheckpointEvent, VerificationMethod } from '../../types';
import { config } from '../../utils/config';
import { timeAgo } from '../../utils/format';
import type { LocationTake } from '../../utils/locationPayload';

type Finish = (outcome: VerificationOutcome) => void;
/** La ubicación para adjuntar a una identificación (antifraude 2b); null si el validador no la requiere o no hay. */
type Locate = () => Promise<LocationTake | null>;

/** El error de un intento, escrito al dibujarse (el resultado en pantalla sigue al idioma activo). */
const failed = (finish: Finish, error: unknown) => finish({ result: null, error: () => errorMessage(error) });

/** Ícono de cada método; el título y la descripción vienen del catálogo verification_methods. */
const METHOD_ICONS: Partial<Record<string, LucideIcon>> = { FACE: ScanFace, QR: QrCode, QR_FACE: ShieldCheck };
const KIOSK = { autoReturnSeconds: config.checkpointResultSeconds };

interface FaceStepProps {
  title: string;
  finish: Finish;
  locate: Locate;
  onCancel: () => void;
  /** QR y rostro: el rostro debe ser del dueño de este QR. */
  qrContent?: string;
  onUseQr?: () => void;
}

/** Captura facial guiada del punto de control (prueba de vida según la política de la empresa). */
function FaceStep({ title, finish, locate, onCancel, qrContent, onUseQr }: FaceStepProps) {
  const { policy } = useVerificationPolicy();
  return (
    <LiveFaceFlow
      title={title}
      frontalFrames={config.verificationFrames}
      submittingMessage={t('checkpoint.face.submitting')}
      policy={policy}
      alternative={onUseQr && { label: t('checkpoint.face.useQr'), icon: <QrCode size={18} />, onSelect: onUseQr }}
      onSubmit={async (captured) => finish({ result: await checkpointService.identifyFace(captured, qrContent, await locate()), error: null })}
      onFatal={(error) => failed(finish, error)}
      onCancel={onCancel}
    />
  );
}

/** QR y rostro: primero el QR (de quién es) y luego su rostro. */
function QrThenFace({ finish, locate, onCancel }: { finish: Finish; locate: Locate; onCancel: () => void }) {
  const [holder, setHolder] = useState<{ qr: string; employee: CheckpointEmployee } | null>(null);
  if (holder) {
    return (
      <FaceStep
        title={t('checkpoint.qrFace.faceTitle', { name: holder.employee.name })}
        qrContent={holder.qr}
        finish={finish}
        locate={locate}
        onCancel={onCancel}
      />
    );
  }
  return (
    <QrScanPanel
      title={t('checkpoint.qrFace.qrTitle')}
      description={t('checkpoint.qrFace.qrText')}
      busyMessage={t('checkpoint.qrFace.busy')}
      invalidMessage={t('checkpoint.invalidQr')}
      onScan={async (content) => {
        try {
          setHolder({ qr: content, employee: await checkpointService.inspectQr(content, await locate()) });
        } catch (error) {
          failed(finish, error);
        }
      }}
      onCancel={onCancel}
    />
  );
}

interface SessionProps {
  method: VerificationMethod;
  canUseQr: boolean;
  locate: Locate;
  onSwitch: (method: VerificationMethod) => void;
  onExit: () => void;
  onOutcome: () => void;
}

/** Una identificación: captura → resultado → (solo) de regreso al inicio para la siguiente persona. */
function CheckpointSession({ method, canUseQr, locate, onSwitch, onExit, onOutcome }: SessionProps) {
  return (
    <VerificationAttempt
      key={method}
      kiosk={KIOSK}
      onBack={onExit}
      onOutcome={onOutcome}
      failureTitle={(outcome) => (outcome.result ? t('checkpoint.notIdentified') : t('checkpoint.failed'))}
    >
      {(finish) => {
        if (method === 'QR_FACE') return <QrThenFace finish={finish} locate={locate} onCancel={onExit} />;
        if (method === 'FACE') {
          return (
            <FaceStep
              title={t('checkpoint.face.title')}
              finish={finish}
              locate={locate}
              onCancel={onExit}
              onUseQr={canUseQr ? () => onSwitch('QR') : undefined}
            />
          );
        }
        return (
          <QrScanPanel
            title={t('checkpoint.qr.title')}
            description={t('checkpoint.qr.text')}
            busyMessage={t('checkpoint.qr.busy')}
            invalidMessage={t('checkpoint.invalidQr')}
            onScan={async (content) => {
              try {
                finish({ result: await checkpointService.identifyQr(content, await locate()), error: null });
              } catch (error) {
                failed(finish, error);
              }
            }}
            onCancel={onExit}
          />
        );
      }}
    </VerificationAttempt>
  );
}

/** Identificaciones de este dispositivo (paginadas): quién, cómo y cuándo. */
function RecentList({ list }: { list: PagedList<CheckpointEvent> }) {
  useLocale();
  const { nameOf } = useCatalogs();
  return (
    <PagedItems
      list={list}
      skeletonRows={3}
      empty={{ compact: true, icon: <History />, title: t('checkpoint.recent.emptyTitle'), description: t('checkpoint.recent.emptyDescription') }}
      pager={{ variant: 'compact', siblings: 0, noun: { one: t('checkpoint.recent.nounOne'), other: t('checkpoint.recent.nounOther') } }}
    >
      {(events) => (
      <ul className={`recent-list stagger ${list.loading ? 'is-loading' : ''}`}>
        {events.map((event) => (
          <li key={event.id} className={event.success ? 'is-ok' : 'is-failed'}>
            {event.success ? <CheckCircle2 size={20} aria-label={t('checkpoint.recent.identified')} /> : <XCircle size={20} aria-label={t('checkpoint.recent.notIdentified')} />}
            {event.employee_name && <Avatar name={event.employee_name} src={event.avatar} size="sm" decorative />}
            <span className="recent-list__info">
              <strong className="truncate">{event.employee_name ?? t('checkpoint.recent.notIdentified')}</strong>
              <small className="muted">
                {[event.employee_number, nameOf('verification_methods', event.method), event.success ? null : nameOf('verification_reasons', event.reason, t('verification.outcome.failed'))]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </span>
            <time className="muted small" dateTime={event.created_at}>
              {timeAgo(event.created_at)}
            </time>
          </li>
        ))}
      </ul>
      )}
    </PagedItems>
  );
}

/**
 * Punto de control del validador (tableta o teléfono): identifica a cualquier empleado de su
 * empresa con el modo que le asignó la empresa (QR, rostro, cualquiera de los dos o ambos). Si el validador requiere
 * ubicación, la pantalla la mantiene "caliente" mientras está abierta y cada identificación la lleva (antifraude 2b);
 * un permiso bloqueado se explica una vez, sin impedir identificar (decide el servidor).
 */
export function CheckpointPage() {
  useLocale(); // textos con `t` al dibujarse: un cambio de idioma los traduce sin reiniciar la identificación en curso
  const catalogs = useCatalogs();
  const feedback = useFeedback();
  const { data: profile, error, retry: load } = useResource((signal) => checkpointService.profile(signal), 'profile', () => t('checkpoint.errorTitle'));
  const [method, setMethod] = useState<VerificationMethod | null>(null);
  const recent = usePagedList((page, signal) => checkpointService.recent(page, signal), { errorTitle: () => t('checkpoint.recent.errorTitle') });
  const location = useWarmLocation(Boolean(profile?.location_required), (problem) => void feedback.show(() => locationProblemMessage(problem, 'checkpoint')));

  if (!profile) return error ? <RetryState onRetry={load} /> : <SkeletonCard lines={5} />;

  const methods = availableMethods(catalogs.byCode('validator_modes', profile.mode), profile.qr_enabled);
  if (method) {
    return (
      <CheckpointSession
        method={method}
        canUseQr={methods.includes('QR')}
        locate={location.take}
        onSwitch={setMethod}
        onExit={() => setMethod(null)}
        onOutcome={recent.retry}
      />
    );
  }

  return (
    <div className="page page-transition checkpoint">
      <Panel>
        <PanelHero eyebrow={profile.company.name} title={profile.name}>
          <p className="muted">{t('checkpoint.question')}</p>
          <ValidatorModeBadge mode={profile.mode} />
        </PanelHero>

        <PanelSection>
          {methods.length === 0 ? (
            <EmptyState
              icon={<CircleSlash />}
              title={t('checkpoint.qrDisabled.title')}
              description={t('checkpoint.qrDisabled.text', { mode: catalogs.nameOf('validator_modes', profile.mode) })}
            />
          ) : (
            <div className="method-grid stagger">
              {methods.map((key) => {
                const Icon = METHOD_ICONS[key] ?? ShieldCheck;
                const info = catalogs.byCode('verification_methods', key);
                return (
                  <button key={key} type="button" className="method-card" onClick={() => setMethod(key)}>
                    <span className="method-card__icon">
                      <Icon size={42} />
                    </span>
                    <span className="method-card__title">{info?.name ?? key}</span>
                    <span className="method-card__desc">{info?.description}</span>
                    <span className="method-card__cta">
                      {t('checkpoint.start')} <ArrowRight size={18} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </PanelSection>

        <PanelSection title={t('checkpoint.recent.title')} icon={<History size={20} />}>
          <RecentList list={recent} />
        </PanelSection>
        <PanelFooter align="center">
          <p className="inline-note small muted">
            <ShieldCheck size={16} color="var(--success)" /> {t('checkpoint.footer', { company: profile.company.name })}
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
