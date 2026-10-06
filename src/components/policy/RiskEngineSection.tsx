import { Activity, Fingerprint, Gauge, LifeBuoy, ShieldAlert, Smartphone, Users } from 'lucide-react';
import { useId } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { t, useT } from '../../i18n';
import type { AdminVerificationPolicy, RiskSignalSetting } from '../../types';
import type { CatalogApi } from '../../utils/catalogs';
import { formatConfidence } from '../../utils/format';
import { formatCount, formatNumber } from '../../utils/numbers';
import { catalogOptions, numbered, saveOf, TuningRow, withCurrent, type Tuning, type TuningSave } from '../settings/PolicyTuning';
import { Select } from '../ui/Select';

/** Cortes del puntaje (0-100) que se ofrecen; el vigente se agrega si no está. */
const SCORES = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
/** Puntos de una señal (el backend acepta de 0 a 100). */
const POINTS = [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];
/** Si el motor falla solo se puede permitir, avisar o pedir un paso más (nunca negar a ciegas). */
const FALLBACKS = new Set(['ALLOW', 'ALERT', 'STEP_UP']);

type Tier = 'medium' | 'high' | 'critical';
const TIERS: Tier[] = ['medium', 'high', 'critical'];

const pointsLabel = (points: number) => t('policy.risk.points', { points: formatNumber(points) });

interface RiskEngineSectionProps {
  policy: AdminVerificationPolicy;
  /** Ajuste que se está guardando (su control queda deshabilitado). */
  saving: string | null;
  /** Se eligió otro valor: quien guarda pregunta antes de enviarlo (con su "antes → después"). */
  onSave: (save: TuningSave) => void;
}

/**
 * Corte de un nivel: solo los valores que respetan el orden medio < alto < crítico (el backend lo vuelve a
 * exigir con 422 `RISK_SCORES_ORDER`). Más bajo es más estricto: más intentos llegan a ese nivel.
 */
function scoreTuning(policy: AdminVerificationPolicy, tier: Tier): Tuning {
  const key = `risk_${tier}_score` as const;
  const [low, high] = { medium: [0, policy.risk_high_score], high: [policy.risk_medium_score, policy.risk_critical_score], critical: [policy.risk_high_score, 101] }[tier];
  const value = policy[key];
  return {
    key,
    icon: <Gauge size={20} />,
    label: () => t(`policy.risk.fields.${tier}Score`),
    description: t(`policy.risk.scores.${tier}`),
    enabled: policy.risk_engine,
    value: String(value),
    options: () => numbered(withCurrent(SCORES.filter((n) => n > low && n < high), value), pointsLabel),
    stricter: 'lower',
    pick: (picked) => ({
      changes: { [key]: Number(picked) },
      title: () => t('policy.risk.scores.saved'),
      detail: () => t('policy.risk.scores.savedText', { tier: t(`policy.risk.fields.${tier}Score`), points: pointsLabel(Number(picked)) }),
    }),
  };
}

/** Qué se hace en cada nivel (catálogo `risk_actions`, de menos a más estricto). */
function actionTuning(policy: AdminVerificationPolicy, tier: Tier, { active, byCode, nameOf }: CatalogApi): Tuning {
  const key = `risk_${tier}_action` as const;
  return {
    key,
    icon: <ShieldAlert size={20} />,
    label: () => t(`policy.risk.fields.${tier}Action`),
    description: byCode('risk_actions', policy[key])?.description ?? t('policy.risk.actions.description'),
    enabled: policy.risk_engine,
    value: policy[key],
    options: catalogOptions(active('risk_actions')),
    stricter: 'higher',
    pick: (code) => ({
      changes: { [key]: code },
      title: () => t('policy.risk.actions.saved'),
      detail: () => t('policy.risk.actions.savedText', { tier: t(`policy.risk.fields.${tier}Action`), action: nameOf('risk_actions', code) }),
    }),
  };
}

/** Los ajustes del motor y del antifraude, cada uno con su lista de valores y su texto. */
function riskTunings(policy: AdminVerificationPolicy, catalogs: CatalogApi): Tuning[] {
  const { active, byCode, nameOf } = catalogs;
  return [
    ...TIERS.map((tier) => scoreTuning(policy, tier)),
    ...TIERS.map((tier) => actionTuning(policy, tier, catalogs)),
    {
      key: 'risk_fallback_action',
      icon: <LifeBuoy size={20} />,
      label: () => t('policy.risk.fields.fallbackAction'),
      description: t('policy.risk.fallback.description'),
      enabled: policy.risk_engine,
      value: policy.risk_fallback_action,
      options: catalogOptions(active('risk_actions').filter((action) => FALLBACKS.has(action.code))),
      stricter: 'higher',
      pick: (code) => ({
        changes: { risk_fallback_action: code },
        title: () => t('policy.risk.fallback.saved'),
        detail: () => t('policy.risk.fallback.savedText', { action: nameOf('risk_actions', code) }),
      }),
    },
    {
      key: 'duplicate_confidence',
      icon: <Users size={20} />,
      label: () => t('policy.risk.fields.duplicateConfidence'),
      description: t('policy.risk.duplicate.description'),
      enabled: policy.detect_duplicate_faces,
      value: String(policy.duplicate_confidence),
      options: () => active('confidence_levels').map((level) => ({ value: String(level.value), label: formatConfidence(level.value), description: level.name })),
      // Una sospecha más baja marca más registros para revisión (más estricto).
      stricter: 'lower',
      pick: (value) => ({
        changes: { duplicate_confidence: Number(value) },
        title: () => t('policy.risk.duplicate.saved'),
        detail: () => t('policy.risk.duplicate.savedText', { value: formatConfidence(Number(value)) }),
      }),
    },
    {
      key: 'employee_device_mode',
      icon: <Smartphone size={20} />,
      label: () => t('policy.risk.fields.deviceMode'),
      description: byCode('employee_device_modes', policy.employee_device_mode)?.description ?? t('policy.risk.device.description'),
      enabled: true,
      value: policy.employee_device_mode,
      options: catalogOptions(active('employee_device_modes')),
      stricter: 'higher',
      pick: (code) => ({
        changes: { employee_device_mode: code },
        title: () => t('policy.risk.device.saved'),
        detail: () => t('policy.risk.device.savedText', { mode: nameOf('employee_device_modes', code) }),
      }),
    },
  ];
}

/** El modo y los puntos de una señal: cada uno se elige de su lista y se confirma antes de guardarse. */
function signalTunings(signal: RiskSignalSetting, enabled: boolean, { active, nameOf }: CatalogApi): [Tuning, Tuning] {
  const prefix = `risk_signals.${signal.code}`;
  return [
    {
      key: `${prefix}.mode`,
      icon: null,
      label: () => t('policy.risk.signals.modeOf', { signal: signal.name }),
      description: '',
      enabled,
      value: signal.mode,
      // Una señal que solo se mide (el pulso por video, hasta calibrarlo) no se puede exigir: el backend lo rechaza.
      options: catalogOptions(active('signal_modes').filter((mode) => !signal.measure_only || mode.code !== 'ENFORCE')),
      stricter: 'higher',
      pick: (mode) => ({
        changes: { risk_signals: { [signal.code]: { mode } } },
        title: () => t('policy.risk.signals.saved', { signal: signal.name }),
        detail: () => t('policy.risk.signals.savedMode', { mode: nameOf('signal_modes', mode) }),
      }),
    },
    {
      key: `${prefix}.points`,
      icon: null,
      label: () => t('policy.risk.signals.pointsOf', { signal: signal.name }),
      description: '',
      enabled,
      value: String(signal.points),
      options: () => numbered(withCurrent(POINTS, signal.points), pointsLabel),
      stricter: 'higher',
      pick: (points) => ({
        changes: { risk_signals: { [signal.code]: { points: Number(points) } } },
        title: () => t('policy.risk.signals.saved', { signal: signal.name }),
        detail: () => t('policy.risk.signals.savedPoints', { points: pointsLabel(Number(points)) }),
      }),
    },
  ];
}

/** Una señal: qué mide, su familia, si es dura o la informa el dispositivo, su línea base y sus dos ajustes. */
function SignalRow({ signal, enabled, saving, onSave }: { signal: RiskSignalSetting; enabled: boolean } & Omit<RiskEngineSectionProps, 'policy'>) {
  const t = useT();
  const catalogs = useCatalogs();
  const labelId = useId();
  const [mode, points] = signalTunings(signal, enabled, catalogs);
  const platform = t('policy.risk.signals.platform', { mode: catalogs.nameOf('signal_modes', signal.default_mode), points: pointsLabel(signal.default_points) });
  return (
    <li className="signal-row">
      <span className="signal-row__text">
        <strong id={labelId}>{signal.name}</strong>
        {signal.description && <span className="small muted">{signal.description}</span>}
        <span className="signal-row__tags">
          <span className="badge badge--muted">{catalogs.nameOf('fraud_kinds', signal.kind)}</span>
          {signal.hard && <span className="badge badge--danger">{t('policy.risk.signals.hard')}</span>}
          {signal.client && <span className="badge badge--info">{t('policy.risk.signals.client')}</span>}
          {signal.measure_only && <span className="badge badge--warning">{t('policy.risk.signals.measureOnly')}</span>}
        </span>
        <span className="small muted">
          {platform} · {t('policy.risk.signals.baseline', { confirmed: formatCount(signal.confirmed), falsePositive: formatCount(signal.false_positive) })}
        </span>
      </span>
      <span className="signal-row__controls">
        {[mode, points].map((tuning) => (
          <Select
            key={tuning.key}
            aria-label={tuning.label()}
            size="sm"
            value={tuning.value}
            disabled={!enabled || saving === tuning.key}
            options={tuning.options()}
            onChange={(value) => onSave(saveOf(tuning, value))}
          />
        ))}
      </span>
    </li>
  );
}

/**
 * Motor de riesgo y antifraude (solo el ADMIN): cortes del puntaje y la acción de cada nivel, qué hacer si el
 * motor falla, la sospecha de duplicado al registrarse, el dispositivo del empleado y cada señal con su modo
 * (apagada, solo medir u obligatoria), sus puntos y su línea base de fraudes confirmados y falsos positivos.
 * Elegir un valor no guarda nada todavía: `onSave` recibe qué cambia para confirmarlo primero.
 */
export function RiskEngineSection({ policy, saving, onSave }: RiskEngineSectionProps) {
  const t = useT();
  const catalogs = useCatalogs();
  return (
    <div className="stack">
      {riskTunings(policy, catalogs).map((tuning) => (
        <TuningRow key={tuning.key} tuning={tuning} saving={saving} onSave={onSave} />
      ))}
      <div className="stack">
        <h3 className="section-subtitle">
          <Activity size={18} /> {t('policy.risk.signals.title')}
        </h3>
        <p className="muted small">
          <Fingerprint size={14} /> {t('policy.risk.signals.hint')}
        </p>
        <ul className="signal-list">
          {policy.risk_signals.map((signal) => (
            <SignalRow key={signal.code} signal={signal} enabled={policy.risk_engine} saving={saving} onSave={onSave} />
          ))}
        </ul>
      </div>
    </div>
  );
}
