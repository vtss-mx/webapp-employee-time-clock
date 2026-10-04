import { Aperture, Clock, Crosshair, Gauge, Lock, Palette, QrCode, Repeat, ScanFace, Timer } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import type { VerificationPolicy, VerificationPolicyUpdate } from '../../types';
import type { FieldChange } from '../../types/confirm';
import type { CatalogApi } from '../../utils/catalogs';
import { Select, type SelectOption } from '../ui/Select';

/** Opciones de los ajustes numéricos (dentro de los límites que valida el backend). */
const STEPS = [1, 2, 3];
/** Qué tan difícil de engañar es la prueba de vida con cada número de movimientos. */
const STEP_DESCRIPTIONS: Record<number, string> = {
  1: 'Un movimiento aleatorio (más rápido, menos seguro).',
  2: 'Dos movimientos aleatorios: un video grabado tendría que acertar la secuencia.',
  3: 'Tres movimientos aleatorios: lo más difícil de engañar, también para un video generado.',
};
const movesLabel = (n: number) => (n === 1 ? '1 movimiento' : `${n} movimientos`);
/** Tiempo para responder el reto completo (s, el backend acepta de 20 a 180). */
const CHALLENGE_TIMEOUTS = [20, 30, 45, 60, 90, 120, 180];
const LOCKOUT_FAILURES = [3, 5, 7, 10];
const LOCKOUT_MINUTES = [5, 15, 30, 60, 120];
const QR_LIFETIMES = [15, 30, 60, 120, 300];
/** Calidad mínima de la captura (detección, nitidez y luz combinadas; el backend acepta de 0 a 0.9). */
const QUALITY_LEVELS: Record<number, string> = { 0: 'Sin mínimo', 0.4: 'Básica', 0.55: 'Media', 0.7: 'Alta' };
const qualityLabel = (value: number) => QUALITY_LEVELS[value] ?? `${Math.round(value * 100)} %`;
/** Precisión exigida a la ubicación de la asistencia (m, el backend acepta de 10 a 1000). */
const ACCURACIES = [25, 50, 100, 200, 500, 1000];
/** Velocidad creíble entre dos registros (km/h, el backend acepta de 30 a 1000). */
const SPEEDS = [80, 120, 200, 300, 500, 900];
/** Opciones con el valor vigente aunque no sea de la lista (lo pudo fijar otra versión). */
const withCurrent = (options: number[], current: number) => [...new Set([...options, current])].sort((a, b) => a - b);
/** Opciones numéricas de menor a mayor, cada una con su texto. */
const numbered = (values: number[], label: (value: number) => string): SelectOption[] => values.map((n) => ({ value: String(n), label: label(n) }));

const minutesLabel = (minutes: number) => (minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`);
const secondsLabel = (seconds: number) => (seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`);
/** Exigir el destello sin calibrar puede pedir repetir a personas reales: se advierte al confirmar. */
const ENFORCE_FLASH_WARNING =
  'Hazlo después de calibrar con capturas reales (Seguridad facial › Destello de colores). Con luz del sol directa puede pedir repetir la prueba.';

export type TuningKey =
  | 'anti_spoofing_level'
  | 'liveness_steps'
  | 'liveness_timeout_seconds'
  | 'flash_liveness'
  | 'lockout_max_failures'
  | 'lockout_minutes'
  | 'qr_lifetime_seconds'
  | 'min_capture_quality'
  | 'max_location_accuracy_m'
  | 'max_travel_kmh';

/**
 * Lo que se envía al elegir un valor y el aviso al guardarse (título y qué cambia); `warning`: lo que
 * la confirmación debe advertir antes (p. ej. exigir el destello sin calibrar).
 */
type TuningUpdate = { changes: VerificationPolicyUpdate; title: string; detail: string; warning?: string };

/** Un ajuste elegido: lo que se envía, su aviso y lo que muestra su confirmación. */
export interface TuningSave extends TuningUpdate {
  key: TuningKey;
  /** "Ajuste: antes → después", con los mismos textos de la lista. */
  change: FieldChange;
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
interface Tuning {
  key: TuningKey;
  icon: ReactNode;
  label: string;
  description: string;
  /** Su candado está encendido (apagado, el ajuste no se puede cambiar). */
  enabled: boolean;
  value: string;
  /** De menos a más: un valor numérico mayor o un nivel posterior del catálogo. */
  options: SelectOption[];
  /** Hacia dónde es más estricto: más alto (más giros, bloqueo más largo) o más bajo (menos intentos, menos margen). */
  stricter: 'higher' | 'lower';
  pick: (value: string) => TuningUpdate;
}

/**
 * Los ajustes de los candados con su valor vigente: sensibilidad del anti-spoofing (catálogo),
 * movimientos, tiempo y destello de colores (catálogo flash_modes) de la prueba de vida, calidad mínima
 * de la captura, el bloqueo por intentos fallidos, la vigencia del QR dinámico y la ubicación de la
 * asistencia (precisión exigida y velocidad creíble).
 */
function tuningsOf(policy: VerificationPolicy, { active, byCode, nameOf }: CatalogApi): Tuning[] {
  return [
    {
      key: 'anti_spoofing_level',
      icon: <ScanFace size={20} />,
      label: 'Sensibilidad del anti-spoofing',
      description: byCode('antispoof_levels', policy.anti_spoofing_level)?.description ?? 'Qué tan estricto es al detectar fotos, pantallas y videos.',
      enabled: policy.anti_spoofing,
      value: policy.anti_spoofing_level,
      options: active('antispoof_levels').map((item) => ({ value: item.code, label: item.name, description: item.description ?? undefined })),
      stricter: 'higher',
      pick: (code) => ({ changes: { anti_spoofing_level: code }, title: `Anti-spoofing: nivel ${nameOf('antispoof_levels', code)}`, detail: byCode('antispoof_levels', code)?.description ?? '' }),
    },
    {
      key: 'liveness_steps',
      icon: <Repeat size={20} />,
      label: 'Movimientos de la prueba de vida',
      description: STEP_DESCRIPTIONS[policy.liveness_steps] ?? 'Movimientos de cabeza aleatorios (girar, mirar arriba o abajo, acercarse).',
      enabled: policy.liveness_challenge,
      value: String(policy.liveness_steps),
      options: numbered(withCurrent(STEPS, policy.liveness_steps), movesLabel),
      stricter: 'higher',
      pick: (value) => ({
        changes: { liveness_steps: Number(value) },
        title: 'Prueba de vida actualizada',
        detail: `Se ${Number(value) === 1 ? 'pedirá 1 movimiento' : `pedirán ${value} movimientos`} de cabeza al azar (girar, mirar arriba o abajo, acercarse).`,
      }),
    },
    {
      key: 'liveness_timeout_seconds',
      icon: <Timer size={20} />,
      label: 'Tiempo para la prueba de vida',
      description: 'Para completar el destello y los movimientos de cada reto; si se acaba, se pide otro sin repetir el escaneo. Menos tiempo, menos margen para preparar un engaño.',
      enabled: policy.liveness_challenge,
      value: String(policy.liveness_timeout_seconds),
      options: numbered(withCurrent(CHALLENGE_TIMEOUTS, policy.liveness_timeout_seconds), secondsLabel),
      stricter: 'lower',
      pick: (value) => ({
        changes: { liveness_timeout_seconds: Number(value) },
        title: 'Tiempo de la prueba de vida actualizado',
        detail: `Cada reto vencerá a los ${secondsLabel(Number(value))}.`,
      }),
    },
    {
      key: 'flash_liveness',
      icon: <Palette size={20} />,
      label: 'Destello de colores',
      description: byCode('flash_modes', policy.flash_liveness)?.description ?? 'La pantalla destella colores y el rostro real debe reflejarlos.',
      enabled: policy.liveness_challenge,
      value: policy.flash_liveness,
      options: active('flash_modes').map((item) => ({ value: item.code, label: item.name, description: item.description ?? undefined })),
      stricter: 'higher',
      pick: (code) => ({
        changes: { flash_liveness: code },
        title: `Destello de colores: ${nameOf('flash_modes', code)}`,
        detail: byCode('flash_modes', code)?.description ?? '',
        warning: code === 'ENFORCE' ? ENFORCE_FLASH_WARNING : undefined,
      }),
    },
    {
      key: 'min_capture_quality',
      icon: <Aperture size={20} />,
      label: 'Calidad mínima de la captura',
      description: 'Una foto pobre (poca luz, desenfocada, rostro poco claro) compara mal y facilita los engaños. Más alta: más reintentos con mala luz.',
      enabled: true,
      value: String(policy.min_capture_quality),
      options: numbered(withCurrent(Object.keys(QUALITY_LEVELS).map(Number), policy.min_capture_quality), qualityLabel),
      stricter: 'higher',
      pick: (value) => ({
        changes: { min_capture_quality: Number(value) },
        title: 'Calidad mínima actualizada',
        detail: Number(value) ? `Se rechazarán las capturas con calidad menor a «${qualityLabel(Number(value))}».` : 'Se acepta cualquier captura que pase los controles básicos.',
      }),
    },
    {
      key: 'lockout_max_failures',
      icon: <Lock size={20} />,
      label: 'Intentos antes del bloqueo',
      description: 'Intentos fallidos o sospechosos seguidos que bloquean temporalmente la verificación facial.',
      enabled: policy.lockout_enabled,
      value: String(policy.lockout_max_failures),
      options: numbered(withCurrent(LOCKOUT_FAILURES, policy.lockout_max_failures), (n) => `${n} intentos`),
      stricter: 'lower',
      pick: (value) => ({ changes: { lockout_max_failures: Number(value) }, title: 'Bloqueo actualizado', detail: `Se bloqueará tras ${value} intentos fallidos seguidos.` }),
    },
    {
      key: 'lockout_minutes',
      icon: <Clock size={20} />,
      label: 'Duración del bloqueo',
      description: 'Tiempo que debe esperar la persona (o el validador) antes de volver a intentarlo.',
      enabled: policy.lockout_enabled,
      value: String(policy.lockout_minutes),
      options: numbered(withCurrent(LOCKOUT_MINUTES, policy.lockout_minutes), minutesLabel),
      stricter: 'higher',
      pick: (value) => ({ changes: { lockout_minutes: Number(value) }, title: 'Bloqueo actualizado', detail: `El bloqueo durará ${minutesLabel(Number(value))}.` }),
    },
    {
      key: 'qr_lifetime_seconds',
      icon: <QrCode size={20} />,
      label: 'Vigencia del código QR',
      description: 'Cada QR del empleado se renueva solo al cumplir este tiempo y sirve una sola vez. Menos tiempo, más seguro.',
      enabled: policy.qr_enabled,
      value: String(policy.qr_lifetime_seconds),
      options: numbered(withCurrent(QR_LIFETIMES, policy.qr_lifetime_seconds), secondsLabel),
      stricter: 'lower',
      pick: (value) => ({
        changes: { qr_lifetime_seconds: Number(value) },
        title: 'Vigencia del QR actualizada',
        detail: `Cada código QR durará ${secondsLabel(Number(value))} y servirá una sola vez.`,
      }),
    },
    {
      key: 'max_location_accuracy_m',
      icon: <Crosshair size={20} />,
      label: 'Precisión de la ubicación',
      description: 'Margen máximo que puede informar el teléfono al registrar asistencia. Más estricto: menos engaños, pero puede pedir activar la ubicación precisa.',
      enabled: true,
      value: String(policy.max_location_accuracy_m),
      options: numbered(withCurrent(ACCURACIES, policy.max_location_accuracy_m), (n) => `Hasta ${n} m`),
      stricter: 'lower',
      pick: (value) => ({
        changes: { max_location_accuracy_m: Number(value) },
        title: 'Precisión actualizada',
        detail: `Se pedirá repetir el registro si la ubicación tiene un margen mayor a ${value} m.`,
      }),
    },
    {
      key: 'max_travel_kmh',
      icon: <Gauge size={20} />,
      label: 'Velocidad máxima creíble',
      description: 'Entre dos registros seguidos. Una distancia que exige ir más rápido se rechaza como viaje imposible.',
      enabled: policy.detect_impossible_travel,
      value: String(policy.max_travel_kmh),
      options: numbered(withCurrent(SPEEDS, policy.max_travel_kmh), (n) => `${n} km/h`),
      stricter: 'lower',
      pick: (value) => ({
        changes: { max_travel_kmh: Number(value) },
        title: 'Velocidad actualizada',
        detail: `Se rechazarán registros que exijan viajar a más de ${value} km/h desde el anterior.`,
      }),
    },
  ];
}

/**
 * Lo elegido en un ajuste: su "antes → después" (con los textos de la lista; un valor vigente que ya
 * no está en ella se muestra tal cual) y si protege menos que el vigente.
 */
function saveOf(tuning: Tuning, value: string): TuningSave {
  const position = (option: string) => tuning.options.findIndex((o) => o.value === option);
  const labelOf = (option: string) => tuning.options.find((o) => o.value === option)?.label ?? option;
  const [from, to] = [position(tuning.value), position(value)];
  return {
    key: tuning.key,
    ...tuning.pick(value),
    change: { label: tuning.label, before: labelOf(tuning.value), after: labelOf(value) },
    relaxes: from >= 0 && (tuning.stricter === 'higher' ? to < from : to > from),
  };
}

function TuningRow({ tuning, saving, onSave }: { tuning: Tuning } & Omit<PolicyTuningProps, 'policy'>) {
  const labelId = useId();
  return (
    <div className="tuning-row">
      <span className="switch-row__icon">{tuning.icon}</span>
      <span className="switch-row__text">
        <span className="switch-row__label" id={labelId}>
          {tuning.label}
        </span>
        <span className="switch-row__description">{tuning.description}</span>
      </span>
      <span className="tuning-row__control">
        <Select
          aria-labelledby={labelId}
          value={tuning.value}
          disabled={!tuning.enabled || saving === tuning.key}
          options={tuning.options}
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
  const catalogs = useCatalogs();
  return (
    <div className="stack">
      {tuningsOf(policy, catalogs).map((tuning) => (
        <TuningRow key={tuning.key} tuning={tuning} saving={saving} onSave={onSave} />
      ))}
    </div>
  );
}
