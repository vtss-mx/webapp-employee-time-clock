import { Ban, Glasses, HardHat, type LucideIcon } from 'lucide-react';
import type { AccessoryItem, VerificationRules } from '../types';

/*
 * Accesorios del catálogo `accessories` (lo que el detector del servidor mide: lentes —también de sol—, gorra, sombrero,
 * gorro, visera o casco, y cubrebocas): lo que el catálogo no guarda es el ícono y la regla de la política que puede
 * bloquearlo. El nombre («Lentes») y la frase («los lentes») vienen del catálogo, ya en el idioma activo. Lo usan la
 * insignia sobre el rostro (`AccessoryBadges`: el ÚNICO aviso de un accesorio en la experiencia de captura, decisión del
 * dueño, 2026-10-07) y la política del ADMIN (`policyFields`, `CompanyPolicyPage`).
 */

/** Regla de la política de la empresa sobre un accesorio. */
export type AccessoryRule = keyof Pick<VerificationRules, 'block_glasses' | 'block_headwear' | 'block_mask'>;

const ACCESSORY_UI: Partial<Record<string, { icon: LucideIcon; rule: AccessoryRule }>> = {
  GLASSES: { icon: Glasses, rule: 'block_glasses' },
  HEADWEAR: { icon: HardHat, rule: 'block_headwear' },
  MASK: { icon: Ban, rule: 'block_mask' },
};

/** Ícono de un accesorio por su código; uno nuevo en el catálogo sin ícono propio usa el genérico. */
export const accessoryIcon = (code: string): LucideIcon => ACCESSORY_UI[code]?.icon ?? Ban;

export interface RuledAccessory {
  item: AccessoryItem;
  rule: AccessoryRule;
  icon: LucideIcon;
}

/** Accesorios activos del catálogo (en su orden) con la regla de la política que los bloquea. */
export function ruledAccessories(accessories: AccessoryItem[]): RuledAccessory[] {
  return accessories.flatMap((item) => {
    const ui = ACCESSORY_UI[item.code];
    return item.active && ui ? [{ item, ...ui }] : [];
  });
}
