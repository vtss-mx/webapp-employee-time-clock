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
  /** Módulo del menú en que va. */
  module?: string | null;
}

/** Un módulo del menú con sus pantallas (submódulos), en el orden del backend. */
export interface NavGroup {
  code: string;
  name: string;
  icon: LucideIcon;
  entries: NavEntry[];
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
    module: screen.module,
  }));
}

/**
 * El menú agrupado por módulos, como lo envía el backend (`user.modules` en orden y el módulo de
 * cada pantalla). Las pantallas sin módulo conocido van al final, en un grupo sin encabezado.
 */
export function navGroups(user: User, nav: NavEntry[]): NavGroup[] {
  const groups = (user.modules ?? [])
    .map((module) => ({ code: module.code, name: module.name, icon: iconFor(module.icon), entries: nav.filter((entry) => entry.module === module.code) }))
    .filter((group) => group.entries.length > 0);
  const known = new Set(groups.map((group) => group.code));
  const loose = nav.filter((entry) => !entry.module || !known.has(entry.module));
  return loose.length ? [...groups, { code: '', name: '', icon: iconFor(''), entries: loose }] : groups;
}

/** ¿Alguna pantalla del usuario muestra este contador? (solo entonces se consulta). */
export function usesBadge(user: User | null, badge: string): boolean {
  return Boolean(user?.screens.some((screen) => screen.badge === badge));
}
