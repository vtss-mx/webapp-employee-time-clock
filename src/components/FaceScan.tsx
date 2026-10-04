import { Camera, Crosshair, Move, ScanFace, ShieldCheck, X, type LucideIcon } from 'lucide-react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { config } from '../utils/config';
import { Button } from './ui/Button';

/**
 * Fases internas del flujo facial (lo que hace el sistema). flash: la pantalla destella los colores
 * del reto; challenge: un movimiento de la prueba de vida; recenter: entre dos movimientos, la
 * persona vuelve a mirar al frente.
 */
export type Phase = 'frontal' | 'checking' | 'blocked' | 'flash' | 'challenge' | 'recenter' | 'submitting';

/** Etapas que ve la persona (lo que debe hacer): una barra de progreso por etapa. */
export type ScanStage = 'prepare' | 'align' | 'scan' | 'liveness' | 'confirm';

interface StageInfo {
  /** Nombre de la etapa (lectores de pantalla, en la barra de progreso). */
  name: string;
  title: string;
  text: string;
}

export const STAGE_INFO: Record<ScanStage, StageInfo> = {
  prepare: {
    name: 'Preparación',
    title: 'Mira hacia la cámara',
    text: 'Mantén el rostro visible con buena iluminación.',
  },
  align: {
    name: 'Alineación',
    title: 'Centra tu rostro',
    text: 'Colócalo dentro del óvalo y mira al frente.',
  },
  scan: {
    name: 'Escaneo',
    title: 'Mantente quieto',
    text: 'Mira al frente mientras se completa el escaneo.',
  },
  liveness: {
    name: 'Prueba de vida',
    title: 'Sigue la indicación',
    text: 'Mueve la cabeza como se indique; la pantalla puede cambiar de color un instante.',
  },
  confirm: {
    name: 'Confirmación',
    title: 'Confirmando tu identidad',
    text: 'Espera esta confirmación antes de continuar.',
  },
};

const STAGE_ICONS: Record<ScanStage, LucideIcon> = {
  prepare: Camera,
  align: Crosshair,
  scan: ScanFace,
  liveness: Move,
  confirm: ShieldCheck,
};

/** Guías que indican que la persona aún no está frente a la cámara (etapa de preparación). */
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
    case 'flash':
    case 'challenge':
    case 'recenter':
      return 'liveness';
    case 'submitting':
      return 'confirm';
    case 'blocked':
      return 'align';
    default:
      return PREPARING.has(guidance) ? 'prepare' : 'align';
  }
}

/** Avance (0..1) dentro de la etapa actual: alimenta su segmento de la barra. */
/** `moveProgress`: avance del movimiento en curso (o de los colores, durante el destello). */
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
  return (
    <ol className="timeline stagger" aria-label="Etapas del escaneo">
      {stages.map((stage, i) => {
        const Icon = STAGE_ICONS[stage];
        const info = STAGE_INFO[stage];
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

/** Barra segmentada: etapas completadas, la actual (con su avance) y las pendientes. */
export function ScanProgress({ stages, current, fill }: { stages: ScanStage[]; current: number; fill: number }) {
  return (
    <ol className="faceid__progress" aria-label="Progreso">
      {stages.map((stage, i) => {
        const state = i < current ? 'is-done' : i === current ? 'is-current' : '';
        const style = { '--fill': i < current ? 1 : i === current ? Math.max(0.08, Math.min(1, fill)) : 0 } as CSSProperties;
        return (
          <li key={stage} className={state} style={style} aria-current={i === current ? 'step' : undefined}>
            <span className="sr-only">{STAGE_INFO[stage].name}</span>
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
  /** Título e indicación de la etapa (p. ej. la instrucción del reto o el motivo de un bloqueo). */
  intro: { title: string; text: string };
  /** Visor de la cámara con sus capas. */
  viewport: ReactNode;
  /** Solo lo que aparece cuando hace falta (p. ej. enviar el registro a revisión por accesorios). */
  extras?: ReactNode;
  /** Acciones (otra forma de identificarse, captura manual). */
  actions?: ReactNode;
  onCancel: () => void;
}

/**
 * Tarjeta del escáner facial: encabezado con el número de etapa, barra segmentada, título e
 * indicación de la etapa y el visor. Bajo la cámara no hay textos fijos (las instrucciones se dan
 * al inicio y en la propia cámara): solo acciones o avisos cuando hacen falta. En tabletas
 * horizontales el visor ocupa la columna izquierda.
 */
export function ScanCard({ title, stages, stage, fill, intro, viewport, extras, actions, onCancel }: ScanCardProps) {
  const titleId = useId();
  const index = stages.indexOf(stage);
  return (
    <section className={`faceid faceid--${stage}`} aria-labelledby={titleId}>
      <header className="faceid__head">
        <div className="faceid__titles">
          <h1 id={titleId}>{title}</h1>
          <p>{config.appName}</p>
        </div>
        <span className="faceid__counter" aria-label={`Etapa ${index + 1} de ${stages.length}`}>
          {index + 1} / {stages.length}
        </span>
        <Button variant="ghost" iconOnly icon={<X size={20} />} onClick={onCancel} aria-label="Cancelar" title="Cancelar" />
      </header>
      <ScanProgress stages={stages} current={index} fill={fill} />
      <div key={`${stage}:${intro.title}`} className="faceid__intro">
        <h2>{intro.title}</h2>
        <p>{intro.text}</p>
      </div>
      <div className="faceid__viewport">{viewport}</div>
      {actions && <div className="faceid__actions">{actions}</div>}
      {extras && <div className="faceid__extras">{extras}</div>}
    </section>
  );
}
