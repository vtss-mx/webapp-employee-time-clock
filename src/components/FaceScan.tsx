import { Camera, Crosshair, Move, ScanFace, ShieldCheck, X, type LucideIcon } from 'lucide-react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { t, useT } from '../i18n';
import { config } from '../utils/config';
import { Button } from './ui/Button';

/**
 * Fases internas del flujo facial (lo que hace el sistema). challenge: un movimiento de la prueba de vida; recenter:
 * entre dos movimientos, la persona vuelve a mirar al frente; flash: el destello dictado por el servidor (restaurado el
 * 2026-10-08 como interruptor del ADMIN, apagado por omisión), entre el fin de la prueba de vida y el envío, pinta un
 * color a toda pantalla por cada captura. Sin destello dictado por el reto, nunca se entra a `flash`.
 */
export type Phase = 'frontal' | 'checking' | 'blocked' | 'challenge' | 'recenter' | 'flash' | 'submitting';

/** Etapas que ve la persona (lo que debe hacer): una barra de progreso por etapa. */
export type ScanStage = 'prepare' | 'align' | 'scan' | 'liveness' | 'confirm';

interface StageInfo {
  /** Nombre de la etapa (lectores de pantalla, en la barra de progreso). */
  name: string;
  title: string;
  text: string;
}

/** Nombre, título e indicación de una etapa en el idioma activo (se piden al dibujarse). */
export function stageInfo(stage: ScanStage): StageInfo {
  return { name: t(`face.stages.${stage}.name`), title: t(`face.stages.${stage}.title`), text: t(`face.stages.${stage}.text`) };
}

const STAGE_ICONS: Record<ScanStage, LucideIcon> = {
  prepare: Camera,
  align: Crosshair,
  scan: ScanFace,
  liveness: Move,
  confirm: ShieldCheck,
};

/** Guías que indican que la persona aún no está frente a la cámara (etapa de preparación); las demás (centrar, mirar
 *  al frente, el rostro cortado o en movimiento) son de la alineación. */
const PREPARING: ReadonlySet<FaceGuidance> = new Set(['loading', 'no_face', 'multiple', 'too_far', 'too_close', 'too_dark', 'too_bright']);

/** Etapas del flujo según la política (sin prueba de vida son cuatro). */
export function scanStages(withLiveness: boolean): ScanStage[] {
  return withLiveness ? ['prepare', 'align', 'scan', 'liveness', 'confirm'] : ['prepare', 'align', 'scan', 'confirm'];
}

/** Etapa visible según la fase del flujo y la guía de detección en vivo. */
export function currentStage(phase: Phase, guidance: FaceGuidance): ScanStage {
  switch (phase) {
    case 'checking':
      return 'scan';
    case 'challenge':
    case 'recenter':
      return 'liveness';
    case 'flash':
    case 'submitting':
      return 'confirm';
    case 'blocked':
      return 'align';
    default:
      return PREPARING.has(guidance) ? 'prepare' : 'align';
  }
}

/** Avance (0..1) dentro de la etapa actual: alimenta su segmento de la barra. `moveProgress`: el del movimiento en curso. */
export function stageFill(stage: ScanStage, input: { progress: number; moveProgress: number; capture?: { current: number; total: number } | null }): number {
  if (stage === 'align') return input.progress;
  if (stage === 'scan') return input.capture ? input.capture.current / input.capture.total : 1;
  if (stage === 'liveness') return input.moveProgress;
  if (stage === 'confirm') return 0.6;
  return 0.35;
}

/**
 * Las mismas etapas que mostrará el escáner (misma lista y mismos textos), para explicarlas antes
 * de empezar: lo que se anuncia al inicio coincide con el "n / N" del escáner.
 */
export function ScanStagesPreview({ stages, after }: { stages: ScanStage[]; after?: ReactNode }) {
  const t = useT();
  return (
    <ol className="timeline stagger" aria-label={t('face.scan.stagesLabel')}>
      {stages.map((stage, i) => {
        const Icon = STAGE_ICONS[stage];
        const info = stageInfo(stage);
        return (
          <li key={stage}>
            <span className="timeline__dot" style={{ background: 'var(--blue-50)', color: 'var(--primary)' }}>
              <Icon size={16} />
            </span>
            <div>
              <strong>
                {i + 1}. {info.title}
              </strong>
              <span className="muted small">{info.text}</span>
            </div>
          </li>
        );
      })}
      {after}
    </ol>
  );
}

/**
 * Barra segmentada: etapas completadas, la actual (con su avance) y las pendientes. Es también el contador de etapas
 * («Etapa 3 de 5» para lectores de pantalla): a la vista no se repite con números (el encabezado queda limpio).
 */
export function ScanProgress({ stages, current, fill }: { stages: ScanStage[]; current: number; fill: number }) {
  const t = useT();
  return (
    <ol className="faceid__progress" aria-label={t('face.scan.counter', { current: current + 1, total: stages.length })}>
      {stages.map((stage, i) => {
        const state = i < current ? 'is-done' : i === current ? 'is-current' : '';
        const style = { '--fill': i < current ? 1 : i === current ? Math.max(0.08, Math.min(1, fill)) : 0 } as CSSProperties;
        return (
          <li key={stage} className={state} style={style} aria-current={i === current ? 'step' : undefined}>
            <span className="sr-only">{t(`face.stages.${stage}.name`)}</span>
          </li>
        );
      })}
    </ol>
  );
}

interface ScanCardProps {
  title: string;
  stages: ScanStage[];
  stage: ScanStage;
  fill: number;
  /**
   * Título e indicación de la etapa (p. ej. la instrucción del reto o el motivo de un bloqueo) y su rótulo corto: en un
   * teléfono solo se ve el rótulo (la indicación grande va bajo el círculo); con la columna lateral, título e indicación.
   */
  intro: { title: string; text: string; label?: string };
  /** Visor de la cámara con sus capas. */
  viewport: ReactNode;
  /** Acciones (otra forma de identificarse, captura manual). */
  actions?: ReactNode;
  onCancel: () => void;
  /** Registro facial: el indicador de los cuatro pasos (`EnrollmentStepper`), dentro de la tarjeta para que siempre se vea. */
  steps?: ReactNode;
  /** Control del encabezado junto a «Cancelar» (el silencio de la guía por voz). */
  headerAction?: ReactNode;
}

/**
 * Encabezado común de la tarjeta del escáner y de la etapa de voz del registro: título, nombre de la app, el indicador de
 * pasos (cuando es un registro) y «Cancelar». Vive una sola vez para que las dos tarjetas se vean y se lean igual.
 * `action`: un control opcional junto a «Cancelar» (el silencio de la guía por voz; solo el escáner lo pasa).
 */
export function ScanHeader({ titleId, title, steps, onCancel, action }: { titleId: string; title: string; steps?: ReactNode; onCancel: () => void; action?: ReactNode }) {
  const t = useT();
  return (
    <header className="faceid__head">
      <div className="faceid__titles">
        <h1 id={titleId}>{title}</h1>
        <p>{config.appName}</p>
        {steps}
      </div>
      <div className="faceid__head-actions">
        {action}
        <Button variant="ghost" iconOnly icon={<X size={20} />} onClick={onCancel} aria-label={t('common.actions.cancel')} title={t('common.actions.cancel')} />
      </div>
    </header>
  );
}

/**
 * Tarjeta del escáner facial (clara, como el área de trabajo): encabezado, barra segmentada de etapas, título de la
 * etapa (con su indicación en la columna lateral del escritorio) y el visor. La indicación grande va bajo el círculo
 * (UNA a la vez); bajo la cámara solo aparecen acciones o avisos cuando hacen falta. En tabletas horizontales y en el
 * escritorio el visor ocupa la columna izquierda.
 */
export function ScanCard({ title, stages, stage, fill, intro, viewport, actions, onCancel, steps, headerAction }: ScanCardProps) {
  const titleId = useId();
  const index = stages.indexOf(stage);
  return (
    <section className={`faceid faceid--${stage}`} aria-labelledby={titleId}>
      <ScanHeader titleId={titleId} title={title} steps={steps} onCancel={onCancel} action={headerAction} />
      <ScanProgress stages={stages} current={index} fill={fill} />
      <div key={`${stage}:${intro.title}`} className="faceid__intro">
        <p className="faceid__eyebrow">{intro.label ?? intro.title}</p>
        <h2>{intro.title}</h2>
        <p>{intro.text}</p>
      </div>
      <div className="faceid__viewport">{viewport}</div>
      {actions && <div className="faceid__actions">{actions}</div>}
    </section>
  );
}
