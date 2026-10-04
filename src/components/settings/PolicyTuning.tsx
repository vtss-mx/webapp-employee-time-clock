import { Clock, Lock, QrCode, Repeat, ScanFace } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import type { VerificationPolicy, VerificationPolicyUpdate } from '../../types';
import { Select } from '../ui/Select';

/** Opciones de los ajustes numéricos (dentro de los límites que valida el backend). */
const STEPS = [1, 2];
const LOCKOUT_FAILURES = [3, 5, 7, 10];
const LOCKOUT_MINUTES = [5, 15, 30, 60, 120];
const QR_LIFETIMES = [15, 30, 60, 120, 300];

export type TuningKey = 'anti_spoofing_level' | 'liveness_steps' | 'lockout_max_failures' | 'lockout_minutes' | 'qr_lifetime_seconds';

interface PolicyTuningProps {
  policy: VerificationPolicy;
  /** Ajuste que se está guardando (su control queda deshabilitado). */
  saving: string | null;
  onSave: (key: TuningKey, changes: VerificationPolicyUpdate, title: string, detail: string) => void;
}

interface TuningRowProps {
  icon: ReactNode;
  label: string;
  description: string;
  children: (labelId: string) => ReactNode;
}

function TuningRow({ icon, label, description, children }: TuningRowProps) {
  const labelId = useId();
  return (
    <div className="tuning-row">
      <span className="switch-row__icon">{icon}</span>
      <span className="switch-row__text">
        <span className="switch-row__label" id={labelId}>
          {label}
        </span>
        <span className="switch-row__description">{description}</span>
      </span>
      <span className="tuning-row__control">{children(labelId)}</span>
    </div>
  );
}

const minutesLabel = (minutes: number) => (minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`);
const secondsLabel = (seconds: number) => (seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`);

/**
 * Ajustes de los candados: sensibilidad del anti-spoofing (catálogo), giros de la prueba de vida,
 * el bloqueo por intentos fallidos y la vigencia del QR dinámico. Cada control se deshabilita si su
 * candado está apagado.
 */
export function PolicyTuning({ policy, saving, onSave }: PolicyTuningProps) {
  const { active, byCode, nameOf } = useCatalogs();
  const level = byCode('antispoof_levels', policy.anti_spoofing_level);
  return (
    <div className="stack">
      <TuningRow icon={<ScanFace size={20} />} label="Sensibilidad del anti-spoofing" description={level?.description ?? 'Qué tan estricto es al detectar fotos, pantallas y videos.'}>
        {(labelId) => (
          <Select
            aria-labelledby={labelId}
            value={policy.anti_spoofing_level}
            disabled={!policy.anti_spoofing || saving === 'anti_spoofing_level'}
            options={active('antispoof_levels').map((item) => ({ value: item.code, label: item.name, description: item.description ?? undefined }))}
            onChange={(code) => onSave('anti_spoofing_level', { anti_spoofing_level: code }, `Anti-spoofing: nivel ${nameOf('antispoof_levels', code)}`, byCode('antispoof_levels', code)?.description ?? '')}
          />
        )}
      </TuningRow>
      <TuningRow
        icon={<Repeat size={20} />}
        label="Giros de la prueba de vida"
        description={policy.liveness_steps > 1 ? 'Dos giros aleatorios: un video grabado tendría que acertar la secuencia.' : 'Un giro aleatorio (más rápido, menos seguro).'}
      >
        {(labelId) => (
          <Select
            aria-labelledby={labelId}
            value={String(policy.liveness_steps)}
            disabled={!policy.liveness_challenge || saving === 'liveness_steps'}
            options={STEPS.map((n) => ({ value: String(n), label: n === 1 ? '1 giro' : `${n} giros` }))}
            onChange={(value) => onSave('liveness_steps', { liveness_steps: Number(value) }, 'Prueba de vida actualizada', `Se pedirá${Number(value) === 1 ? ' un giro' : 'n dos giros'} de cabeza en orden aleatorio.`)}
          />
        )}
      </TuningRow>
      <TuningRow icon={<Lock size={20} />} label="Intentos antes del bloqueo" description="Intentos fallidos o sospechosos seguidos que bloquean temporalmente la verificación facial.">
        {(labelId) => (
          <Select
            aria-labelledby={labelId}
            value={String(policy.lockout_max_failures)}
            disabled={!policy.lockout_enabled || saving === 'lockout_max_failures'}
            options={LOCKOUT_FAILURES.map((n) => ({ value: String(n), label: `${n} intentos` }))}
            onChange={(value) => onSave('lockout_max_failures', { lockout_max_failures: Number(value) }, 'Bloqueo actualizado', `Se bloqueará tras ${value} intentos fallidos seguidos.`)}
          />
        )}
      </TuningRow>
      <TuningRow icon={<Clock size={20} />} label="Duración del bloqueo" description="Tiempo que debe esperar la persona (o el validador) antes de volver a intentarlo.">
        {(labelId) => (
          <Select
            aria-labelledby={labelId}
            value={String(policy.lockout_minutes)}
            disabled={!policy.lockout_enabled || saving === 'lockout_minutes'}
            options={[...new Set([...LOCKOUT_MINUTES, policy.lockout_minutes])].sort((a, b) => a - b).map((n) => ({ value: String(n), label: minutesLabel(n) }))}
            onChange={(value) => onSave('lockout_minutes', { lockout_minutes: Number(value) }, 'Bloqueo actualizado', `El bloqueo durará ${minutesLabel(Number(value))}.`)}
          />
        )}
      </TuningRow>
      <TuningRow icon={<QrCode size={20} />} label="Vigencia del código QR" description="Cada QR del empleado se renueva solo al cumplir este tiempo y sirve una sola vez. Menos tiempo, más seguro.">
        {(labelId) => (
          <Select
            aria-labelledby={labelId}
            value={String(policy.qr_lifetime_seconds)}
            disabled={!policy.qr_enabled || saving === 'qr_lifetime_seconds'}
            options={[...new Set([...QR_LIFETIMES, policy.qr_lifetime_seconds])].sort((a, b) => a - b).map((n) => ({ value: String(n), label: secondsLabel(n) }))}
            onChange={(value) => onSave('qr_lifetime_seconds', { qr_lifetime_seconds: Number(value) }, 'Vigencia del QR actualizada', `Cada código QR durará ${secondsLabel(Number(value))} y servirá una sola vez.`)}
          />
        )}
      </TuningRow>
    </div>
  );
}
