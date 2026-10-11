/**
 * Rutas del backend falso de las pruebas del idioma: cada GET que piden las pantallas, con datos de prueba y sus
 * textos del servidor en el idioma de la petición. Ver `core.ts`.
 */
import type { User } from '../../types';
import { tokenResponse } from '../render';
import { adminRoutes } from './admin';
import { localizedCatalogs, localizedUser } from './catalogs';
import { companyRoutes } from './company';
import { get, route, type Route } from './core';
import { dataExport } from './people';

/** Estado del backend falso durante una prueba (lo que cambia una acción). */
export interface FakeWorld {
  user: User;
}

export function fakeApiRoutes(user: User): { routes: Route[]; world: FakeWorld } {
  const world: FakeWorld = { user };
  const routes: Route[] = [
    route('POST', '/auth/refresh', (ctx) => ({ ...tokenResponse(world.user), access_token: 'token-language', user: localizedUser(world.user, ctx.locale) }), true),
    get('/users/me', (ctx) => localizedUser(world.user, ctx.locale)),
    get('/catalogs', (ctx) => localizedCatalogs(ctx.locale)),
    // Exportación de los datos de una persona (migración 0097): la pide el titular en «Mi perfil» y su empresa en
    // el expediente del empleado. La misma forma para los dos; el alcance lo decide el servidor.
    get('/me/export', () => dataExport('SELF')),
    get('/employees/:id/export', () => dataExport('COMPANY')),
    ...adminRoutes(),
    ...companyRoutes(),
  ];
  return { routes, world };
}
