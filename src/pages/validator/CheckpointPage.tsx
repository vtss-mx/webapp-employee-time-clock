import { ArrowRight, CheckCircle2, CircleSlash, History, QrCode, ScanFace, ShieldCheck, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { LiveFaceFlow } from '../../components/LiveFaceFlow';
import { QrScanPanel } from '../../components/QrScanPanel';
import { VerificationAttempt, type VerificationOutcome } from '../../components/VerificationAttempt';
import { VALIDATOR_MODES, ValidatorModeBadge, availableMethods, type CheckpointMethod } from '../../components/ValidatorModes';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useErrorPopup } from '../../hooks/useFeedback';
import { useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { errorMessage } from '../../services/apiClient';
import { checkpointService } from '../../services/checkpointService';
import type { CheckpointEmployee, CheckpointEvent, CheckpointProfile } from '../../types';
import { config } from '../../utils/config';
import { failureReason, methodLabel, timeAgo } from '../../utils/format';

type Finish = (outcome: VerificationOutcome) => void;

const METHOD_CARDS: Record<CheckpointMethod, { title: string; description: string; Icon: typeof ScanFace }> = {
  FACE: { title: 'RECONOCER ROSTRO', description: 'La persona mira a la cámara; se busca entre todo el personal', Icon: ScanFace },
  QR: { title: 'ESCANEAR QR', description: 'Credencial impresa o en el teléfono del empleado', Icon: QrCode },
  QR_AND_FACE: { title: 'QR + ROSTRO', description: 'Escanea su QR y confirma que el rostro es de su dueño', Icon: ShieldCheck },
};
const KIOSK = { autoReturnSeconds: config.checkpointResultSeconds };
const FACE_HINT = 'Pide a la persona que mire de frente a la cámara, sin lentes ni cubrebocas';

interface FaceStepProps {
  title: string;
  description: string;
  finish: Finish;
  onCancel: () => void;
  /** QR y rostro: el rostro debe ser del dueño de este QR. */
  qrContent?: string;
  onUseQr?: () => void;
}

/** Captura facial guiada del punto de control (prueba de vida según la política de la empresa). */
function FaceStep({ title, description, finish, onCancel, qrContent, onUseQr }: FaceStepProps) {
  const { policy } = useVerificationPolicy();
  return (
    <LiveFaceFlow
      title={title}
      description={description}
      frontalFrames={config.verificationFrames}
      finalStep="Identificación"
      submittingMessage="Identificando..."
      policy={policy}
      // La gorra se decide después de saber quién es (algunos empleados están exentos).
      headwearExempt
      alternative={onUseQr && { label: 'Usar su código QR', icon: <QrCode size={18} />, onSelect: onUseQr }}
      onSubmit={async ({ frontal, challenge }) => finish({ result: await checkpointService.identifyFace(frontal, challenge, qrContent), error: null })}
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
        description={`QR de ${holder.employee.name} (${holder.employee.employee_number}). ${FACE_HINT}: su rostro debe coincidir.`}
        qrContent={holder.qr}
        finish={finish}
        onCancel={onCancel}
      />
    );
  }
  return (
    <QrScanPanel
      title="Paso 1 de 2 · Código QR"
      description="Escanea el código QR de la credencial del empleado. Después se confirmará su rostro."
      busyMessage="QR detectado. Buscando al empleado..."
      invalidMessage="QR inválido. Usa la credencial generada por la empresa"
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
  method: CheckpointMethod;
  canUseQr: boolean;
  onSwitch: (method: CheckpointMethod) => void;
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
        if (method === 'QR_AND_FACE') return <QrThenFace finish={finish} onCancel={onExit} />;
        if (method === 'FACE') {
          return (
            <FaceStep
              title="Reconocer rostro"
              description={`${FACE_HINT}; después deberá girar la cabeza si se le indica.`}
              finish={finish}
              onCancel={onExit}
              onUseQr={canUseQr ? () => onSwitch('QR') : undefined}
            />
          );
        }
        return (
          <QrScanPanel
            title="Escanear QR"
            description="Apunta la cámara al código QR de la credencial del empleado. La lectura es automática."
            busyMessage="QR detectado. Identificando..."
            invalidMessage="QR inválido. Usa la credencial generada por la empresa"
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

function RecentList({ events }: { events: CheckpointEvent[] | null }) {
  if (!events) return <p className="muted small">Cargando...</p>;
  if (events.length === 0) return <p className="muted small">Aún no hay identificaciones en este dispositivo.</p>;
  return (
    <ul className="recent-list stagger">
      {events.map((event) => (
        <li key={event.id} className={event.success ? 'is-ok' : 'is-failed'}>
          {event.success ? <CheckCircle2 size={20} aria-label="Identificado" /> : <XCircle size={20} aria-label="No identificado" />}
          <span className="recent-list__info">
            <strong className="truncate">{event.employee_name ?? 'No identificado'}</strong>
            <small className="muted">
              {[event.employee_number, methodLabel[event.method], event.success ? null : failureReason(event.reason)].filter(Boolean).join(' · ')}
            </small>
          </span>
          <time className="muted small" dateTime={event.created_at}>
            {timeAgo(event.created_at)}
          </time>
        </li>
      ))}
    </ul>
  );
}

/**
 * Punto de control del validador (tableta o teléfono): identifica a cualquier empleado de su
 * empresa con el modo que le asignó la empresa (QR, rostro, cualquiera de los dos o ambos).
 */
export function CheckpointPage() {
  const [profile, setProfile] = useState<CheckpointProfile | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [events, setEvents] = useState<CheckpointEvent[] | null>(null);
  const [method, setMethod] = useState<CheckpointMethod | null>(null);

  const load = useCallback(() => {
    setError(null);
    checkpointService.profile().then(setProfile).catch(setError);
  }, []);
  const refreshRecent = useCallback(() => {
    checkpointService.recent(config.checkpointRecentItems).then(setEvents).catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  useEffect(refreshRecent, [refreshRecent]);
  useErrorPopup(error, { title: 'No se pudo cargar el punto de control', retry: load });

  if (!profile) return error ? <RetryState onRetry={load} /> : <SkeletonCard lines={5} />;

  const methods = availableMethods(profile.mode, profile.qr_enabled);
  if (method) {
    return (
      <CheckpointSession
        method={method}
        canUseQr={methods.includes('QR')}
        onSwitch={setMethod}
        onExit={() => setMethod(null)}
        onOutcome={refreshRecent}
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
            <div className="empty">
              <span className="icon-tile icon-tile--lg">
                <CircleSlash size={30} />
              </span>
              <h2>Identificación con QR desactivada</h2>
              <p className="muted">
                Este validador identifica {VALIDATOR_MODES[profile.mode].label.toLowerCase()}, pero tu empresa desactivó la verificación con QR.
                Pide a un administrador que la active o que cambie el modo del validador.
              </p>
            </div>
          ) : (
            <div className="method-grid stagger">
              {methods.map((key) => {
                const { title, description, Icon } = METHOD_CARDS[key];
                return (
                  <button key={key} type="button" className="method-card" onClick={() => setMethod(key)}>
                    <span className="method-card__icon">
                      <Icon size={42} />
                    </span>
                    <span className="method-card__title">{title}</span>
                    <span className="method-card__desc">{description}</span>
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
          <RecentList events={events} />
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
