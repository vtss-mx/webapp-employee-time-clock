import { ArrowRight, CheckCircle2, CircleSlash, History, QrCode, ScanFace, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { QrScanPanel } from '../../components/QrScanPanel';
import { VerificationAttempt, type VerificationOutcome } from '../../components/VerificationAttempt';
import { ValidatorModeBadge, availableMethods } from '../../components/ValidatorModes';
import { EmptyState } from '../../components/ui/EmptyState';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useErrorPopup } from '../../hooks/useFeedback';
import { usePagedList, type PagedList } from '../../hooks/usePagedList';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { errorMessage } from '../../services/apiClient';
import { checkpointService } from '../../services/checkpointService';
import type { CheckpointEmployee, CheckpointEvent, CheckpointProfile, VerificationMethod } from '../../types';
import { config } from '../../utils/config';
import { timeAgo } from '../../utils/format';

type Finish = (outcome: VerificationOutcome) => void;

/** Ícono de cada método; el título y la descripción vienen del catálogo verification_methods. */
const METHOD_ICONS: Partial<Record<string, LucideIcon>> = { FACE: ScanFace, QR: QrCode, QR_FACE: ShieldCheck };
const KIOSK = { autoReturnSeconds: config.checkpointResultSeconds };

interface FaceStepProps {
  title: string;
  finish: Finish;
  onCancel: () => void;
  /** QR y rostro: el rostro debe ser del dueño de este QR. */
  qrContent?: string;
  onUseQr?: () => void;
}

/** Captura facial guiada del punto de control (prueba de vida según la política de la empresa). */
function FaceStep({ title, finish, onCancel, qrContent, onUseQr }: FaceStepProps) {
  const { policy } = useVerificationPolicy();
  return (
    <LiveFaceFlow
      title={title}
      frontalFrames={config.verificationFrames}
      submittingMessage="Identificando..."
      policy={policy}
      alternative={onUseQr && { label: 'Usar su código QR', icon: <QrCode size={18} />, onSelect: onUseQr }}
      onSubmit={async (captured) => finish({ result: await checkpointService.identifyFace(captured, qrContent), error: null })}
      onFatal={(error) => finish({ result: null, error: errorMessage(error) })}
      onCancel={onCancel}
    />
  );
}

/** QR y rostro: primero el QR (de quién es) y luego su rostro. */
function QrThenFace({ finish, onCancel }: { finish: Finish; onCancel: () => void }) {
  const [holder, setHolder] = useState<{ qr: string; employee: CheckpointEmployee } | null>(null);
  if (holder) {
    return (
      <FaceStep
        title={`Paso 2 de 2 · ${holder.employee.name}`}
        qrContent={holder.qr}
        finish={finish}
        onCancel={onCancel}
      />
    );
  }
  return (
    <QrScanPanel
      title="Paso 1 de 2 · Código QR"
      description="Escanea el código QR que el empleado muestra en su teléfono. Después se confirmará su rostro."
      busyMessage="QR detectado. Buscando al empleado..."
      invalidMessage="QR inválido. Pide al empleado que muestre su código desde la app"
      onScan={async (content) => {
        try {
          setHolder({ qr: content, employee: await checkpointService.inspectQr(content) });
        } catch (error) {
          finish({ result: null, error: errorMessage(error) });
        }
      }}
      onCancel={onCancel}
    />
  );
}

interface SessionProps {
  method: VerificationMethod;
  canUseQr: boolean;
  onSwitch: (method: VerificationMethod) => void;
  onExit: () => void;
  onOutcome: () => void;
}

/** Una identificación: captura → resultado → (solo) de regreso al inicio para la siguiente persona. */
function CheckpointSession({ method, canUseQr, onSwitch, onExit, onOutcome }: SessionProps) {
  return (
    <VerificationAttempt
      key={method}
      kiosk={KIOSK}
      onBack={onExit}
      onOutcome={onOutcome}
      failureTitle={(outcome) => (outcome.result ? 'Empleado no identificado' : 'No fue posible identificar')}
    >
      {(finish) => {
        if (method === 'QR_FACE') return <QrThenFace finish={finish} onCancel={onExit} />;
        if (method === 'FACE') {
          return (
            <FaceStep
              title="Reconocer rostro"
              finish={finish}
              onCancel={onExit}
              onUseQr={canUseQr ? () => onSwitch('QR') : undefined}
            />
          );
        }
        return (
          <QrScanPanel
            title="Escanear QR"
            description="Apunta la cámara al código QR que el empleado muestra en su teléfono. La lectura es automática y cada código sirve una sola vez."
            busyMessage="QR detectado. Identificando..."
            invalidMessage="QR inválido. Pide al empleado que muestre su código desde la app"
            onScan={async (content) => {
              try {
                finish({ result: await checkpointService.identifyQr(content), error: null });
              } catch (error) {
                finish({ result: null, error: errorMessage(error) });
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
  const { nameOf } = useCatalogs();
  return (
    <PagedItems
      list={list}
      skeletonRows={3}
      empty={{ compact: true, icon: <History />, title: 'Aún no hay identificaciones', description: 'Cada identificación hecha en este dispositivo aparecerá aquí con su resultado y su hora.' }}
      pager={{ variant: 'compact', siblings: 0, noun: { one: 'identificación', other: 'identificaciones' } }}
    >
      {(events) => (
      <ul className={`recent-list stagger ${list.loading ? 'is-loading' : ''}`}>
        {events.map((event) => (
          <li key={event.id} className={event.success ? 'is-ok' : 'is-failed'}>
            {event.success ? <CheckCircle2 size={20} aria-label="Identificado" /> : <XCircle size={20} aria-label="No identificado" />}
            <span className="recent-list__info">
              <strong className="truncate">{event.employee_name ?? 'No identificado'}</strong>
              <small className="muted">
                {[event.employee_number, nameOf('verification_methods', event.method), event.success ? null : nameOf('verification_reasons', event.reason, 'Fallida')]
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
 * empresa con el modo que le asignó la empresa (QR, rostro, cualquiera de los dos o ambos).
 */
export function CheckpointPage() {
  const catalogs = useCatalogs();
  const [profile, setProfile] = useState<CheckpointProfile | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [method, setMethod] = useState<VerificationMethod | null>(null);

  const load = useCallback(() => {
    setError(null);
    checkpointService.profile().then(setProfile).catch(setError);
  }, []);
  const recent = usePagedList((page, signal) => checkpointService.recent(page, signal), { errorTitle: 'No se pudieron cargar las identificaciones recientes' });
  useEffect(load, [load]);
  useErrorPopup(error, { title: 'No se pudo cargar el punto de control', retry: load });

  if (!profile) return error ? <RetryState onRetry={load} /> : <SkeletonCard lines={5} />;

  const methods = availableMethods(catalogs.byCode('validator_modes', profile.mode), profile.qr_enabled);
  if (method) {
    return (
      <CheckpointSession
        method={method}
        canUseQr={methods.includes('QR')}
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
          <p className="muted">¿Cómo identificamos a la siguiente persona?</p>
          <ValidatorModeBadge mode={profile.mode} />
        </PanelHero>

        <PanelSection>
          {methods.length === 0 ? (
            <EmptyState
              icon={<CircleSlash />}
              title="Identificación con QR desactivada"
              description={`Este validador usa el modo «${catalogs.nameOf('validator_modes', profile.mode)}», pero tu empresa desactivó la verificación con QR. Pide a un administrador que la active o que cambie el modo del validador.`}
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
                      Comenzar <ArrowRight size={18} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </PanelSection>

        <PanelSection title="Últimas identificaciones" icon={<History size={20} />}>
          <RecentList list={recent} />
        </PanelSection>
        <PanelFooter align="center">
          <p className="inline-note small muted">
            <ShieldCheck size={16} color="var(--success)" /> Solo se identifican empleados activos de {profile.company.name} · Cada intento queda en la bitácora
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
