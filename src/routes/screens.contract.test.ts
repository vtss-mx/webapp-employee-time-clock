import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEED_GRANTS, SEED_SCREENS } from '../test/screens';
import { iconFor, SCREEN_VIEWS } from './screens';
import { Circle } from 'lucide-react';

/**
 * Contrato con el backend: las pantallas las define la BD (alembic/seed/catalogs.json) y el
 * frontend solo sabe dibujarlas. Si el backend está junto a este proyecto, se compara contra su seed.
 */
const SEED_FILE = resolve(process.cwd(), '../backend-employee-time-clock/alembic/seed/catalogs.json');

describe('pantallas: contrato con el backend', () => {
  it('cada pantalla del backend tiene su vista, con la misma ruta base y un ícono conocido', () => {
    for (const screen of SEED_SCREENS) {
      const view = SCREEN_VIEWS[screen.code];
      expect(view, screen.code).toBeDefined();
      expect(view.base, screen.code).toBe(screen.path);
      expect(view.routes.map((r) => r.path), screen.code).toContain(screen.path);
      expect(iconFor(screen.icon), screen.icon).not.toBe(Circle);
    }
    expect(Object.keys(SCREEN_VIEWS).sort()).toEqual(SEED_SCREENS.map((s) => s.code).sort());
  });

  it.skipIf(!existsSync(SEED_FILE))('las pantallas de prueba son las mismas que las del seed del backend', () => {
    const seed = JSON.parse(readFileSync(SEED_FILE, 'utf-8')) as {
      screens: Array<Record<string, unknown>>;
      role_screens: Array<{ role_code: string; screen_code: string }>;
    };
    const pick = ({ code, name, short_name, path, icon, badge }: Record<string, unknown>) => ({ code, name, short_name, path, icon, badge });
    expect(SEED_SCREENS).toEqual(seed.screens.map(pick));
    const grants: Record<string, string[]> = {};
    for (const { role_code, screen_code } of seed.role_screens) (grants[role_code] ??= []).push(screen_code);
    expect(SEED_GRANTS).toEqual(grants);
  });
});
