import { QrCode, ScanFace, ShieldCheck, SplitSquareHorizontal, type LucideIcon } from 'lucide-react';
import type { ValidatorMode } from '../types';

/** Forma de identificar del punto de control (la misma regla que aplica el backend). */
export type CheckpointMethod = 'QR' | 'FACE' | 'QR_AND_FACE';

interface ModeInfo {
  label: string;
  description: string;
  icon: LucideIcon;
  methods: CheckpointMethod[];
}

export const VALIDATOR_MODES: Record<ValidatorMode, ModeInfo> = {
  QR_OR_FACE: {
    label: 'QR o rostro',
    description: 'El operador elige en cada identificación: credencial QR o reconocimiento facial.',
    icon: SplitSquareHorizontal,
    methods: ['FACE', 'QR'],
  },
  QR: {
    label: 'Solo QR',
    description: 'Escanea el código QR de la credencial del empleado (impresa o en su teléfono).',
    icon: QrCode,
    methods: ['QR'],
  },
  FACE: {
    label: 'Solo rostro',
    description: 'Reconoce al empleado por su rostro entre todo el personal, sin credencial.',
    icon: ScanFace,
    methods: ['FACE'],
  },
  QR_AND_FACE: {
    label: 'QR y rostro',
    description: 'Máxima seguridad: escanea el QR y el rostro debe ser el de su dueño.',
    icon: ShieldCheck,
    methods: ['QR_AND_FACE'],
  },
};

const MODE_ORDER = Object.keys(VALIDATOR_MODES) as ValidatorMode[];

/** Métodos disponibles hoy: los del modo, sin los que usan QR si la empresa lo desactivó. */
export function availableMethods(mode: ValidatorMode, qrEnabled: boolean): CheckpointMethod[] {
  return VALIDATOR_MODES[mode].methods.filter((method) => qrEnabled || method === 'FACE');
}

export function ValidatorModeBadge({ mode }: { mode: ValidatorMode }) {
  const { label, icon: Icon } = VALIDATOR_MODES[mode];
  return (
    <span className="badge badge--info badge--plain mode-badge">
      <Icon size={14} aria-hidden /> {label}
    </span>
  );
}

interface ValidatorModePickerProps {
  value: ValidatorMode;
  onChange: (mode: ValidatorMode) => void;
  disabled?: boolean;
}

/** Selección del modo con tarjetas (grupo de radio accesible). */
export function ValidatorModePicker({ value, onChange, disabled = false }: ValidatorModePickerProps) {
  return (
    <fieldset className="mode-picker" disabled={disabled}>
      <legend className="mode-picker__legend">Cómo identifica</legend>
      {MODE_ORDER.map((mode) => {
        const { label, description, icon: Icon } = VALIDATOR_MODES[mode];
        return (
          <label key={mode} className={`mode-option ${value === mode ? 'is-selected' : ''}`}>
            <input type="radio" name="validator-mode" value={mode} checked={value === mode} onChange={() => onChange(mode)} />
            <span className="mode-option__icon">
              <Icon size={22} />
            </span>
            <span className="mode-option__text">
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
