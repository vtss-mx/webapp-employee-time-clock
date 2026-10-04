import { QrCode, ScanFace, ShieldCheck, SplitSquareHorizontal, type LucideIcon } from 'lucide-react';
import { useCatalogs } from '../hooks/useCatalogs';
import type { ValidatorMode, ValidatorModeItem, VerificationMethod } from '../types';
import { ChoiceGroup } from './ui/ChoiceGroup';
import { RadioCard } from './ui/RadioCard';

/** Ícono de cada modo; el nombre, la descripción y los métodos vienen del catálogo validator_modes. */
const MODE_ICONS: Partial<Record<string, LucideIcon>> = {
  QR_OR_FACE: SplitSquareHorizontal,
  QR: QrCode,
  FACE: ScanFace,
  QR_AND_FACE: ShieldCheck,
};
const modeIcon = (code: string): LucideIcon => MODE_ICONS[code] ?? ShieldCheck;

/**
 * Métodos disponibles hoy: los del modo (catálogo, en su orden), sin los que usan QR si la
 * empresa lo desactivó (la misma regla que aplica el backend).
 */
export function availableMethods(mode: ValidatorModeItem | undefined, qrEnabled: boolean): VerificationMethod[] {
  return (mode?.methods ?? []).filter((method) => qrEnabled || method === 'FACE');
}

export function ValidatorModeBadge({ mode }: { mode: ValidatorMode }) {
  const { nameOf } = useCatalogs();
  const Icon = modeIcon(mode);
  return (
    <span className="badge badge--info badge--plain mode-badge">
      <Icon size={14} aria-hidden /> {nameOf('validator_modes', mode)}
    </span>
  );
}

interface ValidatorModePickerProps {
  value: ValidatorMode;
  onChange: (mode: ValidatorMode) => void;
  disabled?: boolean;
}

/**
 * Selección del modo con tarjetas propias (`RadioCard` en un grupo de opciones: las flechas recorren
 * los modos): solo los modos activos del catálogo.
 */
export function ValidatorModePicker({ value, onChange, disabled = false }: ValidatorModePickerProps) {
  const { active } = useCatalogs();
  return (
    <ChoiceGroup label="Cómo identifica" className="mode-picker" radio disabled={disabled}>
      {active('validator_modes').map(({ code, name, description }) => {
        const Icon = modeIcon(code);
        return <RadioCard key={code} name="validator-mode" value={code} checked={value === code} onChange={onChange} title={name} description={description} icon={<Icon size={22} />} />;
      })}
    </ChoiceGroup>
  );
}
