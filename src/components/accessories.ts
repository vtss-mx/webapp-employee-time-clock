import { Ban, Glasses, HardHat, type LucideIcon } from 'lucide-react';
import type { AccessoryItem, VerificationRules } from '../types';

/** Regla de la política de la empresa que exige retirar un accesorio. */
export type AccessoryRule = keyof Pick<VerificationRules, 'block_glasses' | 'block_headwear' | 'block_mask'>;

/**
 * Lo que el catálogo de accesorios no guarda: su ícono y la regla de la política que lo exige.
 * El nombre y la frase ("los lentes") siempre vienen del catálogo.
 */
const ACCESSORY_UI: Partial<Record<string, { icon: LucideIcon; rule: AccessoryRule }>> = {
  GLASSES: { icon: Glasses, rule: 'block_glasses' },
  HEADWEAR: { icon: HardHat, rule: 'block_headwear' },
  MASK: { icon: Ban, rule: 'block_mask' },
};

export const accessoryIcon = (code: string): LucideIcon => ACCESSORY_UI[code]?.icon ?? Ban;

export interface RuledAccessory {
  item: AccessoryItem;
  rule: AccessoryRule;
  icon: LucideIcon;
}

/** Accesorios activos del catálogo (en su orden) que la política de la empresa puede exigir retirar. */
export function ruledAccessories(accessories: AccessoryItem[]): RuledAccessory[] {
  return accessories.flatMap((item) => {
    const ui = ACCESSORY_UI[item.code];
    return item.active && ui ? [{ item, ...ui }] : [];
  });
}
