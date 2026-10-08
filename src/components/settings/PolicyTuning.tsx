import { Aperture, Clock, Crosshair, Gauge, Lock, Palette, QrCode, Repeat, ScanFace, Timer } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { t, useT } from '../../i18n';
import type { AdminPolicyUpdate, VerificationPolicy } from '../../types';
import type { FieldChange } from '../../types/confirm';
import type { CatalogApi } from '../../utils/catalogs';
import { formatMinutes } from '../../utils/format';
import { formatDistance, formatNumber, formatRate } from '../../utils/numbers';
import { Select, type SelectOption } from '../ui/Select';

/** Opciones de los ajustes numéricos (dentro de los límites que valida el backend). */
const STEPS = [1, 2, 3];
/** Qué tan difícil de engañar es la prueba de vida con cada número de movimientos. */
const STEP_DESCRIPTIONS: Partial<Record<number, 'one' | 'two' | 'three'>> = { 1: 'one', 2: 'two', 3: 'three' };
const movesLabel = (n: number) => t('policy.tuning.steps.option', { count: n });
/** Tiempo para responder el reto completo (s, el backend acepta de 20 a 180). */
const CHALLENGE_TIMEOUTS = [20, 30, 45, 60, 90, 120, 180];
const LOCKOUT_FAILURES = [3, 5, 7, 10];
const LOCKOUT_MINUTES = [5, 15, 30, 60, 120];
const QR_LIFETIMES = [15, 30, 60, 120, 300];
/** Calidad mínima de la captura (detección, nitidez y luz combinadas; el backend acepta de 0 a 0.9). */
const QUALITY_LEVELS: Partial<Record<number, 'none' | 'basic' | 'medium' | 'high'>> = { 0: 'none', 0.4: 'basic', 0.55: 'medium', 0.7: 'high' };
const qualityLabel = (value: number) => {
  const level = QUALITY_LEVELS[value];
  return level ? t(`policy.tuning.quality.${level}`) : formatRate(Math.round(value * 100));
};
/** Precisión exigida a la ubicación de la asistencia (m, el backend acepta de 10 a 1000). */
const ACCURACIES = [25, 50, 100, 200, 500, 1000];
/** Velocidad creíble entre dos registros (km/h, el backend acepta de 30 a 1000). */
const SPEEDS = [80, 120, 200, 300, 500, 900];
/** Opciones con el valor vigente aunque no sea de la lista (lo pudo fijar otra versión). */
export const withCurrent = (options: number[], current: number) => [...new Set([...options, current])].sort((a, b) => a - b);
/** Opciones numéricas de menor a mayor, cada una con su texto (en el idioma activo). */
export const numbered = (values: number[], label: (value: number) => string): SelectOption[] => values.map((n) => ({ value: String(n), label: label(n) }));

const secondsLabel = (seconds: number) => (seconds >= 60 && seconds % 60 === 0 ? formatMinutes(seconds / 60) : `${formatNumber(seconds)} s`);
const accuracyLabel = (meters: number) => t('policy.tuning.accuracy.option', { distance: formatDistance(meters) });
const speedLabel = (kmh: number) => `${formatNumber(kmh)} km/h`;

/**
 * El campo de la política que cambia un ajuste (`anti_spoofing_level`, `risk_high_score`...) o el de una señal del
 * motor de riesgo (`risk_signals.<código>.mode|points`): su control queda ocupado mientras se guarda.
 */
export type TuningKey = string;

/**
 * Lo que se envía al elegir un valor y el aviso al guardarse (título y qué cambia); `warning`: lo que la confirmación
 * debe advertir antes (p. ej. exigir una prueba de presencia: qué preparar). Los textos son funciones: se traducen al
 * dibujarse, así la confirmación y el aviso abiertos siguen al idioma activo.
 */
export type TuningUpdate = { changes: AdminPolicyUpdate; title: () => string; detail: () => string; warning?: () => string };

/** Un ajuste elegido: lo que se envía, su aviso y lo que muestra su confirmación. */
export interface TuningSave extends TuningUpdate {
  key: TuningKey;
  /** "Ajuste: antes → después", con los mismos textos de la lista. */
  change: () => FieldChange;
  /** El valor nuevo protege menos que el vigente (la confirmación lo advierte en rojo). */
  relaxes: boolean;
}

interface PolicyTuningProps {
  policy: VerificationPolicy;
  /** Ajuste que se está guardando (su control queda deshabilitado). */
  saving: string | null;
  /** Se eligió otro valor: quien guarda pregunta antes de enviarlo. */
  onSave: (save: TuningSave) => void;
}

/** Un ajuste de la lista: su control, sus opciones y qué se envía al elegir una. */
export interface Tuning {
  key: TuningKey;
  icon: ReactNode;
  /** Textos en el idioma activo (funciones: la confirmación de un valor elegido los vuelve a pedir). */
  label: () => string;
  description: string;
  /** Su candado está encendido (apagado, el ajuste no se puede cambiar). */
  enabled: boolean;
  value: string;
  /** De menos a más: un valor numérico mayor o un nivel posterior del catálogo. */
  options: () => SelectOption[];
  /** Hacia dónde es más estricto: más alto (más giros, bloqueo más largo) o más bajo (menos intentos, menos margen). */
  stricter: 'higher' | 'lower';
  pick: (value: string) => TuningUpdate;
}

/** Opciones de un catálogo (nivel del anti-spoofing, modo del destello) con su nombre y descripción del backend. */
export const catalogOptions = (items: ReadonlyArray<{ code: string; name: string; description?: string | null }>) => () =>
  items.map((item) => ({ value: item.code, label: item.name, description: item.description ?? undefined }));

/**
 * Los ajustes de los candados con su valor vigente: sensibilidad del anti-spoofing (catálogo),
 * movimientos, tiempo y destello de colores (catálogo flash_modes) de la prueba de vida, calidad mínima
 * de la captura, el bloqueo por intentos fallidos, la vigencia del QR dinámico y la ubicación de la
 * asistencia (precisión exigida y velocidad creíble).
 */
function tuningsOf(policy: VerificationPolicy, { active, byCode, nameOf }: CatalogApi): Tuning[] {
  const steps = STEP_DESCRIPTIONS[policy.liveness_steps];
  return [
    {
      key: 'anti_spoofing_level',
      icon: <ScanFace size={20} />,
      label: () => t('policy.tuning.antiSpoofing.label'),
      description: byCode('antispoof_levels', policy.anti_spoofing_level)?.description ?? t('policy.tuning.antiSpoofing.description'),
      enabled: policy.anti_spoofing,
      value: policy.anti_spoofing_level,
      options: catalogOptions(active('antispoof_levels')),
      stricter: 'higher',
      pick: (code) => ({
        changes: { anti_spoofing_level: code },
        title: () => t('policy.tuning.antiSpoofing.saved', { level: nameOf('antispoof_levels', code) }),
        detail: () => byCode('antispoof_levels', code)?.description ?? '',
      }),
    },
    {
      key: 'liveness_steps',
      icon: <Repeat size={20} />,
      label: () => t('policy.tuning.steps.label'),
      description: steps ? t(`policy.tuning.steps.${steps}`) : t('policy.tuning.steps.description'),
      enabled: policy.liveness_challenge,
      value: String(policy.liveness_steps),
      options: () => numbered(withCurrent(STEPS, policy.liveness_steps), movesLabel),
      stricter: 'higher',
      pick: (value) => ({
        changes: { liveness_steps: Number(value) },
        title: () => t('policy.tuning.steps.saved'),
        detail: () => t('policy.tuning.steps.savedText', { count: Number(value) }),
      }),
    },
    {
      key: 'liveness_timeout_seconds',
      icon: <Timer size={20} />,
      label: () => t('policy.tuning.timeout.label'),
      description: t('policy.tuning.timeout.description'),
      enabled: policy.liveness_challenge,
      value: String(policy.liveness_timeout_seconds),
      options: () => numbered(withCurrent(CHALLENGE_TIMEOUTS, policy.liveness_timeout_seconds), secondsLabel),
      stricter: 'lower',
      pick: (value) => ({
        changes: { liveness_timeout_seconds: Number(value) },
        title: () => t('policy.tuning.timeout.saved'),
        detail: () => t('policy.tuning.timeout.savedText', { time: secondsLabel(Number(value)) }),
      }),
    },
    {
      key: 'min_capture_quality',
      icon: <Aperture size={20} />,
      label: () => t('policy.tuning.quality.label'),
      description: t('policy.tuning.quality.description'),
      enabled: true,
      value: String(policy.min_capture_quality),
      options: () => numbered(withCurrent(Object.keys(QUALITY_LEVELS).map(Number), policy.min_capture_quality), qualityLabel),
      stricter: 'higher',
      pick: (value) => ({
        changes: { min_capture_quality: Number(value) },
        title: () => t('policy.tuning.quality.saved'),
        detail: () => (Number(value) ? t('policy.tuning.quality.savedText', { level: qualityLabel(Number(value)) }) : t('policy.tuning.quality.savedAny')),
      }),
    },
    {
      key: 'lockout_max_failures',
      icon: <Lock size={20} />,
      label: () => t('policy.tuning.lockoutFailures.label'),
      description: t('policy.tuning.lockoutFailures.description'),
      enabled: policy.lockout_enabled,
      value: String(policy.lockout_max_failures),
      options: () => numbered(withCurrent(LOCKOUT_FAILURES, policy.lockout_max_failures), (n) => t('policy.tuning.lockoutFailures.option', { count: n })),
      stricter: 'lower',
      pick: (value) => ({
        changes: { lockout_max_failures: Number(value) },
        title: () => t('policy.tuning.lockoutSaved'),
        detail: () => t('policy.tuning.lockoutFailures.savedText', { count: Number(value) }),
      }),
    },
    {
      key: 'lockout_minutes',
      icon: <Clock size={20} />,
      label: () => t('policy.tuning.lockoutMinutes.label'),
      description: t('policy.tuning.lockoutMinutes.description'),
      enabled: policy.lockout_enabled,
      value: String(policy.lockout_minutes),
      options: () => numbered(withCurrent(LOCKOUT_MINUTES, policy.lockout_minutes), formatMinutes),
      stricter: 'higher',
      pick: (value) => ({
        changes: { lockout_minutes: Number(value) },
        title: () => t('policy.tuning.lockoutSaved'),
        detail: () => t('policy.tuning.lockoutMinutes.savedText', { time: formatMinutes(Number(value)) }),
      }),
    },
    {
      key: 'qr_lifetime_seconds',
      icon: <QrCode size={20} />,
      label: () => t('policy.tuning.qrLifetime.label'),
      description: t('policy.tuning.qrLifetime.description'),
      enabled: policy.qr_enabled,
      value: String(policy.qr_lifetime_seconds),
      options: () => numbered(withCurrent(QR_LIFETIMES, policy.qr_lifetime_seconds), secondsLabel),
      stricter: 'lower',
      pick: (value) => ({
        changes: { qr_lifetime_seconds: Number(value) },
        title: () => t('policy.tuning.qrLifetime.saved'),
        detail: () => t('policy.tuning.qrLifetime.savedText', { time: secondsLabel(Number(value)) }),
      }),
    },
    {
      key: 'max_location_accuracy_m',
      icon: <Crosshair size={20} />,
      label: () => t('policy.tuning.accuracy.label'),
      description: t('policy.tuning.accuracy.description'),
      enabled: true,
      value: String(policy.max_location_accuracy_m),
      options: () => numbered(withCurrent(ACCURACIES, policy.max_location_accuracy_m), accuracyLabel),
      stricter: 'lower',
      pick: (value) => ({
        changes: { max_location_accuracy_m: Number(value) },
        title: () => t('policy.tuning.accuracy.saved'),
        detail: () => t('policy.tuning.accuracy.savedText', { distance: formatDistance(Number(value)) }),
      }),
    },
    {
      key: 'max_travel_kmh',
      icon: <Gauge size={20} />,
      label: () => t('policy.tuning.speed.label'),
      description: t('policy.tuning.speed.description'),
      enabled: policy.detect_impossible_travel,
      value: String(policy.max_travel_kmh),
      options: () => numbered(withCurrent(SPEEDS, policy.max_travel_kmh), speedLabel),
      stricter: 'lower',
      pick: (value) => ({
        changes: { max_travel_kmh: Number(value) },
        title: () => t('policy.tuning.speed.saved'),
        detail: () => t('policy.tuning.speed.savedText', { speed: speedLabel(Number(value)) }),
      }),
    },
  ];
}

/**
 * Lo elegido en un ajuste: su "antes → después" (con los textos de la lista, pedidos al dibujarse; un
 * valor vigente que ya no está en ella se muestra tal cual) y si protege menos que el vigente.
 */
export function saveOf(tuning: Tuning, value: string): TuningSave {
  const options = tuning.options();
  const position = (option: string) => options.findIndex((o) => o.value === option);
  const labelOf = (option: string) => tuning.options().find((o) => o.value === option)?.label ?? option;
  const [from, to] = [position(tuning.value), position(value)];
  return {
    key: tuning.key,
    ...tuning.pick(value),
    change: () => ({ label: tuning.label(), before: labelOf(tuning.value), after: labelOf(value) }),
    relaxes: from >= 0 && (tuning.stricter === 'higher' ? to < from : to > from),
  };
}

/** Un ajuste con su ícono, su nombre, qué hace y su lista de valores (elegir uno pide confirmarlo). */
export function TuningRow({ tuning, saving, onSave }: { tuning: Tuning } & Omit<PolicyTuningProps, 'policy'>) {
  const labelId = useId();
  return (
    <div className="tuning-row">
      <span className="switch-row__icon">{tuning.icon}</span>
      <span className="switch-row__text">
        <span className="switch-row__label" id={labelId}>
          {tuning.label()}
        </span>
        <span className="switch-row__description">{tuning.description}</span>
      </span>
      <span className="tuning-row__control">
        <Select
          aria-labelledby={labelId}
          value={tuning.value}
          disabled={!tuning.enabled || saving === tuning.key}
          options={tuning.options()}
          onChange={(value) => onSave(saveOf(tuning, value))}
        />
      </span>
    </div>
  );
}

/**
 * Ajustes de los candados. Cada control se deshabilita si su candado está apagado. Elegir un valor
 * no guarda nada todavía: `onSave` recibe qué cambia ("antes → después") para confirmarlo primero.
 */
export function PolicyTuning({ policy, saving, onSave }: PolicyTuningProps) {
  const t = useT(); // redibuja los ajustes al cambiar el idioma
  const catalogs = useCatalogs();
  return (
    <div className="stack">
      {tuningsOf(policy, catalogs).map((tuning) => (
        <TuningRow key={tuning.key} tuning={tuning} saving={saving} onSave={onSave} />
      ))}
      <RetiredRow icon={<Palette size={20} />} label={t('policy.tuning.flash.label')} note={t('policy.tuning.flash.retired')} value={catalogs.nameOf('flash_modes', policy.flash_liveness)} />
    </div>
  );
}

/**
 * Un ajuste RETIRADO por decisión del dueño del producto (2026-10-06, el destello de colores): se muestra con su valor
 * fijo y la nota, sin control (nadie lo cambia desde la app; el servidor lo deja apagado en toda empresa).
 */
export function RetiredRow({ icon, label, note, value }: { icon: ReactNode; label: string; note: string; value: string }) {
  return (
    <div className="tuning-row tuning-row--retired">
      <span className="switch-row__icon">{icon}</span>
      <span className="switch-row__text">
        <span className="switch-row__label">{label}</span>
        <span className="switch-row__description">{note}</span>
      </span>
      <span className="tuning-row__control">
        <span className="badge">{value}</span>
      </span>
    </div>
  );
}
