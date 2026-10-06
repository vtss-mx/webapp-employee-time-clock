import { ArrowLeft, LocateFixed, MapPinOff, RefreshCw, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useT } from '../../../i18n';
import type { DeviceLocation } from '../../../utils/geolocation';
import { sampleLocation } from '../../../utils/locationSampling';
import { Button } from '../../ui/Button';
import { Panel, PanelFooter, PanelHero } from '../../ui/Panel';

/**
 * Ubicación leída para un registro (la más precisa de la toma), todas sus lecturas (el servidor detecta una ubicación
 * simulada) y cuándo se leyó (reloj del teléfono: solo para saber su edad).
 */
export interface LocationFix extends DeviceLocation {
  readAt: number;
  samples: DeviceLocation[];
}

/** Una ubicación sirve para registrar mientras es reciente; más vieja, se vuelve a leer. */
export const LOCATION_MAX_AGE_MS = 60_000;

export function isFresh(fix: LocationFix | null): fix is LocationFix {
  return fix !== null && Date.now() - fix.readAt < LOCATION_MAX_AGE_MS;
}

/** Lectura nueva de la ubicación (aviso nativo del navegador la primera vez), con las de más de su ventana corta. */
export async function readLocation(): Promise<LocationFix> {
  const { best, samples } = await sampleLocation();
  return { ...best, samples, readAt: Date.now() };
}

interface RecordPanelProps {
  /** "Registrar entrada". */
  eyebrow: string;
  title: string;
  mark: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}

/** Pantalla de un paso del registro fuera de la cámara (ubicación o un problema), centrada. */
function RecordPanel({ eyebrow, title, mark, children, footer }: RecordPanelProps) {
  return (
    <div className="page page--narrow page-transition">
      <Panel className="record-step">
        <PanelHero eyebrow={eyebrow} title={title}>
          {mark}
          {children}
        </PanelHero>
        <PanelFooter align="center">{footer}</PanelFooter>
      </Panel>
    </div>
  );
}

interface LocatingProps {
  actionTitle: string;
  onLocated: (fix: LocationFix) => void;
  onFailed: (error: unknown) => void;
  onCancel: () => void;
}

/**
 * Primer paso de un registro: la ubicación del teléfono, con el aviso NATIVO del navegador (sin popup
 * previo). Se lee al abrir; el rostro se pide después. Al salir, lo que responda tarde se ignora.
 */
export function LocatingPanel({ actionTitle, onLocated, onFailed, onCancel }: LocatingProps) {
  const t = useT();
  const latest = useRef({ onLocated, onFailed });
  useLayoutEffect(() => {
    latest.current = { onLocated, onFailed };
  });
  useEffect(() => {
    let active = true;
    const settle = (deliver: () => void) => {
      if (active) deliver();
    };
    readLocation().then(
      (fix) => settle(() => latest.current.onLocated(fix)),
      (error: unknown) => settle(() => latest.current.onFailed(error)),
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <RecordPanel
      eyebrow={actionTitle}
      title={t('myAttendance.record.locating.title')}
      mark={
        <div className="status-mark status-mark--pending" aria-hidden>
          <div className="status-mark__core">
            <LocateFixed size={40} />
          </div>
        </div>
      }
      footer={
        <Button variant="ghost" size="lg" icon={<X size={20} />} onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
      }
    >
      <p className="muted" role="status">
        {t('myAttendance.record.locating.text')}
      </p>
    </RecordPanel>
  );
}

/** Algo impidió registrar (ya explicado en el popup): solo quedan "Reintentar" y volver. */
export function ProblemPanel({ actionTitle, onRetry, onCancel }: { actionTitle: string; onRetry: () => void; onCancel: () => void }) {
  const t = useT();
  return (
    <RecordPanel
      eyebrow={actionTitle}
      title={t('myAttendance.record.problem.title')}
      mark={
        <span className="icon-tile icon-tile--warning icon-tile--lg" aria-hidden>
          <MapPinOff size={30} />
        </span>
      }
      footer={
        <>
          <Button variant="ghost" size="lg" icon={<ArrowLeft size={20} />} onClick={onCancel}>
            {t('myAttendance.record.problem.back')}
          </Button>
          <Button variant="primary" size="lg" icon={<RefreshCw size={20} />} onClick={onRetry}>
            {t('common.actions.retry')}
          </Button>
        </>
      }
    >
      <p className="muted">{t('myAttendance.record.problem.text')}</p>
    </RecordPanel>
  );
}
