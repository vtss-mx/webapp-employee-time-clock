import type { LucideIcon } from 'lucide-react';
import { iconFor } from '../routes/screens';
import type { User } from '../types';

export interface NavEntry {
  to: string;
  label: string;
  /** Etiqueta corta: título de la barra superior en teléfonos. */
  short?: string;
  icon: LucideIcon;
  badge?: number | null;
}

/** Valor de cada contador que el backend puede asociar a una pantalla (`screen.badge`). */
export type BadgeValues = Partial<Record<string, number | null>>;

/** Menú del usuario: sus pantallas, tal como las envía el backend (orden, nombres, íconos, contadores). */
export function navFor(user: User, badges: BadgeValues = {}): NavEntry[] {
  return user.screens.map((screen) => ({
    to: screen.path,
    label: screen.name,
    short: screen.short_name ?? undefined,
    icon: iconFor(screen.icon),
    badge: screen.badge ? badges[screen.badge] : null,
  }));
}

/** ¿Alguna pantalla del usuario muestra este contador? (solo entonces se consulta). */
export function usesBadge(user: User | null, badge: string): boolean {
  return Boolean(user?.screens.some((screen) => screen.badge === badge));
}
